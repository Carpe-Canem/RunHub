import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt0 } from '../js/core.js';
import { ziggyLines, moodCheck } from '../js/ziggy-says.js';

const utc = (y, m, d) => Date.UTC(y, m - 1, d) / 864e5;
const NOW = new Date(2026, 10, 27, 12);   // a Friday, local noon
const MI = { unit: 'mi', week: 5.0, weekAvg: 20.7, ytd: 1098, lytd: 1121, hasLastYear: true, runsWeek: 2,
  ws: utc(2026, 11, 23), dow: 4, days: [0, 3.1, 0, 1.9, 0, 0, 0], runsToday: 1 };
const race = (over) => ({ id: 7, n: 'Orchard 5K', t: 1262, cls: '5K', date: '2026-11-20', record: false, ...over });
const stats = (over) => ({ count: 20, podiums: 2, latest: [race()], ...over });
const UP = [{ id: 'u1', n: 'Orchard 10K', date: '2026-12-06', time: '08:00' }, { id: 'u2', n: 'Harbor Half', date: '2027-01-17' }];
const SYNC = { running: false, runsLoaded: true };

const lines = (over = {}) => ziggyLines({ mi: MI, stats: stats(), up: UP, sync: SYNC, now: NOW, locale: 'en-US', ...over });
const mi = (over) => ({ ...MI, ...over });
const soon = (date, over) => [{ ...UP[0], date, ...over }, UP[1]];
const say = (line) => line.parts.map((p) => p.text).join('').replace(/\s/g, ' ');
const keys = (out) => out.map((l) => l.key);
const get = (key, over) => lines(over).find((l) => l.key === key);
const toned = (line) => line.parts.filter((p) => p.tone).map((p) => [p.text, p.tone]);
const check = (line, mood, text) => {
  assert.ok(line, `no line, expected "${text}"`);
  assert.equal(line.mood, mood);
  assert.equal(say(line), text);
};

test('rule 1: fetching comes first', () => {
  const first = lines({ mi: null, sync: { running: true, runsLoaded: false } })[0];
  assert.equal(first.key, 'fetching');
  check(first, 'eager', 'Fetching your runs from Strava.');
});

test('rule 2: race day, with and without a start time', () => {
  check(get('raceday', { up: soon('2026-11-27') }), 'thrilled', 'Race day. Orchard 10K at 8:00 AM.');
  check(get('raceday', { up: soon('2026-11-27', { time: undefined }) }), 'thrilled', 'Race day. Orchard 10K.');
});

const record = { stats: stats({ latest: [race({ record: true, t: 1236 })] }) };

test('rule 3: a new record, and it is not also rule 6', () => {
  const l = get('record', record);
  check(l, 'thrilled', '20:36! A new 5K record.');
  assert.deepEqual(toned(l), [['20:36!', 'go']]);
  assert.equal(get('latest', record), undefined);
});

test('rule 3 lapses after 14 days', () => {
  const on = (date) => ({ stats: stats({ latest: [race({ record: true, date })] }) });
  assert.ok(get('record', on('2026-11-13')));
  assert.equal(get('record', on('2026-11-12')), undefined);
  assert.ok(get('latest', on('2026-11-12')));
});

test('rule 4: the next race is this week', () => {
  check(get('soon', { up: soon('2026-11-29') }), 'eager', 'Orchard 10K is on Sunday.');
});

test('rule 4 edges: 1 day, 7 days, not 8', () => {
  assert.ok(get('soon', { up: soon('2026-11-28') }));
  check(get('soon', { up: soon('2026-12-04') }), 'eager', 'Orchard 10K is on Friday.');
  assert.equal(get('soon', { up: soon('2026-12-05') }), undefined);
});

test('rule 5: over the usual week', () => {
  const l = get('weekover', { mi: mi({ week: 22.4 }) });
  check(l, 'happy', '22.4 miles this week, 1.7 over your usual.');
  assert.deepEqual(toned(l), [['1.7 over', 'go']]);
});

test('rule 6: the latest result', () => {
  check(get('latest'), 'happy', 'Orchard 5K in 21:02.');
});

test('rule 6: no time, and it lapses after 30 days', () => {
  check(get('latest', { stats: stats({ latest: [race({ t: 0 })] }) }), 'happy', 'Orchard 5K.');
  assert.ok(get('latest', { stats: stats({ latest: [race({ date: '2026-10-28' })] }) }));
  assert.equal(get('latest', { stats: stats({ latest: [race({ date: '2026-10-27' })] }) }), undefined);
});

test('rule 7: ahead of last year', () => {
  const l = get('yearahead', { mi: mi({ lytd: 1075 }) });
  check(l, 'happy', `${fmt0(1098)} miles this year, 23 ahead of last year.`);
  assert.deepEqual(toned(l), [['23 ahead', 'go']]);
});

test('rule 8: late in a light week', () => {
  check(get('weeklow', { mi: mi({ dow: 5 }) }), 'worried', '5 miles so far this week. Your usual is 20.7.');
});

test('rule 8 edges: the last two days, under 60% of the usual', () => {
  assert.equal(get('weeklow', { mi: mi({ dow: 4 }) }), undefined);
  assert.equal(get('weeklow', { mi: mi({ dow: 5, week: 12.5 }) }), undefined);
  assert.ok(get('weeklow', { mi: mi({ dow: 6 }) }));
});

test('rule 9: behind last year', () => {
  check(get('yearbehind'), 'worried', '23 miles behind this date last year.');
});

test("rules 7 and 9 need last year's runs", () => {
  for (const lytd of [0, 1121]) {
    const k = keys(lines({ mi: mi({ hasLastYear: false, lytd }) }));
    assert.ok(!k.includes('yearahead') && !k.includes('yearbehind'));
  }
});

test('rule 10: no run today', () => {
  check(get('norun', { mi: mi({ runsToday: 0 }) }), 'eager', 'No run yet today. Shall we?');
});

test('rule 10 gives way to rule 8', () => {
  const k = keys(lines({ mi: mi({ runsToday: 0, dow: 5 }) }));
  assert.ok(k.includes('weeklow') && !k.includes('norun'));
});

test('rule 11: the race after next', () => {
  check(get('after'), 'curious', 'After that: Harbor Half, Jan 17.');
});

test('rule 12: the totals', () => {
  check(get('totals'), 'curious', '20 races finished, 2 on an age-group podium.');
  check(get('totals', { stats: stats({ podiums: 0 }) }), 'curious', '20 races finished.');
  check(get('totals', { stats: stats({ count: 1, podiums: 0 }) }), 'curious', '1 race finished.');
});

test('rule 13: nothing else to say', () => {
  const out = lines({ mi: mi({ week: 20.7, lytd: 1098 }), stats: stats({ count: 0, podiums: 0, latest: [] }), up: [] });
  assert.deepEqual(out, [{ key: 'quiet', mood: 'asleep', parts: [{ text: 'All quiet.' }] }]);
});

test('everything that can hold together comes out in the order of the table', () => {
  // A record and a plain latest result exclude each other, as do ahead and behind, and "late in a light week"
  // and "over the usual"; so the order is checked over three lists.
  const sync = { running: true, runsLoaded: false };
  assert.deepEqual(keys(lines({ sync, up: soon('2026-11-27'), mi: mi({ week: 22.4, lytd: 1075, runsToday: 0 }), ...record })),
    ['fetching', 'raceday', 'record', 'weekover', 'yearahead', 'after', 'totals']);
  assert.deepEqual(keys(lines({ up: soon('2026-11-29'), mi: mi({ dow: 5, runsToday: 0 }) })),
    ['soon', 'latest', 'weeklow', 'yearbehind', 'after', 'totals']);
  assert.deepEqual(keys(lines({ mi: mi({ runsToday: 0 }) })), ['latest', 'yearbehind', 'norun', 'after', 'totals']);
});

test('km', () => {
  const km = (over) => mi({ unit: 'km', ...over });
  const all = [
    get('weekover', { mi: km({ week: 22.4 }) }), get('yearahead', { mi: km({ lytd: 1075 }) }),
    get('weeklow', { mi: km({ dow: 5 }) }), get('yearbehind', { mi: km({}) }),
  ];
  assert.equal(say(all[0]), '22.4 km this week, 1.7 over your usual.');
  assert.equal(say(all[2]), '5 km so far this week. Your usual is 20.7.');
  assert.equal(say(all[3]), '23 km behind this date last year.');
  for (const l of all) assert.doesNotMatch(say(l), /miles/);
  assert.match(say(all[1]), / km this year/);
});

test('a name with its own stop gets no second one', () => {
  const named = { stats: stats({ latest: [race({ n: 'Run the Mile.', t: 0 })] }) };
  assert.equal(say(get('latest', named)), 'Run the Mile.');
  assert.equal(say(get('raceday', { up: soon('2026-11-27', { n: 'Is it on?', time: null }) })), 'Race day. Is it on?');
});

test('a long name is cut in his line', () => {
  const n = 'The Orchard And Harbor Invitational Race';
  assert.equal(n.length, 40);
  const cut = `${n.slice(0, 28)}…`;
  assert.equal(say(get('soon', { up: soon('2026-11-29', { n }) })), `${cut} is on Sunday.`);
  assert.equal(say(get('latest', { stats: stats({ latest: [race({ n })] }) })), `${cut} in 21:02.`);
  // The ellipsis ends the sentence: no stop after it.
  assert.equal(say(get('latest', { stats: stats({ latest: [race({ n, t: 0 })] }) })), cut);
});

test('races still loading: no race lines, and no "No races"', () => {
  const out = lines({ stats: null });
  for (const k of ['record', 'latest', 'totals']) assert.ok(!keys(out).includes(k));
  for (const l of out) assert.doesNotMatch(say(l), /No races/);
});

test('mileage failed: no mileage lines', () => {
  const k = keys(lines({ mi: false, sync: { running: true, runsLoaded: false } }));
  for (const key of ['fetching', 'weekover', 'yearahead', 'weeklow', 'yearbehind', 'norun']) assert.ok(!k.includes(key), key);
});

test('both failed: he is asleep, whatever is coming up', () => {
  assert.deepEqual(keys(lines({ mi: false, stats: false, up: soon('2026-11-28') })), ['quiet']);
});

test('upcoming unreadable: the rest as usual', () => {
  assert.deepEqual(keys(lines({ up: null })), ['latest', 'yearbehind', 'totals']);
});

test('the check hook', () => {
  assert.deepEqual(moodCheck('thrilled'), [
    { key: 'check-1', mood: 'thrilled', parts: [{ text: 'Mood check: thrilled.' }] },
    { key: 'check-2', mood: 'thrilled', parts: [{ text: 'And a second line.' }] },
  ]);
  assert.deepEqual(moodCheck('asleep').map((l) => l.mood), ['asleep', 'asleep']);
  assert.equal(moodCheck('cat'), null);
  assert.equal(moodCheck('toString'), null);
});

test('a race with no name still gets its lines', () => {
  for (const n of [undefined, '']) {
    const bare = (date) => [{ ...UP[0], date, time: undefined, n }, { ...UP[1], n }];
    assert.equal(say(get('raceday', { up: bare('2026-11-27') })), 'Race day. Your next race.');
    assert.equal(say(get('soon', { up: bare('2026-11-29') })), 'Your next race is on Sunday.');
    assert.equal(say(get('after', { up: bare('2026-11-29') })), 'After that: A race, Jan 17.');
    assert.equal(say(get('latest', { stats: stats({ latest: [race({ n, t: 0 })] }) })), 'A race.');
  }
});

test('a long name is cut between whole characters, emoji included', () => {
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  const n = `${'a'.repeat(27)}${family}tail`;
  assert.equal(say(get('latest', { stats: stats({ latest: [race({ n, t: 0 })] }) })), `${'a'.repeat(27)}${family}\u2026`);
  // 28 whole characters are not cut, however many code points they take.
  const whole = family.repeat(28);
  assert.equal(say(get('latest', { stats: stats({ latest: [race({ n: whole, t: 0 })] }) })), `${whole}.`);
});

test('only the year is ever "behind", and he never scolds', () => {
  // Its own sweep of the cases, so it holds when run alone.
  const miles = [MI, mi({ week: 22.4, lytd: 1075, runsToday: 0 }), mi({ dow: 5, runsToday: 0 }), mi({ runsToday: 0 }),
    mi({ unit: 'km', dow: 6 }), null, false];
  const races = [stats(), stats({ latest: [race({ record: true })] }), stats({ count: 0, podiums: 0, latest: [] }), null, false];
  const ups = [UP, soon('2026-11-27'), soon('2026-11-29'), [], null];
  const keysSeen = new Set();
  for (const m of miles) for (const st of races) for (const up of ups) for (const running of [true, false]) {
    for (const l of lines({ mi: m, stats: st, up, sync: { running, runsLoaded: false } })) {
      keysSeen.add(l.key);
      if (l.key !== 'yearbehind') assert.doesNotMatch(say(l), /behind/);
      for (const p of l.parts) assert.notEqual(p.tone, 'slow');
    }
  }
  assert.deepEqual([...keysSeen].sort(), ['after', 'fetching', 'latest', 'norun', 'quiet', 'raceday', 'record', 'soon',
    'totals', 'weeklow', 'weekover', 'yearahead', 'yearbehind']);
});
