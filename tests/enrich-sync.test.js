import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../js/core.js';
import { emptyRaces, FULL } from '../js/races-sync.js';
import { emptyEnv, loadEnv, saveEnv, fetchWeather, enrich } from '../js/enrich-sync.js';

let mem;
beforeEach(() => {
  mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  Object.assign(S, { athleteId: 42, demo: false, warn: null, races: emptyRaces(), raceDet: {}, raceEnv: emptyEnv() });
});
afterEach(() => { delete globalThis.localStorage; Object.assign(S, { athleteId: null, demo: false, warn: null, races: null, raceDet: null, raceEnv: null }); });

const NOW = 1780000000;
const DAYS = 86400;
const stamp = (s) => new Date(s * 1000).toISOString().slice(0, 19);
// invented races at an invented point; the start time is 08:xx local
const mkRace = (id, ago, ll = [40.02, -105.27]) => ({ id: String(id), d: stamp(NOW - ago * DAYS).replace(/T\d\d/, 'T08'), s: NOW - ago * DAYS, ll, n: 'Riverbend 10K' });
const racesOf = (...rs) => { const rc = emptyRaces(); for (const r of rs) rc.races[r.id] = r; return rc; };
const block = (d) => ({ hourly: {
  time: Array.from({ length: 24 }, (_, i) => `${d}T${String(i).padStart(2, '0')}:00`),
  temperature_2m: Array(24).fill(12.34), apparent_temperature: Array(24).fill(10), relative_humidity_2m: Array(24).fill(60),
  precipitation: Array(24).fill(0), weather_code: Array(24).fill(1), wind_speed_10m: Array(24).fill(9) } });
const NULLS = (d) => { const b = block(d); b.hourly.temperature_2m = Array(24).fill(null); return b; };
const dateOf = (url) => /start_date=([\d-]+)/.exec(url)[1];

// answers: array of 'ok' | 'none' | 500 | 'throw', consumed in order; 'ok' once exhausted
function fakeGet(answers = []) {
  const urls = []; let i = 0;
  const get = async (url) => {
    urls.push(url);
    const a = i < answers.length ? answers[i] : 'ok'; i++;
    if (a === 'throw') throw new TypeError('offline');
    if (a === 500) return { ok: false, status: 500, json: async () => ({}) };
    const d = dateOf(url);
    return { ok: true, status: 200, json: async () => (a === 'none' ? NULLS(d) : block(d)) };
  };
  return { get, urls };
}

test('fetchWeather asks once per race with a start point, newest first, and stores the start hour', async () => {
  const rc = racesOf(mkRace(1, 400), mkRace(2, 3), mkRace(3, 40), mkRace(4, 10, null));
  const env = emptyEnv(); const { get, urls } = fakeGet();
  await fetchWeather(rc, env, get, NOW);
  assert.equal(urls.length, 3);
  assert.deepEqual(urls.map(dateOf), [rc.races[2], rc.races[3], rc.races[1]].map((r) => r.d.slice(0, 10)));
  assert.deepEqual(Object.keys(env.wx).sort(), ['1', '2', '3']);
  for (const id of ['1', '2', '3']) { const w = env.wx[id]; assert.equal(w.t, 12.3); assert.equal(w.c, 1); assert.equal(w.at, NOW); assert.equal(typeof w.prov, 'boolean'); }
  assert.equal(env.wx['2'].prov, true);
  assert.equal(env.wx['1'].prov, false);
});

test('fetchWeather skips races it already has final weather for, and asks again for provisional weather once the race is a week old', async () => {
  const rc = racesOf(mkRace(1, 400), mkRace(2, 8), mkRace(3, 2));
  const env = emptyEnv();
  env.wx['1'] = { t: 1, f: 1, h: 1, w: 1, p: 0, c: 0, at: NOW - 1000, prov: false };
  env.wx['2'] = { t: 1, f: 1, h: 1, w: 1, p: 0, c: 0, at: NOW - 9 * DAYS, prov: true };   // the race is now a week old: ask again
  env.wx['3'] = { t: 1, f: 1, h: 1, w: 1, p: 0, c: 0, at: NOW - 1000, prov: true };       // still provisional: leave
  const { get, urls } = fakeGet();
  await fetchWeather(rc, env, get, NOW);
  assert.equal(urls.length, 1);
  assert.equal(dateOf(urls[0]), rc.races[2].d.slice(0, 10));
  assert.equal(env.wx['2'].prov, false);
  assert.equal(env.wx['2'].t, 12.3);
});

test('three request failures in a row end the pass', async () => {
  const rc = racesOf(mkRace(1, 10), mkRace(2, 20), mkRace(3, 30), mkRace(4, 40));
  const env = emptyEnv(); const { get, urls } = fakeGet([500, 'throw', 500, 'ok']);
  await fetchWeather(rc, env, get, NOW);
  assert.equal(urls.length, 3);
  assert.deepEqual(env.wx, {});
});

test('an answer with no usable hour stores a dated marker and does not count toward the cap', async () => {
  const rc = racesOf(mkRace(1, 10), mkRace(2, 20), mkRace(3, 30), mkRace(4, 40));
  const env = emptyEnv(); const { get, urls } = fakeGet(['none', 'none', 'none', 'ok']);
  await fetchWeather(rc, env, get, NOW);
  assert.equal(urls.length, 4);
  for (const id of ['1', '2', '3']) assert.deepEqual(env.wx[id], { at: NOW, none: true });
  assert.equal(env.wx['4'].t, 12.3);
});

test('a success resets the run of failures', async () => {
  const rc = racesOf(mkRace(1, 10), mkRace(2, 20), mkRace(3, 30), mkRace(4, 40), mkRace(5, 50));
  const env = emptyEnv(); const { get, urls } = fakeGet([500, 500, 'ok', 500, 500]);
  await fetchWeather(rc, env, get, NOW);
  assert.equal(urls.length, 5);
  assert.deepEqual(Object.keys(env.wx), ['3']);
});

test('fetchWeather drops weather for races no longer in the cache', async () => {
  const rc = racesOf(mkRace(1, 10));
  const env = emptyEnv();
  env.wx.gone = { t: 1, f: 1, h: 1, w: 1, p: 0, c: 0, at: NOW, prov: false };
  const { get } = fakeGet();
  await fetchWeather(rc, env, get, NOW);
  assert.deepEqual(Object.keys(env.wx), ['1']);
});

test('fetchWeather saves to storage', async () => {
  const rc = racesOf(mkRace(1, 10), mkRace(2, 20));
  const { get } = fakeGet();
  await fetchWeather(rc, S.raceEnv, get, NOW);
  assert.deepEqual(Object.keys(JSON.parse(mem['lw.raceEnv.42']).wx).sort(), ['1', '2']);
  assert.equal(loadEnv(42).wx['1'].t, 12.3);
});

test('loadEnv gives an empty env for nothing or a wrong version', () => {
  assert.deepEqual(loadEnv(42), emptyEnv());
  mem['lw.raceEnv.42'] = JSON.stringify({ v: 2, wx: { a: 1 }, pl: {} });
  assert.deepEqual(loadEnv(42), emptyEnv());
});

test('saveEnv sets the storage-full warning when the write fails', () => {
  localStorage.setItem = () => { throw new Error('quota'); };
  saveEnv();
  assert.equal(S.warn, FULL);
});

test('saveEnv writes nothing in the demo', () => {
  S.demo = true; saveEnv();
  assert.equal(mem['lw.raceEnv.42'], undefined);
  assert.equal(S.warn, null);
});

test('enrich does nothing in the demo, and a call during a pass runs exactly one more pass afterwards', async () => {
  S.demo = true;
  const d = fakeGet();
  await enrich(d.get, async () => {});
  assert.equal(d.urls.length, 0);
  S.demo = false;
  S.races = racesOf(mkRace(1, 10));
  let release; const gate = new Promise((r) => { release = r; });
  const urls = [];
  const get = async (url) => { urls.push(url); if (urls.length === 1) await gate; return { ok: true, status: 200, json: async () => block(dateOf(url)) }; };
  const p1 = enrich(get, async () => {});
  await new Promise((r) => setTimeout(r, 5));
  const p2 = enrich(get, async () => {});
  const p3 = enrich(get, async () => {});
  S.races.races['2'] = mkRace(2, 20);   // appears during the pass; the one queued pass finds it
  release();
  await Promise.all([p1, p2, p3]);
  assert.equal(urls.length, 2);   // pass 1 asked race 1; the queued pass asked race 2; no third pass
  assert.deepEqual(Object.keys(S.raceEnv.wx).sort(), ['1', '2']);
});

test('enrich never rejects', async () => {
  S.races = racesOf(mkRace(1, 10));
  await enrich(async () => { throw new Error('boom'); }, async () => {});
  S.raceEnv = null;
  await enrich(async () => { throw new Error('boom'); }, async () => {});
});
