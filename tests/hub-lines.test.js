import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLines, mileLines, raceLines, nextParts, startText, NOTHING_ON } from '../js/hub-lines.js';

const say = (line) => line.parts.map((p) => (p.led != null ? p.led : p.text)).join('');
const tones = (line) => line.parts.filter((p) => p.tone).map((p) => [p.text, p.tone]);
const leds = (line) => line.parts.filter((p) => p.led != null).map((p) => p.led);
const MI = { unit: 'mi', week: 18.2, weekAvg: 15.1, ytd: 842.4, lytd: 781, hasLastYear: true };
const race = (over) => ({ id: 7, n: 'Turkey Trot 5K', t: 1361, cls: '5K', record: false, ...over });
const stats = (over) => ({ count: 31, podiums: 4, latest: [race()], ...over });
const byKey = (lines) => Object.fromEntries(lines.map((l) => [l.key, l]));

test('week: over the 12-week average says by how much', () => {
  const l = byKey(mileLines(MI)).week;
  assert.equal(say(l), "18.2 miles this week. That's 3.1 over your usual.");
  assert.deepEqual(leds(l), ['18.2']);
  assert.deepEqual(tones(l), [['3.1 over', 'go']]);
});

test('week: at or under the average states the usual week and never says "behind"', () => {
  for (const week of [15.1, 4, 0]) {
    const text = say(byKey(mileLines({ ...MI, week })).week);
    assert.match(text, / miles this week\. Your usual week is 15\.1\.$/);
    assert.doesNotMatch(text, /behind|under|short/);
  }
});

test('week: a difference that rounds to nothing is not "over"', () => {
  assert.equal(say(byKey(mileLines({ ...MI, week: 15.14, weekAvg: 15.1 })).week), '15.1 miles this week. Your usual week is 15.1.');
});

test('week: with no usual week yet, just the week', () => {
  assert.equal(say(byKey(mileLines({ ...MI, week: 3, weekAvg: 0 })).week), '3.0 miles this week.');
});

test('year: ahead of this date last year', () => {
  const l = byKey(mileLines(MI)).year;
  assert.equal(say(l), '842 miles this year, 61 ahead of this date last year.');
  assert.deepEqual(tones(l), [['61 ahead', 'go']]);
});

test('year: behind this date last year', () => {
  const l = byKey(mileLines({ ...MI, ytd: 700 })).year;
  assert.equal(say(l), '700 miles this year, 81 behind this date last year.');
  assert.deepEqual(tones(l), [['81 behind', 'slow']]);
});

test('year: level, and with no runs last year just the total', () => {
  assert.equal(say(byKey(mileLines({ ...MI, ytd: 781.2 })).year), '781 miles this year, level with this date last year.');
  assert.equal(say(byKey(mileLines({ ...MI, hasLastYear: false, lytd: 0 })).year), '842 miles this year.');
});

test('kilometres are named as km, and the units argument is used when the mileage has none', () => {
  assert.match(say(byKey(mileLines({ ...MI, unit: 'km' })).week), /^18\.2 km this week\./);
  const { unit, ...bare } = MI;
  assert.match(say(byKey(hubLines({ mi: bare, stats: stats(), units: 'km' })).year), /^842 km this year/);
});

test('last out: the newest finished race, linking to it', () => {
  const l = byKey(raceLines(stats())).last;
  assert.equal(say(l), 'Last out: Turkey Trot 5K in 22:41.');
  assert.equal(l.href, '#race/7');
  assert.deepEqual(leds(l), ['22:41']);
});

test('last out: "fastest yet" only when it is that class\'s record', () => {
  const l = byKey(raceLines(stats({ latest: [race({ record: true })] }))).last;
  assert.equal(say(l), 'Last out: Turkey Trot 5K in 22:41. Your fastest 5K yet.');
  assert.deepEqual(tones(l), [['Your fastest 5K yet.', 'go']]);
});

test('last out: a race with no name or no time still reads as a sentence', () => {
  assert.equal(say(byKey(raceLines(stats({ latest: [race({ n: '' })] }))).last), 'Last out: a race in 22:41.');
  assert.equal(say(byKey(raceLines(stats({ latest: [race({ t: 0 })] }))).last), 'Last out: Turkey Trot 5K.');
});

test('totals: link to Races; the podium clause only when there is one', () => {
  const l = byKey(raceLines(stats())).totals;
  assert.equal(say(l), '31 races finished, 4 on an age-group podium.');
  assert.equal(l.href, '#races');
  assert.equal(say(byKey(raceLines(stats({ podiums: 0 }))).totals), '31 races finished.');
  assert.equal(say(byKey(raceLines(stats({ count: 1, podiums: 1 }))).totals), '1 race finished, 1 on an age-group podium.');
});

test('loading and empty', () => {
  assert.deepEqual(mileLines(null).map(say), ['Loading your runs from Strava.']);
  assert.deepEqual(raceLines(null).map(say), ['Loading your race history.']);
  const none = raceLines(stats({ count: 0, podiums: 0, latest: [] }));
  assert.deepEqual(none.map(say), ['No races yet.']);
  assert.equal(none[0].key, 'none');
  assert.equal(NOTHING_ON, 'Nothing on the calendar.');
});

test('hubLines: mileage first, then races, in reading order', () => {
  assert.deepEqual(hubLines({ mi: MI, stats: stats(), units: 'mi' }).map((l) => l.key), ['week', 'year', 'last', 'totals']);
  assert.deepEqual(hubLines({ mi: null, stats: null, units: 'mi' }).map(say), ['Loading your runs from Strava.', 'Loading your race history.']);
});

test('next start: the sentence under the clock', () => {
  const text = (parts) => parts.map((p) => p.text).join('');
  assert.equal(text(nextParts({ n: 'Harbor 10K' }, 'clock')), 'to Harbor 10K.');
  assert.equal(text(nextParts({ n: 'Harbor 10K' }, 'today')), 'at Harbor 10K.');
  assert.equal(text(nextParts({ n: 'Is it on?' }, 'clock')), 'to Is it on?');
});

test('next start: day, time and place without dot separators; the year only when it is not this one', () => {
  const now = new Date(2026, 10, 27);
  assert.equal(startText({ date: '2026-12-12', time: '08:00', place: 'Harbor City' }, now, 'en-US'), 'Sat, Dec 12, 8:00 AM, Harbor City');
  assert.equal(startText({ date: '2026-12-12' }, now, 'en-US'), 'Sat, Dec 12');
  assert.equal(startText({ date: '2027-01-09', time: '' }, now, 'en-US'), 'Sat, Jan 9, 2027');
  assert.equal(startText({ date: 'soon' }, now, 'en-US'), '');
});

test('last out: a name that ends in a full stop does not get a second one', () => {
  const last = (over) => say(Object.fromEntries(raceLines(stats({ latest: [race(over)] })).map((l) => [l.key, l])).last);
  assert.equal(last({ n: 'Run the Mile.', t: 0 }), 'Last out: Run the Mile.');
  assert.equal(last({ n: 'Are We There Yet?', t: 0 }), 'Last out: Are We There Yet?');
  assert.equal(last({ n: 'Run the Mile.' }), 'Last out: Run the Mile. in 22:41.');
});
