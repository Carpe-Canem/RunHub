import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, RateLimited, UserError } from '../js/core.js';
import { emptyRaces, loadRaces, loadRaceDet, saveRaces, saveRaceDet, noteListed, scanHistory, fetchRaceDetails, fetchProfile, rescan, detailStepEvent } from '../js/races-sync.js';

let mem;
const saved = (k) => JSON.parse(mem[k] || 'null');
beforeEach(() => {
  mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  Object.assign(S, { athleteId: 42, demo: false, warn: null, races: emptyRaces(), raceDet: {} });
});
afterEach(() => { delete globalThis.localStorage; Object.assign(S, { athleteId: null, warn: null, races: null, raceDet: null }); });

// 450 invented activities, one a day back from a fixed start; every 15th is a race (30 in all).
const T = 1780000000;
const iso = (s) => new Date(s * 1000).toISOString().replace('.000', '');
const ACTS = Array.from({ length: 450 }, (_, i) => {
  const s = T - i * 86400;
  const race = i % 15 === 0;
  return { id: 5000 + i, name: race ? `Riverbend 10K ${i}` : 'Morning Run', sport_type: 'Run', workout_type: race ? 1 : 0, distance: 10000, elapsed_time: 2700, start_date: iso(s), start_date_local: iso(s) };
});
const RACE_IDS = ACTS.filter((a) => a.workout_type === 1).map((a) => String(a.id));

function fakeCall(list = ACTS, { throwOn = 0 } = {}) {
  const calls = [];
  const call = async (path) => {
    calls.push(path);
    if (throwOn && calls.length === throwOn) throw new RateLimited(Date.now() + 60e3);
    const u = new URL(path, 'https://x.test');
    const before = +u.searchParams.get('before'); const per = +u.searchParams.get('per_page');
    return list.filter((a) => Date.parse(a.start_date) / 1000 < before).slice(0, per);
  };
  return { call, calls };
}
const beforeOf = (p) => +new URL(p, 'https://x.test').searchParams.get('before');

test('scanHistory reads every page with a moving before= cursor and finds all 30 races', async () => {
  const rc = S.races; const { call, calls } = fakeCall();
  await scanHistory(rc, call);
  assert.equal(calls.length, 3);
  for (let i = 1; i < calls.length; i++) assert.ok(beforeOf(calls[i]) < beforeOf(calls[i - 1]));
  assert.ok(calls.every((p) => p.startsWith('/athlete/activities?before=') && p.includes('per_page=200')));
  assert.equal(rc.scan.done, true);
  assert.deepEqual(Object.keys(rc.races).sort(), RACE_IDS.slice().sort());
  assert.deepEqual(rc.scan.seen, []);
  assert.ok(rc.lastScan > 0);
  assert.equal(Object.keys(saved('lw.races.42').races).length, 30);
});

test('scanHistory does nothing once the scan is done', async () => {
  const rc = S.races; rc.scan.done = true; const { call, calls } = fakeCall();
  await scanHistory(rc, call);
  assert.equal(calls.length, 0);
});

test('scanHistory resumes from its cursor after a rate-limit pause', async () => {
  const rc = S.races;
  const first = fakeCall(ACTS, { throwOn: 2 });
  await assert.rejects(scanHistory(rc, first.call), RateLimited);
  assert.equal(rc.scan.done, false);
  const cursor = rc.scan.cursor;
  assert.ok(cursor > 0);
  assert.equal(saved('lw.races.42').scan.cursor, cursor);
  const second = fakeCall();
  await scanHistory(rc, second.call);
  assert.equal(second.calls.length, 2);
  assert.equal(second.calls[0], first.calls[1]);
  assert.equal(beforeOf(second.calls[0]), cursor);
  assert.equal(Object.keys(rc.races).length, 30);
  assert.equal(rc.scan.done, true);
});

test('a full rescan removes a race that is no longer flagged', async () => {
  const rc = S.races;
  await scanHistory(rc, fakeCall().call);
  rc.races['999'] = { id: '999', n: 'Frostbite 5 Miler', s: T - 100 * 86400 };
  rescan(rc);
  assert.deepEqual(rc.scan, { done: false, started: 0, cursor: 0, seen: [] });
  await scanHistory(rc, fakeCall().call);
  assert.equal(rc.races['999'], undefined);
  assert.equal(Object.keys(rc.races).length, 30);
});

test('noteListed adds a new race, removes one un-flagged inside the window and keeps one older than after', () => {
  const rc = S.races; const after = T - 10 * 86400;
  rc.races['1'] = { id: '1', n: 'Old Race', s: after - 86400 };
  rc.races['2'] = { id: '2', n: 'Unflagged', s: after + 86400 };
  const list = [
    { id: 2, name: 'Unflagged', sport_type: 'Run', workout_type: 0, start_date: iso(after + 86400), start_date_local: iso(after + 86400) },
    { id: 3, name: 'Frostbite 5 Miler', sport_type: 'Run', workout_type: 1, distance: 8047, start_date: iso(after + 2 * 86400), start_date_local: iso(after + 2 * 86400) },
  ];
  noteListed(rc, list, after);
  assert.deepEqual(Object.keys(rc.races).sort(), ['1', '3']);
  assert.equal(rc.races['3'].n, 'Frostbite 5 Miler');
});

test('noteListed ignores a Ride with workout_type 1', () => {
  const rc = S.races;
  noteListed(rc, [{ id: 7, name: 'Hill Climb', sport_type: 'Ride', workout_type: 1, start_date: iso(T), start_date_local: iso(T) }], T - 86400);
  assert.deepEqual(rc.races, {});
});

test('fetchRaceDetails fetches newest first and records a missing activity', async () => {
  const rc = S.races; const rd = S.raceDet;
  noteListed(rc, ACTS.slice(0, 46), 0);   // races 5000, 5015, 5030, 5045
  rd['5045'] = { at: 1, missing: true };
  const calls = []; const steps = [];
  const call = async (path) => {
    calls.push(path);
    if (path === '/activities/5015') return null;
    return { id: +path.split('/')[2], sport_type: 'Run', description: '3rd of 40 in M40-44', calories: 600, splits_metric: [{ distance: 1000, elapsed_time: 270, elevation_difference: 2 }] };
  };
  await fetchRaceDetails(rc, rd, call, (done, total) => steps.push([done, total]));
  assert.deepEqual(calls, ['/activities/5000', '/activities/5015', '/activities/5030']);
  assert.deepEqual(steps, [[1, 3], [2, 3], [3, 3]]);
  assert.equal(rd['5015'].missing, true);
  assert.ok(rd['5015'].at > 0);
  assert.equal(rd['5000'].cal, 600);
  assert.deepEqual(rd['5000'].sp.km, [[1000, 270, 2]]);
  assert.equal(saved('lw.raceDet.42').det['5030'].cal, 600);
});

test('fetchProfile reduces 1000 stream points to 80', async () => {
  const distance = Array.from({ length: 1000 }, (_, i) => i * 10);
  const altitude = Array.from({ length: 1000 }, (_, i) => 100 + (i % 50));
  let asked;
  const prof = await fetchProfile('5000', async (p) => { asked = p; return { distance: { data: distance }, altitude: { data: altitude } }; });
  assert.equal(asked, '/activities/5000/streams?keys=altitude,distance&key_by_type=true');
  assert.equal(prof.length, 80);
  assert.deepEqual(prof[0], [0, 100]);
  assert.deepEqual(prof[79], [9990, 100 + (999 % 50)]);
});

test('fetchProfile returns null for streams with no altitude', async () => {
  assert.equal(await fetchProfile('1', async () => ({ distance: { data: [0, 10, 20] } })), null);
  assert.equal(await fetchProfile('1', async () => null), null);
});

test('loadRaces and loadRaceDet start fresh when missing or the wrong version', () => {
  assert.deepEqual(loadRaces(42), emptyRaces());
  assert.deepEqual(loadRaceDet(42), {});
  mem['lw.races.42'] = JSON.stringify({ v: 0, races: { 1: {} } });
  mem['lw.raceDet.42'] = JSON.stringify({ v: 0, det: { 1: {} } });
  assert.deepEqual(loadRaces(42), emptyRaces());
  assert.deepEqual(loadRaceDet(42), {});
  saveRaces(); S.raceDet['5'] = { at: 1, missing: true }; saveRaceDet();
  assert.deepEqual(loadRaces(42), S.races);
  assert.deepEqual(loadRaceDet(42), { 5: { at: 1, missing: true } });
});

test('saving does nothing in demo', () => {
  S.demo = true;
  saveRaces(); saveRaceDet();
  assert.deepEqual(mem, {});
  S.demo = false;
});

// Storage with a total quota: a write fails when everything stored, with the new value in place, passes `limit` bytes.
function quota(limit) {
  globalThis.localStorage = {
    getItem: (k) => mem[k] ?? null,
    setItem(k, v) {
      const total = Object.entries({ ...mem, [k]: v }).reduce((n, [a, b]) => n + a.length + b.length, 0);
      if (total > limit) throw new Error('QuotaExceededError');
      mem[k] = v;
    },
    removeItem: (k) => { delete mem[k]; },
  };
}

test('saveRaces drops details before summaries when storage is full', async () => {
  await scanHistory(S.races, fakeCall().call);
  for (const id of RACE_IDS) S.raceDet[id] = { at: 1, cal: 500, sp: { mi: [], km: [] }, prof: Array.from({ length: 80 }, (_, i) => [i * 10, 100]) };
  saveRaceDet();
  const racesLen = JSON.stringify(S.races).length + 'lw.races.42'.length;
  assert.ok(mem['lw.raceDet.42'].length > racesLen);
  quota(racesLen + 50);
  S.races.races[RACE_IDS[0]].n = 'Riverbend 10K renamed';
  saveRaces();
  assert.equal(saved('lw.races.42').races[RACE_IDS[0]].n, 'Riverbend 10K renamed');
  assert.equal(mem['lw.raceDet.42'], undefined);
  // only the stored copy goes: the details stay in memory, so they are not all fetched again this session
  assert.equal(Object.keys(S.raceDet).length, 30);
  assert.equal(S.raceDet[RACE_IDS[0]].cal, 500);
  assert.equal(S.warn, 'This browser\'s storage is full, so some data will be fetched again next time.');
  S.warn = null;
  quota(100);
  saveRaces();
  assert.equal(S.warn, 'This browser\'s storage is full, so some data will be fetched again next time.');
});

test('saveRaceDet drops elevation profiles before giving up', () => {
  S.raceDet['1'] = { at: 1, cal: 500, prof: Array.from({ length: 80 }, (_, i) => [i * 10, 100]) };
  quota(200);
  saveRaceDet();
  assert.equal(S.raceDet['1'].prof, undefined);
  assert.equal(saved('lw.raceDet.42').det['1'].cal, 500);
  assert.equal(S.warn, null);
  quota(5);
  saveRaceDet();
  assert.equal(S.warn, 'This browser\'s storage is full, so some data will be fetched again next time.');
});

test('fetchRaceDetails skips a race whose request fails, keeps going, and leaves a note', async () => {
  const rc = S.races; const rd = S.raceDet;
  noteListed(rc, ACTS.slice(0, 46), 0);   // races 5000, 5015, 5030, 5045
  const calls = [];
  const call = async (path) => {
    calls.push(path);
    if (path === '/activities/5015') throw new UserError('Strava returned an error (500). Try again later.');
    return { id: +path.split('/')[2], sport_type: 'Run', calories: 600 };
  };
  await fetchRaceDetails(rc, rd, call);
  assert.deepEqual(calls, ['/activities/5000', '/activities/5015', '/activities/5030', '/activities/5045']);
  assert.equal(rd['5015'], undefined);   // not recorded, so the next pass asks again
  assert.deepEqual(Object.keys(rd).sort(), ['5000', '5030', '5045']);
  assert.equal(S.warn, 'Some race details could not be read; they will be retried.');
  assert.deepEqual(Object.keys(saved('lw.raceDet.42').det).sort(), ['5000', '5030', '5045']);
});

test('fetchRaceDetails still stops on a rate-limit pause', async () => {
  const rc = S.races; const rd = S.raceDet;
  noteListed(rc, ACTS.slice(0, 46), 0);
  const calls = [];
  const call = async (path) => {
    calls.push(path);
    if (path === '/activities/5015') throw new RateLimited(Date.now() + 60e3);
    return { id: +path.split('/')[2], sport_type: 'Run' };
  };
  await assert.rejects(fetchRaceDetails(rc, rd, call), RateLimited);
  assert.deepEqual(calls, ['/activities/5000', '/activities/5015']);
  assert.equal(S.warn, null);
  assert.ok(saved('lw.raceDet.42').det['5000']);
});

test('the details pass redraws every 5 races and at the end, and updates the status in between', () => {
  const events = Array.from({ length: 12 }, (_, i) => detailStepEvent(i + 1, 12));
  assert.deepEqual(events, ['status', 'status', 'status', 'status', 'data', 'status', 'status', 'status', 'status', 'data', 'status', 'data']);
});

test('a race noteListed adds during a scan survives the end-of-scan prune', async () => {
  const rc = S.races;
  const first = fakeCall(ACTS, { throwOn: 2 });
  await assert.rejects(scanHistory(rc, first.call), RateLimited);
  // listed by the Legends sync while the scan is paused: older than scan.started, not on a scanned page
  const extra = { id: 9001, name: 'Frostbite 5 Miler', sport_type: 'Run', workout_type: 1, distance: 8047, elapsed_time: 2400, start_date: iso(T - 3 * 86400 + 600), start_date_local: iso(T - 3 * 86400 + 600) };
  noteListed(rc, [extra], T - 10 * 86400);
  assert.ok(rc.scan.seen.includes('9001'));
  await scanHistory(rc, fakeCall().call);
  assert.equal(rc.scan.done, true);
  assert.equal(rc.races['9001'].n, 'Frostbite 5 Miler');
  // once the scan is done, nothing more is collected
  noteListed(rc, [{ ...extra, id: 9002 }], T - 10 * 86400);
  assert.deepEqual(rc.scan.seen, []);
});
