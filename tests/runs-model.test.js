import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayIdx, weekStart, DAY, setUnits } from '../js/core.js';
import { emptyCache, loadCache, miles, demoCache } from '../js/runs-model.js';

const iso = (daysAgo) => `${new Date((todayIdx() - daysAgo) * DAY).toISOString().slice(0, 10)}T07:00:00Z`;
const storage = (items) => ({ getItem: (k) => (k in items ? JSON.stringify(items[k]) : null), setItem() {}, removeItem() {} });

test('an empty cache holds runs only', () => {
  assert.deepEqual(emptyCache(), { v: 2, athlete: null, acts: {}, lastStart: 0, lastSync: 0, lastFull: 0 });
});

test('a version-1 cache keeps its runs and loses the Local Legends data', () => {
  const v1 = { v: 1, athlete: { id: 42, units: 'mi' }, acts: { a1: { s: 5, d: iso(3), m: 5000, v: 'everyone' } },
    det: { a1: 1 }, eff: { 9: [[iso(3), 'a1']] }, seg: { 9: { n: 'Invented Hill', m: 800 } }, lastStart: 5, lastSync: 123, lastFull: 77 };
  globalThis.localStorage = storage({ 'lw.cache.42': v1 });
  try {
    const c = loadCache(42);
    assert.equal(c.v, 2);
    assert.deepEqual(c.acts, v1.acts);
    assert.deepEqual([c.athlete.id, c.lastStart, c.lastSync, c.lastFull], [42, 5, 123, 77]);
    for (const k of ['det', 'eff', 'seg']) assert.ok(!(k in c), `${k} is gone`);
  } finally { delete globalThis.localStorage; }
});

test('a version-2 cache is read as it is; anything else starts empty', () => {
  const v2 = { ...emptyCache(), lastSync: 456 };
  globalThis.localStorage = storage({ 'lw.cache.42': v2, 'lw.cache.7': { v: 3, acts: { x: 1 } }, 'lw.cache.8': { v: 1 } });
  try {
    assert.equal(loadCache(42).lastSync, 456);
    assert.deepEqual(loadCache(99), emptyCache());   // nothing stored
    assert.deepEqual(loadCache(7), emptyCache());    // a version this code does not know
    assert.deepEqual(loadCache(8).acts, {});         // a damaged version-1 cache still gets its runs map
  } finally { delete globalThis.localStorage; }
});

test('miles() follows the units setting', () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    for (const athleteUnits of ['mi', 'km']) {
      const c = emptyCache(); c.athlete = { id: 1, units: athleteUnits };
      c.acts.r1 = { s: 0, d: iso(0), m: 5000 };
      setUnits('km');
      let m = miles(c); assert.equal(m.unit, 'km'); assert.equal(m.today, 5);
      setUnits('mi');
      m = miles(c); assert.equal(m.unit, 'mi'); assert.ok(Math.abs(m.today - 3.1069) < 0.001);
    }
  } finally { delete globalThis.localStorage; }
});

test('the demo cache has runs back to last year and nothing else', () => {
  const c = demoCache();
  assert.equal(c.v, 2);
  assert.ok(Object.keys(c.acts).length > 100);
  assert.deepEqual(Object.keys(c).sort(), Object.keys(emptyCache()).sort());
  const m = miles(c);
  assert.ok(m.ytd > 0 && m.hasLastYear);
});

test("the week's seven daily sums", () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    setUnits('km');
    const t0 = todayIdx(); const ws = weekStart(t0); const dow = t0 - ws;
    const at = (di) => `${new Date(di * DAY).toISOString().slice(0, 10)}T07:00:00Z`;
    const c = emptyCache(); c.athlete = { id: 1, units: 'km' };
    c.acts.first = { s: 0, d: at(ws), m: 5000 };
    c.acts.now = { s: 0, d: at(t0), m: 3000 };
    if (dow < 6) c.acts.later = { s: 0, d: at(t0 + 1), m: 8000 };
    const m = miles(c);
    assert.equal(m.dow, dow);
    assert.equal(m.days.length, 7);
    // On a Monday the first day is today, so it holds both runs. Tomorrow's run is never counted.
    assert.equal(m.days[0], dow === 0 ? 8 : 5);
    assert.equal(m.days[dow], dow === 0 ? 8 : 3);
    assert.deepEqual(m.days.slice(dow + 1), new Array(6 - dow).fill(0));
    assert.equal(m.days.reduce((s, v) => s + v, 0), m.week);
  } finally { delete globalThis.localStorage; }
});
