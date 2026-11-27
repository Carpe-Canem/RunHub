import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoRaces, demoUpcoming } from '../js/races-demo.js';
import { buildRaces } from '../js/races-model.js';
import { STANDARDS } from '../js/race-rules.js';
import { todayIdx, DAY } from '../js/core.js';

test('demo races cover every case the spec names', () => {
  const d = demoRaces();
  assert.equal(Object.keys(d.races.races).length, 20);
  assert.equal(d.races.scan.done, true);
  assert.ok(d.races.lastScan > 0);
  const m = buildRaces(d.races.races, d.det, 'mi');
  for (const cls of ['5K', '10K', 'Half']) assert.ok(m.rows.some((r) => r.cls === cls && r.record), `record in ${cls}`);
  assert.ok(m.rows.some((r) => r.short));
  assert.ok(m.rows.some((r) => r.pts === null && r.ll === null));
  assert.ok(m.rows.some((r) => r.virtual));
  assert.ok(m.rows.some((r) => r.others.length === 2));
  assert.ok(m.rows.some((r) => !STANDARDS.some((s) => s.cls === r.cls) && r.cls !== 'Other'));
  assert.ok(m.rows.some((r) => r.from === 'gps'));
  assert.ok(m.rows.some((r) => r.ag >= 1 && r.ag <= 3));
  const newest = Date.parse(m.rows[0].d + 'Z') / DAY;
  assert.ok(todayIdx() - newest <= 60 && newest <= todayIdx() + 1);
});

test('demo race data is complete and consistent', () => {
  const d = demoRaces();
  for (const s of Object.values(d.races.races)) {
    assert.equal(s.p, null);
    assert.equal(s.s, Date.parse(s.d + 'Z') / 1000);
    const dt = d.det[s.id];
    assert.ok(dt && dt.sp.mi.length && dt.sp.km.length, 'splits for both units');
    if (s.pts) { assert.equal(dt.prof.length, 80); assert.ok(s.ll); } else assert.ok(!dt.prof);
  }
});

test('demo race names are invented', () => {
  const place = '(?:Riverbend|Frostbite|Canyon|Library Hill|Turkey Trot|Creekside|Orchard|Old Mill|Water Tower|Rail Trail)';
  const tok = '(?:[0-9]+K|[0-9]+ Miler|Mile|Half Marathon|Marathon|(?:19|20)[0-9]{2})';
  const re = new RegExp(`^${place}(?: ${tok})*$`);
  for (const s of Object.values(demoRaces().races.races)) assert.match(s.n, re);
});

test('demo weather and places', async () => {
  const { pointKey } = await import('../js/places.js');
  const d = demoRaces();
  const words = ['Riverbend', 'Frostbite', 'Canyon', 'Library Hill', 'Creekside', 'Orchard', 'Old Mill', 'Water Tower', 'Rail Trail'];
  for (const r of Object.values(d.races.races)) {
    const w = d.env.wx[r.id];
    if (r.ll) { assert.ok(w && w.prov === false && typeof w.t === 'number' && w.at, r.id); assert.ok(d.env.pl[pointKey(r.ll)], r.id); }
    else assert.equal(w, undefined);
  }
  const names = Object.values(d.env.pl);
  assert.ok(names.length > 0);
  for (const p of names) { assert.match(p.n, /^.+, CO$/); assert.ok(words.includes(p.n.slice(0, -4)), p.n); }
});

test('demoUpcoming has one bio race and one hand race with a time and place, both ahead of today, named from the demo words', () => {
  const u = demoUpcoming();
  assert.equal(u.v, 1);
  const today = new Date(todayIdx() * DAY).toISOString().slice(0, 10);
  assert.equal(u.bio.races.length, 1);
  assert.equal(u.hand.length, 1);
  const [b] = u.bio.races, [h] = u.hand;
  assert.ok(b.date > today && h.date > today);
  assert.ok(h.time && h.place);
  assert.equal(b.n, 'Riverbend Half Marathon');
  assert.equal(h.n, 'Orchard 10K');
  assert.equal(b.date, new Date((todayIdx() + 40) * DAY).toISOString().slice(0, 10));
  assert.equal(h.date, new Date((todayIdx() + 9) * DAY).toISOString().slice(0, 10));
});
