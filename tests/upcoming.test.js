import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, classColour } from '../js/race-rules.js';
import { CLASS_OPTIONS, isoDay, parseBio, sameRace, PAST, DUP, checkHand, exportUpcoming, importUpcoming, mergeUpcoming, daysText, countdown, dropLogged, countdownLabel, tickAction, dayChanged } from '../js/upcoming.js';

const today = '2027-06-01';

test('CLASS_OPTIONS is the standard classes then Other', () => {
  assert.deepEqual(CLASS_OPTIONS, ['1 mi', '5K', '5 mi', '10K', '15K', '10 mi', 'Half', 'Marathon', 'Other']);
});

test('parseBio reads MM/DD/YYYY lines and counts date-like lines it cannot read', () => {
  const text = 'Upcoming Races\r\n-----------------------\r\n06/14/2027 Riverbend 5k\r\n7/9/2027   Frostbite Half Marathon\r\n02/30/2027 Canyon 10K\r\n08/02/2027\r\n2027-08-10 Orchard 10K\r\n26.2 miles is next\r\nRunning since 2015 🏃';
  assert.deepEqual(parseBio(text), {
    races: [{ date: '2027-06-14', n: 'Riverbend 5k' }, { date: '2027-07-09', n: 'Frostbite Half Marathon' }],
    bad: 3,
  });
  assert.deepEqual(parseBio(''), { races: [], bad: 0 });
  assert.deepEqual(parseBio(null), { races: [], bad: 0 });
});

test('parseBio collapses spaces and cuts names to 80 characters', () => {
  const r = parseBio('06/14/2027  ' + 'ab  '.repeat(40)).races[0];
  assert.equal(r.n.length, 80);
  assert.ok(!r.n.includes('  '));
});

test('sameRace matches the same date and an equal or contained series key', () => {
  assert.equal(sameRace({ n: 'Riverbend 5k', date: '2027-06-14' }, { n: 'Riverbend 5K Fun Run', date: '2027-06-14' }), true);
  assert.equal(sameRace({ n: 'Riverbend 5k', date: '2027-06-14' }, { n: 'Riverbend 5K Fun Run', date: '2027-06-15' }), false);
  assert.equal(sameRace({ n: 'Riverbend 5k', date: '2027-06-14' }, { n: 'Orchard 5k', date: '2027-06-14' }), false);
});

test('sameRace: an empty series key only matches an identical name', () => {
  assert.equal(sameRace({ n: '5K', date: '2027-06-14' }, { n: 'Riverbend 5k', date: '2027-06-14' }), false);
  assert.equal(sameRace({ n: '!!!', date: '2027-06-14' }, { n: 'Riverbend 5k', date: '2027-06-14' }), false);
  assert.equal(sameRace({ n: '!!!', date: '2027-06-14' }, { n: ' !!! ', date: '2027-06-14' }), true);
});

test('checkHand accepts a future race and fills the class from the name', () => {
  assert.deepEqual(checkHand({ n: '  Orchard   10K ', date: '2027-06-20', time: '', cls: '', place: '' }, today, []),
    { race: { n: 'Orchard 10K', date: '2027-06-20', time: null, cls: '10K', place: null } });
  assert.equal(checkHand({ n: 'Orchard 10K', date: '2027-06-20', time: '', cls: 'Half', place: '' }, today, []).race.cls, 'Half');
  assert.equal(checkHand({ n: 'Turkey Trot', date: '2027-06-20', time: '', cls: '', place: '' }, today, []).race.cls, 'Other');
  assert.equal(checkHand({ n: 'Canyon 50K', date: '2027-06-20', time: '', cls: '', place: '' }, today, []).race.cls, 'Other');
});

test('checkHand refuses with the exact sentence', () => {
  const ok = { n: 'Orchard 10K', date: '2027-06-20', time: '', cls: '', place: '' };
  const err = (o, ex = []) => checkHand({ ...ok, ...o }, today, ex).error;
  assert.equal(err({ n: '   ' }), 'Enter the race name.');
  assert.equal(err({ n: 'a'.repeat(81) }), 'Keep the name to 80 characters.');
  assert.equal(err({ date: '' }), 'Enter the race date.');
  assert.equal(err({ date: '2027-02-30' }), 'Enter the race date.');
  assert.equal(err({ date: '2027-05-31' }), PAST);
  assert.equal(PAST, 'Finished races come in from Strava.');
  assert.ok(checkHand({ ...ok, date: today }, today, []).race);
  assert.equal(err({ time: '25:00' }), 'Enter the start time as hours and minutes, or leave it empty.');
  assert.equal(checkHand({ ...ok, time: '07:30' }, today, []).race.time, '07:30');
  assert.equal(err({ cls: 'Ultra' }), 'Choose a distance from the list.');
  assert.equal(err({ place: 'p'.repeat(61) }), 'Keep the place to 60 characters.');
  assert.equal(err({}, [{ n: 'orchard 10k', date: '2027-06-20' }]), DUP);
  assert.equal(DUP, 'That race is already in Up next.');
});

test('mergeUpcoming drops past races, shows a duplicate once as the hand copy, and sorts by date then time', () => {
  const up = {
    bio: { races: [{ date: '2027-06-14', n: 'Riverbend 5k' }, { date: '2027-05-30', n: 'Old Mill 10K' }] },
    hand: [
      { id: 'h1', n: 'Riverbend 5K', date: '2027-06-14', time: '08:00', cls: '5K', place: 'Riverbend, CO' },
      { id: 'h2', n: 'Library Hill 5K', date: '2027-06-01', time: null, cls: '5K', place: null },
    ],
  };
  const rows = mergeUpcoming(up, today);
  assert.deepEqual(rows.map((r) => r.id), ['h2', 'h1']);
  assert.equal(rows[1].src, 'hand');
  assert.equal(rows[1].colour, classColour('5K'));

  const only = mergeUpcoming({ hand: [], bio: up.bio }, today);
  assert.equal(only.length, 1);
  assert.equal(only[0].src, 'bio');
  assert.equal(only[0].time, null);
  assert.equal(only[0].place, null);
  assert.equal(only[0].cls, classify('Riverbend 5k', 0).cls);
  assert.ok(only[0].id.startsWith('bio-'));
  assert.equal(mergeUpcoming({ hand: [], bio: up.bio }, today)[0].id, only[0].id);
  assert.deepEqual(mergeUpcoming({ hand: [], bio: null }, today), []);
});

test('daysText', () => {
  assert.equal(daysText({ date: '2027-06-01' }, today), 'Today');
  assert.equal(daysText({ date: '2027-06-02' }, today), 'Tomorrow');
  assert.equal(daysText({ date: '2027-06-14' }, today), 'In 13 days');
});

test('countdown counts days, hours, minutes and seconds to midnight on race day, whatever the start time', () => {
  const now = new Date(2027, 5, 1, 9, 0, 30);
  const cd = { kind: 'clock', days: 12, hours: 14, mins: 59, secs: 30 };
  assert.deepEqual(countdown({ date: '2027-06-14', time: '08:00' }, now), cd);
  assert.deepEqual(countdown({ date: '2027-06-14', time: null }, now), cd);
  assert.deepEqual(countdown({ date: '2027-06-02', time: null }, new Date(2027, 5, 1, 23, 59, 59)), { kind: 'clock', days: 0, hours: 0, mins: 0, secs: 1 });
  assert.deepEqual(countdown({ date: '2027-06-02', time: null }, new Date(2027, 5, 1, 23, 59, 59, 400)), { kind: 'clock', days: 0, hours: 0, mins: 0, secs: 1 });
  assert.deepEqual(countdown({ date: '2027-06-02', time: '08:00' }, new Date(2027, 5, 2, 0, 0, 0)), { kind: 'today' });
  assert.deepEqual(countdown({ date: '2027-06-01', time: '18:00' }, now), { kind: 'today' });
  assert.deepEqual(countdown({ date: '2027-05-31', time: null }, now), { kind: 'today' });
});

test('dropLogged: a Strava race on the same date with the same name or distance clears the upcoming race', () => {
  const row = (n, cls, date = '2027-06-01') => ({ id: n, n, date, cls });
  const strava = (n, m, d = '2027-06-01T08:00:00Z') => ({ a: { id: 'a', n, m, d } });
  const rows = [row('Riverbend 5K', '5K'), row('Old Mill 10K', '10K'), row('Canyon Scramble', 'Other', '2027-06-02')];
  assert.deepEqual(dropLogged(rows, null), rows);
  assert.deepEqual(dropLogged(rows, {}), rows);
  assert.deepEqual(dropLogged(rows, strava('Morning race', 5020)).map((r) => r.n), ['Old Mill 10K', 'Canyon Scramble'], 'same distance');
  assert.deepEqual(dropLogged(rows, strava('Old Mill 10k', 0)).map((r) => r.n), ['Riverbend 5K', 'Canyon Scramble'], 'same name');
  assert.deepEqual(dropLogged(rows, strava('Riverbend 5K', 5000, '2027-05-31T08:00:00Z')), rows, 'another day');
  assert.deepEqual(dropLogged(rows, strava('Half', 21100)), rows, 'another distance and name');
  assert.deepEqual(dropLogged(rows, strava('Trail thing', 7300, '2027-06-02T09:00:00Z')).map((r) => r.n), ['Riverbend 5K', 'Old Mill 10K'], 'Other: any race that day');
});

test('isoDay uses the local date', () => assert.equal(isoDay(new Date(2027, 5, 1, 23, 30)), '2027-06-01'));

test('mergeUpcoming drops a bio race that repeats an earlier bio race, so ids stay unique', () => {
  const rows = mergeUpcoming({ hand: [], bio: { races: [{ date: '2027-06-14', n: 'Riverbend 5k' }, { date: '2027-06-14', n: 'Riverbend  5K' }, { date: '2027-06-15', n: 'Riverbend 5k' }] } }, '2027-06-01');
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((r) => r.id)).size, 2);
});

test('countdownLabel: singular for 1, no days on race day, nothing for today', () => {
  assert.equal(countdownLabel({ kind: 'clock', days: 9, hours: 2, mins: 59, secs: 7 }), '9 days, 2 hours and 59 minutes to race day');
  assert.equal(countdownLabel({ kind: 'clock', days: 1, hours: 1, mins: 1, secs: 1 }), '1 day, 1 hour and 1 minute to race day');
  assert.equal(countdownLabel({ kind: 'clock', days: 0, hours: 2, mins: 59, secs: 0 }), '2 hours and 59 minutes to race day');
  assert.equal(countdownLabel({ kind: 'clock', days: 0, hours: 0, mins: 5, secs: 0 }), '0 hours and 5 minutes to race day');
  assert.equal(countdownLabel({ kind: 'today' }), null);
  // the day before the race: the countdown itself has days 0
  assert.equal(countdownLabel(countdown({ date: '2027-06-15', time: '11:00' }, new Date(2027, 5, 14, 21, 1))), '2 hours and 59 minutes to race day');
});

const H = (n, date, time, cls, place) => ({ id: 'h1', n, date, time, cls, place, at: 1 });
const BAD_FILE = "This isn't a Run Hub races export.";
const file = (races) => JSON.stringify({ app: 'Run Hub', kind: 'upcoming', v: 1, races });

test('exportUpcoming then importUpcoming round-trips every field', () => {
  const hand = [H('Orchard 10K', '2027-07-04', '08:00', '10K', 'Orchard'), H('Rail Trail Half', '2027-08-01', null, 'Half', null)];
  const text = exportUpcoming(hand);
  assert.ok(!text.includes('"id"') && !text.includes('"at"'));
  const r = importUpcoming(text, [], today);
  assert.deepEqual(r, { add: hand.map(({ id, at, ...f }) => f), dup: 0, past: 0, bad: 0 });
});

test('importUpcoming refuses what is not a Run Hub export', () => {
  for (const t of ['not json', '{}', JSON.stringify({ app: 'Run Hub', kind: 'upcoming', v: 2, races: [] }), '[]', 'null'])
    assert.deepEqual(importUpcoming(t, [], today), { error: BAD_FILE });
  const long = 'That is too long to be a Run Hub races export.';
  assert.deepEqual(importUpcoming(' '.repeat(200001), [], today), { error: long });
  assert.deepEqual(importUpcoming(file(Array.from({ length: 201 }, (_, i) => ({ n: 'R' + i, date: '2027-09-01' }))), [], today), { error: long });
});

test('importUpcoming counts duplicates, finished races and unreadable entries', () => {
  const ok = { n: 'Creekside 5K', date: '2027-06-20', time: null, cls: '5K', place: null };
  const text = file([
    { n: 'Riverbend 5K', date: '2027-06-20' }, { n: 'Old Mill 10K', date: '2027-05-01' },
    { n: 'x'.repeat(5000), date: '2027-06-20' }, { n: 'Canyon', date: 42 }, ok,
  ]);
  const r = importUpcoming(text, [{ n: 'Riverbend 5K', date: '2027-06-20' }], today);
  assert.equal(r.add.length, 1); assert.equal(r.dup, 1); assert.equal(r.past, 1); assert.equal(r.bad, 2);
  assert.equal(r.add[0].n, 'Creekside 5K');
  const m = importUpcoming(file([{ n: '<b>Frostbite</b> 5K', date: '2027-06-20' }]), [], today);
  assert.equal(m.add[0].n, '<b>Frostbite</b> 5K');
  assert.deepEqual(importUpcoming(file([null, 'x', { n: 5, date: '2027-06-20' }]), [], today), { add: [], dup: 0, past: 0, bad: 3 });
  const twice = importUpcoming(file([ok, ok]), [], today);
  assert.equal(twice.add.length, 1); assert.equal(twice.dup, 1);
});

test('tickAction: what the hub tick does with what Next start last drew', () => {
  const now = new Date(2027, 5, 1, 8, 0);
  const row = { id: 'a', date: '2027-06-05', time: '09:00' };
  const drawn = { id: 'a', kind: 'clock' };
  const none = { do: 'nothing' }, redraw = { do: 'redraw' };
  assert.deepEqual(tickAction(null, [row], now, true), none, 'Next start could not draw');
  assert.deepEqual(tickAction(drawn, null, now, true), none, 'rows could not be read');
  assert.deepEqual(tickAction({ id: null, kind: null }, [], now, false), none, 'still nothing coming up');
  assert.deepEqual(tickAction(drawn, [], now, true), redraw, 'the last race went away');
  assert.deepEqual(tickAction({ id: null, kind: null }, [row], now, false), redraw, 'a first race arrived');
  assert.deepEqual(tickAction(drawn, [{ ...row, id: 'b' }], now, true), redraw, 'another race is next');
  assert.deepEqual(tickAction(drawn, [row], new Date(2027, 5, 5, 0, 0), true), redraw, 'race day began');
  assert.deepEqual(tickAction(drawn, [row], now, false), redraw, 'no clock element');
  assert.deepEqual(tickAction(drawn, [row], now, true), { do: 'clock', cd: { kind: 'clock', days: 3, hours: 16, mins: 0, secs: 0 } });
});

test('dayChanged: true only once the local day differs from the drawn one', () => {
  assert.equal(dayChanged('2027-06-01', new Date(2027, 5, 1, 23, 59, 59)), false);
  assert.equal(dayChanged('2027-06-01', new Date(2027, 5, 2, 0, 0, 0)), true);
});

test('importUpcoming: a time, distance or place that is not text makes the race unreadable', () => {
  const base = { n: 'Lanternfield 10K', date: '2027-06-20' };
  const text = (extra) => JSON.stringify({ app: 'Run Hub', kind: 'upcoming', v: 1, races: [{ ...base, ...extra }] });
  // Values that checkHand alone would accept or turn into text.
  for (const extra of [{ time: 0 }, { time: false }, { time: ['09:30'] }, { cls: 0 }, { cls: false }, { place: 42 }, { place: ['Mill Park'] }, { place: {} }]) {
    assert.deepEqual(importUpcoming(text(extra), [], today), { add: [], dup: 0, past: 0, bad: 1 }, JSON.stringify(extra));
  }
  assert.equal(importUpcoming(text({ time: null, cls: null, place: null }), [], today).add.length, 1);
});
