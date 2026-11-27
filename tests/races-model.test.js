import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRace, summaryFrom, detailFrom, reduceProfile, buildRaces, contextLine, chips, paceTrend, fmtTime, fmtPace, fmtDist, hubStats } from '../js/races-model.js';

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

test('buildRaces joins weather by race id and the place by rounded start point', () => {
  const two = { r1: S('r1', 'A 5K', '2024-01-01T08:00:00', 1500, 5000, { ll: [10.123, 20.456] }),
    r2: S('r2', 'B 5K', '2024-02-01T08:00:00', 1500, 5000, { ll: null }),
    r3: S('r3', 'C 5K', '2024-03-01T08:00:00', 1500, 5000, { ll: [30.5, 40.5] }),
    r4: S('r4', 'D 5K', '2024-04-01T08:00:00', 1500, 5000, { ll: [50.5, 60.5] }) };
  const wx = { r1: { t: 12, f: 11, h: 50, w: 9, p: 0, c: null, at: 5, prov: false }, r2: { t: 1, f: 1, h: 1, w: 1, p: 0, c: 1, at: 5, prov: false }, r4: { at: 9, none: true } };
  const pl = { '10.12,20.46': { n: 'Riverbend, CO', at: 1 }, '30.5,40.5': { n: null, at: 1 }, '50.5,60.5': { n: 'Orchard, CO', at: 1 } };
  const m = buildRaces(two, {}, 'mi', { wx, pl });
  assert.equal(m.byId.r1.wx.t, 12);
  assert.equal(m.byId.r1.place, 'Riverbend, CO');
  assert.equal(m.byId.r2.place, null);          // no start point
  assert.equal(m.byId.r3.place, null);          // {n: null}
  assert.equal(m.byId.r3.wx, null);
  assert.equal(m.byId.r4.wx, null);             // none: true is no weather (Ruling A)
  const bare = buildRaces(two, {}, 'mi');
  assert.equal(bare.byId.r1.wx, null);
  assert.equal(bare.byId.r1.place, null);
});

test('weather stays metric in the model whatever the unit', () => {
  const one = { r1: S('r1', 'A 5K', '2024-01-01T08:00:00', 1500, 5000) };
  const env = { wx: { r1: { t: 12, f: 11, h: 50, w: 9, p: 0, c: null, at: 5, prov: false } }, pl: {} };
  assert.equal(buildRaces(one, {}, 'km', env).rows[0].wx.t, buildRaces(one, {}, 'mi', env).rows[0].wx.t);
});

test('hubStats counts races, podiums and official distance, and lists the latest ten and the records in class order', () => {
  const list = {
    a1: S('a1', 'Riverbend 10K', '2027-06-12T08:00:00', 2500, 10020),
    a2: S('a2', 'Frostbite 5K', '2027-06-11T08:00:00', 1300, 5010),
    a3: S('a3', 'Canyon Half Marathon', '2027-06-10T08:00:00', 5600, 21150),
    a4: S('a4', 'Library Hill Mile', '2027-06-09T08:00:00', 380, 1610),
    a5: S('a5', 'Creekside 5 Miler', '2027-06-08T08:00:00', 2200, 7000),   // short course
    a6: S('a6', 'Orchard Trail Run', '2027-06-07T08:00:00', 3000, 12345),   // class Other, GPS distance
    a7: S('a7', 'Old Mill 5K', '2027-06-06T08:00:00', 1250, 5000),
    a8: S('a8', 'Water Tower 10K', '2027-06-05T08:00:00', 2450, 10000),
    a9: S('a9', 'Rail Trail Marathon', '2027-06-04T08:00:00', 12000, 42300),
    b1: S('b1', 'Riverbend 15K', '2027-06-03T08:00:00', 3900, 15010),
    b2: S('b2', 'Frostbite 10 Mile', '2027-06-02T08:00:00', 4300, 16100),
    b3: S('b3', 'Canyon 5K', '2027-06-01T08:00:00', 1280, 4990),
  };
  const ag = (n) => ({ at: 1, ag: n, virt: false, cal: null, sp: { mi: [], km: [] } });
  const m = buildRaces(list, { a1: ag(1), a2: ag(3), a3: ag(4), a7: ag(null) }, 'mi');
  const st = hubStats(m);
  assert.equal(st.count, 12);
  assert.equal(st.podiums, 2);
  assert.equal(st.metres, m.rows.reduce((t, r) => t + r.official, 0));
  assert.ok(st.metres > 0 && Math.abs(m.byId.a6.official - 12345) < 1e-9);
  assert.deepEqual(st.latest.map((r) => r.id), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'b1']);
  assert.deepEqual(st.records.map((r) => r.cls), ['1 mi', '5K', '10K', '15K', '10 mi', 'Half', 'Marathon']);
  assert.deepEqual(st.records.map((r) => r.id), ['a4', 'a7', 'a8', 'b1', 'b2', 'a3', 'a9']);
});

test('hubStats of a model with no rows is zeros and empty lists', () => {
  assert.deepEqual(hubStats(buildRaces({}, {}, 'mi')), { count: 0, podiums: 0, metres: 0, latest: [], records: [] });
});

test('hubStats orders a class outside the standards after them, by name', () => {
  const m = buildRaces({
    x: S('x', 'Canyon 25K', '2027-06-01T08:00:00', 8000, 25100),
    y: S('y', 'Orchard 12K', '2027-06-02T08:00:00', 3600, 12010),
    z: S('z', 'Orchard 5K', '2027-06-03T08:00:00', 1300, 5000),
  }, {}, 'km');
  assert.deepEqual(hubStats(m).records.map((r) => r.cls), ['5K', '12K', '25K']);
});
