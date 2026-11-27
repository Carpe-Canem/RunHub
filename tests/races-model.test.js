import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRace, summaryFrom, detailFrom, reduceProfile, buildRaces, contextLine, chips, paceTrend, fmtTime, fmtPace, fmtDist } from '../js/races-model.js';

const S = (id, n, d, t, m, extra = {}) => ({ id, n, d, s: 0, t, m, el: 0, ll: [1, 2], p: 'a', st: 'Run', se: null, pr: null, ach: null, hr: null, ...extra });
const sums = {
  r1: S('r1', 'Riverbend 10K', '2023-05-01T08:00:00', 2400, 10050),
  r2: S('r2', 'Riverbend 10K 2024', '2024-05-01T08:00:00', 2527, 10100),
  r3: S('r3', 'Riverbend 10K', '2025-05-01T08:00:00', 2442, 10020),
  m1: S('m1', 'Frostbite 5 Miler', '2024-02-01T09:00:00', 2000, 7400),
  v1: S('v1', 'Lockdown 5K', '2024-06-01T09:00:00', 1100, 5000, { st: 'VirtualRun' }),
  k1: S('k1', 'City 5K', '2024-07-01T09:00:00', 1300, 5010),
  t1: S('t1', 'Turkey Trot', '2024-11-28T09:00:00', 1500, 0, { p: null, ll: null }),
  ny: S('ny', 'Resolution Run', '2025-01-01T00:20:00', 1500, 5000),
};
const model = () => buildRaces(sums, {}, 'mi');

test('isRace', () => {
  assert.equal(isRace({ type: 'Run', workout_type: 1 }), true);
  assert.equal(isRace({ type: 'Run', workout_type: 0 }), false);
  assert.equal(isRace({ type: 'Run', workout_type: 3 }), false);
  assert.equal(isRace({ type: 'Ride', workout_type: 1 }), false);
  assert.equal(isRace({ sport_type: 'TrailRun', type: 'Run', workout_type: 1 }), true);
});
test('summaryFrom maps fields', () => {
  const s = summaryFrom({ id: 9, name: 'X 5K', start_date_local: '2025-01-01T00:20:00Z', elapsed_time: 1500, distance: 5000, total_elevation_gain: 12, start_latlng: [1, 2], map: { summary_polyline: 'abc' }, sport_type: 'Run', suffer_score: 30, pr_count: 1, achievement_count: 2, average_heartrate: 150, max_heartrate: 170 });
  assert.deepEqual(s, { id: '9', n: 'X 5K', d: '2025-01-01T00:20:00Z', s: s.s, t: 1500, m: 5000, el: 12, ll: [1, 2], p: 'abc', st: 'Run', se: 30, pr: 1, ach: 2, hr: [150, 170] });
  const e = summaryFrom({ id: 1, start_latlng: [], map: {}, type: 'Run' });
  assert.equal(e.ll, null); assert.equal(e.p, null); assert.equal(e.hr, null);
});
test('detailFrom keeps ag, drops description', () => {
  const d = detailFrom({ description: 'Great day, 2nd in age group', sport_type: 'Run', calories: 600, splits_standard: [{ distance: 1609, elapsed_time: 400, elevation_difference: 2 }], splits_metric: [] });
  assert.equal(d.ag, 2); assert.equal(d.virt, false); assert.equal(d.cal, 600);
  assert.deepEqual(d.sp, { mi: [[1609, 400, 2]], km: [] });
  assert.equal(typeof d.at, 'number'); assert.equal('description' in d, false);
  assert.equal(detailFrom({ description: 'virtual race' }).virt, true);
});
test('reduceProfile', () => {
  const dist = Array.from({ length: 1000 }, (_, i) => i), alt = dist.map((i) => i * 2);
  const r = reduceProfile(dist, alt, 80);
  assert.equal(r.length, 80); assert.deepEqual(r[0], [0, 0]); assert.deepEqual(r[79], [999, 1998]);
  assert.equal(reduceProfile([1, 2], [3, 4], 80).length, 2);
});
test('records and gaps', () => {
  const m = model();
  assert.equal(m.records['10K'], 'r1');
  assert.equal(m.byId.r1.record, true); assert.equal(m.byId.r1.gap, null);
  assert.equal(m.byId.r2.gap, 127); assert.ok(m.byId.r3.gap > 0);
  assert.notEqual(m.records['5K'], 'v1');
  assert.equal(m.records['5K'], 'k1');
});
test('short race', () => {
  const r = model().byId.m1;
  assert.equal(r.short, true); assert.equal(r.cls, '5 mi'); assert.equal(r.record, false);
});
test('virtual race still gets a gap', () => {
  const r = model().byId.v1;
  assert.equal(r.virtual, true); assert.equal(r.record, false); assert.equal(typeof r.gap, 'number');
});
test('no distance', () => {
  const r = model().byId.t1;
  assert.equal(r.pace, null); assert.equal(r.short, false); assert.equal(r.pts, null);
});
test('local dates', () => {
  const r = model().byId.ny;
  assert.equal(r.year, '2025'); assert.equal(r.date, '2025-01-01'); assert.equal(r.time, '00:20');
});
test('series, newest first, rows newest first', () => {
  const m = model();
  assert.deepEqual(m.byId.r1.others, ['r3', 'r2']);
  assert.deepEqual(m.byId.r3.others, ['r2', 'r1']);
  assert.equal(m.rows[0].id, 'r3'); assert.equal(m.byId.r1.key, 'riverbend');
});
test('missing detail and ag', () => {
  const m = buildRaces(sums, { r1: { missing: true }, r2: { at: 1, ag: 3, virt: false, cal: null, sp: { mi: [], km: [] } }, r3: { at: 1, ag: null, virt: true, cal: null, sp: { mi: [], km: [] } } }, 'mi');
  assert.equal(m.byId.r1.det, null); assert.equal(m.byId.r2.ag, 3); assert.equal(m.byId.r1.ag, null);
  assert.equal(m.byId.r3.virtual, true); assert.equal(m.records['10K'], 'r1');
});
test('pts from summary when no polyline', () => {
  const m = buildRaces({ a: S('a', 'X 5K', '2024-01-01T08:00:00', 1500, 5000, { p: null, pts: [[1, 2]] }) }, {}, 'km');
  assert.deepEqual(m.byId.a.pts, [[1, 2]]);
});
test('pace per unit', () => {
  assert.ok(Math.abs(model().byId.r1.pace - 2400 / (10000 / 1609.344)) < 1e-9);
  assert.ok(Math.abs(buildRaces(sums, {}, 'km').byId.r1.pace - 240) < 1e-9);
});
test('contextLine', () => {
  const m = model();
  assert.equal(contextLine(m.byId.r1, m), 'Personal record');
  assert.equal(contextLine({ ...m.byId.r1, record: false, gap: 42 }, m), '+0:42 off your 10K record');
  assert.equal(contextLine(m.byId.m1, m), 'Course ran short');
  assert.equal(contextLine(m.byId.v1, m), 'Virtual race, not counted for records');
  assert.equal(contextLine(m.byId.t1, m), '');
});
test('chips', () => {
  const m = model(), c = chips(m);
  assert.equal(c[0].label, 'All'); assert.equal(c[0].count, 8);
  assert.equal(c.slice(1).reduce((a, x) => a + x.count, 0), 8);
  assert.equal(c[1].label, '5K');
  assert.equal(c.at(-1).label, 'Other');
});
test('classes ordering', () => {
  const m = model();
  assert.deepEqual(m.classes.map((x) => x.cls), ['5K', '10K', '5 mi', 'Other']);
});
test('paceTrend', () => {
  const t = paceTrend(model(), '10K');
  assert.deepEqual(t.map((p) => p.id), ['r1', 'r2', 'r3']);
  assert.equal(t.filter((p) => p.record).length, 1);
  assert.equal(paceTrend(model(), '5K').some((p) => p.id === 'v1'), false);
});
test('formatters', () => {
  assert.equal(fmtTime(2527), '42:07'); assert.equal(fmtTime(3753), '1:02:33');
  assert.equal(fmtPace(null, 'mi'), '–'); assert.equal(fmtPace(407, 'mi'), '6:47 /mi');
  assert.equal(fmtDist(10000, 'km'), '10.00 km'); assert.equal(fmtDist(10000, 'mi'), '6.21 mi');
});

test('a race with no time (0 or missing) never wins its class record', () => {
  const m = buildRaces({
    a: S('a', 'Riverbend 10K', '2024-05-01T08:00:00', 0, 10000),
    b: S('b', 'Riverbend 10K', '2023-05-01T08:00:00', 2500, 10000),
    c: S('c', 'Riverbend 10K', '2022-05-01T08:00:00', undefined, 10000),
  }, {}, 'mi');
  assert.equal(m.records['10K'], 'b');
  assert.equal(m.byId.a.record, false);
  assert.equal(m.byId.c.record, false);
  assert.equal(m.byId.a.gap, null);   // no "+-41:40 off your record"
});
