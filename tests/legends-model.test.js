import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayIdx, DAY, setUnits } from '../js/core.js';
import { emptyCache, loadCache, legendCount, compute, riskSummary, decodePolyline, miles } from '../js/legends-model.js';

const iso = (daysAgo) => `${new Date((todayIdx() - daysAgo) * DAY).toISOString().slice(0, 10)}T07:00:00Z`;
function fixture() {
  const c = emptyCache(); c.athlete = { id: 42, units: 'mi' };
  const act = (id, daysAgo, v = 'everyone') => { c.acts[id] = { s: 0, d: iso(daysAgo), m: 5000, v }; };
  act('a1', 88); act('a2', 10); act('a3', 5); act('p1', 4, 'only_me');
  c.eff = { held: [[iso(88), 'a1'], [iso(10), 'a2'], [iso(5), 'a3'], [iso(4), 'p1']],
            reach: [[iso(10), 'a2'], [iso(5), 'a3']], behind: [[iso(5), 'a3']], pending: [[iso(5), 'a3']], unknown: [[iso(5), 'a3']] };
  c.seg = { held: { n: 'Held Hill', at: 1, ll: { id: 42, n: 3 } }, reach: { n: 'Reach Ridge', at: 1, ll: { id: 7, n: 4 } },
            behind: { n: 'Far Flat', at: 1, ll: { id: 7, n: 9 } }, pending: { n: 'Pending Path' }, unknown: { n: 'No Legend Lane', at: 1, ll: null } };
  return c;
}
const byId = (m, id) => m.rows.find((r) => r.id === id);

test('compute classifies each segment', () => {
  const m = compute(fixture());
  assert.deepEqual([byId(m, 'held').status, byId(m, 'held').mine, byId(m, 'held').all], ['held', 3, 4]);  // the private run counts in all, not mine
  assert.deepEqual([byId(m, 'held').e7, byId(m, 'held').risk], [1, true]);                                // the 88-day-old effort drops within 7 days
  assert.deepEqual([byId(m, 'reach').status, byId(m, 'reach').gap, byId(m, 'reach').need], ['reach', 2, 3]);
  assert.deepEqual([byId(m, 'behind').status, byId(m, 'behind').gap], ['behind', 8]);
  assert.equal(byId(m, 'pending').status, 'pending'); assert.equal(byId(m, 'unknown').status, 'unknown');
  assert.equal(m.risk.length, 1); assert.equal(m.pending, 1);
});
test('riskSummary wording', () => {
  assert.deepEqual(riskSummary(compute(emptyCache())), { count: 0, sub: 'No public runs on segments in the last 90 days yet', loading: false });
  const s = riskSummary(compute(fixture()));
  assert.equal(s.count, 1); assert.match(s.sub, /^Held Hill loses 1 effort this week/);
});
test('legendCount reads every shape Strava has used', () => {
  assert.equal(legendCount({ effort_counts: { overall: '1,204 efforts' } }), 1204);
  assert.equal(legendCount({ effort_count: '200' }), 200);
  assert.equal(legendCount({ effort_description: '12 efforts' }), 12);
  assert.equal(legendCount({ effort_count: 7 }), 7);
  assert.equal(legendCount({}), null);
});
test('decodePolyline', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});
test('an existing version-1 cache is still read after the upgrade', () => {
  const saved = { ...emptyCache(), lastSync: 123 };
  globalThis.localStorage = { getItem: (k) => (k === 'lw.cache.42' ? JSON.stringify(saved) : null), setItem() {}, removeItem() {} };
  assert.equal(loadCache(42).lastSync, 123);
  assert.equal(loadCache(99).lastSync, 0);
  delete globalThis.localStorage;
});

test('miles() follows the units setting', () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    for (const athleteUnits of ['mi', 'km']) {
      const c = emptyCache(); c.athlete = { id: 1, units: athleteUnits };
      c.acts.r1 = { s: 0, d: iso(0), m: 5000, v: 'everyone' };
      setUnits('km');
      let m = miles(c); assert.equal(m.unit, 'km'); assert.equal(m.today, 5);
      setUnits('mi');
      m = miles(c); assert.equal(m.unit, 'mi'); assert.ok(Math.abs(m.today - 3.1069) < 0.001);
    }
  } finally { delete globalThis.localStorage; }
});
