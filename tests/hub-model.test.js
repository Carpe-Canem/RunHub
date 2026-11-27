import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt0 } from '../js/core.js';
import { NOTHING_ON, startText, timeText, weekTile, yearTile, weekStrip, rowNotes } from '../js/hub-model.js';

const utc = (y, m, d) => Date.UTC(y, m - 1, d) / 864e5;
const MI = { unit: 'mi', week: 5.0, weekAvg: 20.7, ytd: 1098, lytd: 1121, hasLastYear: true, runsWeek: 2,
  ws: utc(2026, 11, 23), dow: 3, days: [0, 3.1, 0, 1.9, 0, 0, 0] };
const plain = (s) => s.replace(/\s/g, ' ');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not close to ${b}`);
const week = (over) => weekTile({ ...MI, ...over });
const year = (over) => yearTile({ ...MI, ...over });
const strip = (over) => weekStrip({ ...MI, ...over }, 'en-US');

test('this week, under the usual', () => {
  const { meter, ...rest } = week({});
  assert.deepEqual(rest, { value: '5.0', unit: 'mi', line: 'of your usual 20.7', tone: null });
  near(meter, 5 / 20.7);
});

test('this week, over', () => {
  const t = week({ week: 22.4 });
  assert.deepEqual([t.line, t.tone, t.meter], ['1.7 over your usual', 'go', 1]);
});

test('this week, a difference that rounds to nothing is not over', () => {
  const t = week({ week: 20.74 });
  assert.deepEqual([t.line, t.tone, t.meter], ['of your usual 20.7', null, 1]);
});

test('this week, no usual yet', () => {
  const t = week({ weekAvg: 0 });
  assert.deepEqual([t.line, t.tone, t.meter], ['', null, null]);
});

test('this year, behind', () => {
  const t = year({});
  assert.deepEqual([t.value, t.unit, t.line, t.tone], [fmt0(1098), 'mi', '23 behind last year', 'slow']);
  near(t.meter, 1098 / 1121);
});

test('this year, ahead', () => {
  const t = year({ lytd: 1075 });
  assert.deepEqual([t.line, t.tone, t.meter], ['23 ahead of last year', 'go', 1]);
});

test('this year, level', () => {
  const t = year({ lytd: 1098.3 });
  assert.deepEqual([t.line, t.tone], ['level with last year', null]);
});

test('this year, nothing to compare', () => {
  const t = year({ hasLastYear: false, lytd: 0 });
  assert.deepEqual([t.line, t.tone, t.meter], ['', null, null]);
});

test("this year, last year started later than today's date", () => {
  const t = year({ lytd: 0 });
  assert.deepEqual([t.line, t.meter], [`${fmt0(1098)} ahead of last year`, 1]);
  assert.equal(year({ lytd: 0, ytd: 0 }).meter, null);
});

test('still loading', () => {
  const empty = { value: '–', unit: '', line: '', tone: null, meter: null };
  assert.deepEqual(weekTile(null), empty);
  assert.deepEqual(yearTile(null), empty);
});

test('the strip', () => {
  const s = strip({});
  assert.equal(plain(s.range), 'Nov 23 – 29');
  assert.equal(s.runs, '2 runs');
  assert.deepEqual(s.days.map((d) => d.letter), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(s.days.map((d) => d.text), ['–', '3.1', '–', '1.9', '', '', '']);
  assert.deepEqual(s.days.map((d) => d.today), [false, false, false, true, false, false, false]);
  assert.deepEqual(s.days.map((d) => d.fill), [0, 1, 0, 1.9 / 3.1, 0, 0, 0]);
  assert.equal(s.label, 'This week: Tuesday 3.1 mi, Thursday 1.9 mi');
});

test('the strip: today with no run yet shows nothing, not a dash', () => {
  assert.equal(strip({ dow: 4 }).days[4].text, '');
});

test('the strip: one run, no runs', () => {
  assert.equal(strip({ runsWeek: 1 }).runs, '1 run');
  const none = strip({ runsWeek: 0, days: [0, 0, 0, 0, 0, 0, 0] });
  assert.equal(none.runs, '');
  assert.deepEqual(none.days.map((d) => d.fill), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(none.label, 'This week: no runs yet');
});

test('the strip: on a Monday no day is past', () => {
  const s = strip({ dow: 0, runsWeek: 0, days: [0, 0, 0, 0, 0, 0, 0] });
  assert.deepEqual(s.days.map((d) => d.text), ['', '', '', '', '', '', '']);
  assert.deepEqual(s.days.map((d) => d.today), [true, false, false, false, false, false, false]);
});

test('the strip: a week across a month and a year', () => {
  assert.equal(plain(strip({ ws: utc(2026, 11, 30) }).range), 'Nov 30 – Dec 6');
  const range = plain(strip({ ws: utc(2026, 12, 28) }).range);
  assert.match(range, /Dec 28/);
  assert.match(range, /Jan 3/);
});

test('the strip in km', () => {
  assert.match(strip({ unit: 'km' }).label, /3\.1 km/);
});

const six = [1, 2, 3, 4, 5, 6];
const STATS = { count: 20, podiums: 2, latest: [{ n: 'Orchard 5K', t: 1262 }], records: six };

test('row notes', () => {
  assert.deepEqual(rowNotes(MI, STATS), { weeks: 'avg 20.7 mi', latest: '21:02, Orchard 5K', records: '6 distances' });
  assert.equal(rowNotes(MI, { ...STATS, records: [1] }).records, '1 distance');
  assert.equal(rowNotes(MI, { ...STATS, latest: [{ n: 'Orchard 5K', t: 0 }] }).latest, 'Orchard 5K');
});

test('row notes: nothing loaded, and no races', () => {
  assert.deepEqual(rowNotes(null, null), { weeks: '', latest: '', records: '' });
  const none = rowNotes(MI, { count: 0, podiums: 0, latest: [], records: [] });
  assert.deepEqual([none.latest, none.records], ['No races yet', 'No races yet']);
  assert.equal(rowNotes(MI, { ...STATS, records: [] }).records, 'No records yet');
});

test('next start: day, time and place without dot separators; the year only when it is not this one', () => {
  const now = new Date(2026, 10, 27);
  assert.equal(startText({ date: '2026-12-12', time: '08:00', place: 'Harbor City' }, now, 'en-US'), 'Sat, Dec 12, 8:00 AM, Harbor City');
  assert.equal(startText({ date: '2026-12-12' }, now, 'en-US'), 'Sat, Dec 12');
  assert.equal(startText({ date: '2027-01-09', time: '' }, now, 'en-US'), 'Sat, Jan 9, 2027');
  assert.equal(startText({ date: 'soon' }, now, 'en-US'), '');
  assert.equal(NOTHING_ON, 'Nothing on the calendar.');
});

test('a start time on its own, empty without a valid one', () => {
  assert.equal(plain(timeText({ date: '2026-12-12', time: '08:00' }, 'en-US')), '8:00 AM');
  for (const time of [undefined, null, '', '8 am']) assert.equal(timeText({ date: '2026-12-12', time }, 'en-US'), '');
});
