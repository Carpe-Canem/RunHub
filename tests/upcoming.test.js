import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, classColour } from '../js/race-rules.js';
import { CLASS_OPTIONS, isoDay, parseBio, sameRace, PAST, DUP, checkHand, mergeUpcoming, daysText, countdown, countdownLabel } from '../js/upcoming.js';

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

test('countdown with a start time counts days, hours and minutes to it', () => {
  const now = new Date(2027, 5, 1, 9, 0);
  assert.deepEqual(countdown({ date: '2027-06-14', time: '08:00' }, now), { kind: 'clock', days: 12, hours: 23, mins: 0 });
  assert.deepEqual(countdown({ date: '2027-06-14', time: null }, now), { kind: 'days', days: 13 });
  assert.deepEqual(countdown({ date: '2027-06-01', time: '08:00' }, now), { kind: 'today' });
  assert.deepEqual(countdown({ date: '2027-06-01', time: null }, now), { kind: 'today' });
});

test('isoDay uses the local date', () => assert.equal(isoDay(new Date(2027, 5, 1, 23, 30)), '2027-06-01'));

test('mergeUpcoming drops a bio race that repeats an earlier bio race, so ids stay unique', () => {
  const rows = mergeUpcoming({ hand: [], bio: { races: [{ date: '2027-06-14', n: 'Riverbend 5k' }, { date: '2027-06-14', n: 'Riverbend  5K' }, { date: '2027-06-15', n: 'Riverbend 5k' }] } }, '2027-06-01');
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((r) => r.id)).size, 2);
});

test('countdownLabel: singular for 1, no days on race day, nothing for today', () => {
  assert.equal(countdownLabel({ kind: 'clock', days: 9, hours: 2, mins: 59 }), '9 days, 2 hours and 59 minutes to the start');
  assert.equal(countdownLabel({ kind: 'clock', days: 1, hours: 1, mins: 1 }), '1 day, 1 hour and 1 minute to the start');
  assert.equal(countdownLabel({ kind: 'clock', days: 0, hours: 2, mins: 59 }), '2 hours and 59 minutes to the start');
  assert.equal(countdownLabel({ kind: 'clock', days: 0, hours: 0, mins: 5 }), '0 hours and 5 minutes to the start');
  assert.equal(countdownLabel({ kind: 'days', days: 1 }), '1 day to the start');
  assert.equal(countdownLabel({ kind: 'days', days: 40 }), '40 days to the start');
  assert.equal(countdownLabel({ kind: 'today' }), null);
  // a race later today with a start time: the countdown itself has days 0
  assert.equal(countdownLabel(countdown({ date: '2027-06-15', time: '11:00' }, new Date(2027, 5, 15, 8, 1))), '2 hours and 59 minutes to the start');
});
