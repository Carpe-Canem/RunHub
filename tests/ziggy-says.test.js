import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt0 } from '../js/core.js';
import { ziggyLines, moodCheck, WORDINGS_CAP } from '../js/ziggy-says.js';
import { graphemes } from '../js/ziggy-moves.js';
import { fmtTime } from '../js/races-model.js';

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
const sayWay = (way) => way.map((p) => p.text).join('').replace(/\s/g, ' ');
const say = (line) => sayWay(line.ways[0]);
const sayAll = (line) => line.ways.map(sayWay);
const keys = (out) => out.map((l) => l.key);
const get = (key, over) => lines(over).find((l) => l.key === key);
// The toned parts of every way: the same in each.
const toned = (line) => line.ways.map((w) => w.filter((p) => p.tone).map((p) => [p.text, p.tone]));
const tonedEach = (line, want) => assert.deepEqual(toned(line), line.ways.map(() => want));
// texts: the picked wording of every way, in order (one to three).
const check = (line, mood, texts) => {
  assert.ok(line, `no line, expected "${texts}"`);
  assert.equal(line.mood, mood);
  assert.deepEqual(sayAll(line), texts);
};

test('rule 1: fetching comes first', () => {
  const first = lines({ mi: null, sync: { running: true, runsLoaded: false } })[0];
  assert.equal(first.key, 'fetching');
  check(first, 'eager', ['Fetch! Getting your runs from Strava!', 'Fetching your runs from Strava! Good boy!',
    'Hang on, fetching your runs from Strava!']);
});

test('rule 2: race day, with and without a start time', () => {
  check(get('raceday', { up: soon('2026-11-27') }), 'thrilled', ['Race day! Orchard 10K at 8:00 AM!', 'Race day!! Orchard 10K, 8:00 AM!',
    "It's today! Orchard 10K, 8:00 AM!"]);
  check(get('raceday', { up: soon('2026-11-27', { time: undefined }) }), 'thrilled', ['Race day! Orchard 10K!', 'Race day!! Orchard 10K!',
    "It's today! Orchard 10K!"]);
});

const record = { stats: stats({ latest: [race({ record: true, t: 1236 })] }) };

test('rule 3: a new record, and it is not also rule 6', () => {
  const l = get('record', record);
  check(l, 'thrilled', ['20:36! New 5K record! Good human!', '20:36! Your best 5K ever! Zoomies!', '20:36! A 5K record! So proud!']);
  tonedEach(l, [['20:36!', 'go']]);
  assert.equal(get('latest', record), undefined);
});

test('rule 3 lapses after 14 days', () => {
  const on = (date) => ({ stats: stats({ latest: [race({ record: true, date })] }) });
  assert.ok(get('record', on('2026-11-13')));
  assert.equal(get('record', on('2026-11-12')), undefined);
  assert.ok(get('latest', on('2026-11-12')));
});

test('rule 4: the next race is this week', () => {
  check(get('soon', { up: soon('2026-11-29') }), 'eager', ['Orchard 10K is on Sunday! Ooh!', 'Orchard 10K: Sunday! So soon!']);
});

test('rule 4 edges: 1 day, 7 days, not 8', () => {
  assert.ok(get('soon', { up: soon('2026-11-28') }));
  check(get('soon', { up: soon('2026-12-04') }), 'eager', ['Orchard 10K is on Friday! Ooh!', 'Orchard 10K: Friday! So soon!']);
  assert.equal(get('soon', { up: soon('2026-12-05') }), undefined);
});

test('rule 5: over the usual week', () => {
  const l = get('weekover', { mi: mi({ week: 22.4 }) });
  check(l, 'happy', ['22.4 miles this week, 1.7 over your usual! Wow!', '1.7 over your usual this week! 22.4 miles!',
    '22.4 miles this week! 1.7 over usual. Tail wags!']);
  tonedEach(l, [['1.7 over', 'go']]);
});

test('rule 6: the latest result', () => {
  check(get('latest'), 'happy', ['Orchard 5K in 21:02! Good run!', 'Orchard 5K, 21:02! You flew!', 'Orchard 5K: 21:02! Proud pup!']);
});

test('rule 6: no time, and it lapses after 30 days', () => {
  check(get('latest', { stats: stats({ latest: [race({ t: 0 })] }) }), 'happy', ['Orchard 5K! Good run!', 'Orchard 5K! You flew!', 'Orchard 5K! Proud pup!']);
  assert.ok(get('latest', { stats: stats({ latest: [race({ date: '2026-10-28' })] }) }));
  assert.equal(get('latest', { stats: stats({ latest: [race({ date: '2026-10-27' })] }) }), undefined);
});

test('rule 7: ahead of last year', () => {
  const l = get('yearahead', { mi: mi({ lytd: 1075 }) });
  check(l, 'happy', [`${fmt0(1098)} miles this year! 23 ahead of last year!`, `23 ahead of last year! ${fmt0(1098)} miles so far!`,
    `We're 23 ahead of last year! ${fmt0(1098)} miles!`]);
  tonedEach(l, [['23 ahead', 'go']]);
});

test('rule 8: late in a light week', () => {
  check(get('weeklow', { mi: mi({ dow: 5 }) }), 'worried', ['5 miles so far this week. Usually 20.7. Walkies?',
    '5 miles this week. We usually do 20.7. Run soon?', "5 miles this week, 20.7 usually. I'm ready!"]);
});

test('rule 8 edges: the last two days, under 60% of the usual', () => {
  assert.equal(get('weeklow', { mi: mi({ dow: 4 }) }), undefined);
  assert.equal(get('weeklow', { mi: mi({ dow: 5, week: 12.5 }) }), undefined);
  assert.ok(get('weeklow', { mi: mi({ dow: 6 }) }));
});

test('rule 9: behind last year', () => {
  check(get('yearbehind'), 'worried', ["23 miles behind this date last year. Let's go!", '23 miles behind this date last year. Catch up?',
    '23 miles behind this date last year. Sniff\u2026']);
});

test("rules 7 and 9 need last year's runs", () => {
  for (const lytd of [0, 1121]) {
    const k = keys(lines({ mi: mi({ hasLastYear: false, lytd }) }));
    assert.ok(!k.includes('yearahead') && !k.includes('yearbehind'));
  }
});

test('rule 10: no run today', () => {
  check(get('norun', { mi: mi({ runsToday: 0 }) }), 'eager', ['No run yet today! Walkies? Please?', "No run yet today. I'll get my leash!",
    "No run yet today! Shoes on? Let's go!"]);
});

test('rule 10 gives way to rule 8', () => {
  const k = keys(lines({ mi: mi({ runsToday: 0, dow: 5 }) }));
  assert.ok(k.includes('weeklow') && !k.includes('norun'));
});

test('rule 11: the race after next', () => {
  check(get('after'), 'curious', ['And then? Harbor Half, Jan 17!', 'Then: Harbor Half, Jan 17! Ooh?', 'After that? Harbor Half, Jan 17!']);
});

test('rule 12: the totals', () => {
  check(get('totals'), 'curious', ['20 races finished! 2 on an age-group podium!', '20 races done, 2 age-group podiums! Wow!',
    '20 races finished! 2 age-group podiums, too!']);
  check(get('totals', { stats: stats({ podiums: 0 }) }), 'curious', ['20 races finished!', '20 races done! Wow!', '20 races finished! Tail wags!']);
  check(get('totals', { stats: stats({ count: 1, podiums: 0 }) }), 'curious', ['1 race finished!', '1 race done! Wow!', '1 race finished! Tail wags!']);
  // One of each: singular in every wording.
  check(get('totals', { stats: stats({ count: 1, podiums: 1 }) }), 'curious', ['1 race finished! 1 on an age-group podium!',
    '1 race done, 1 age-group podium! Wow!', '1 race finished! 1 age-group podium, too!']);
});

test('rule 13: nothing else to say', () => {
  const out = lines({ mi: mi({ week: 20.7, lytd: 1098 }), stats: stats({ count: 0, podiums: 0, latest: [] }), up: [] });
  assert.equal(out.length, 1);
  check(out[0], 'asleep', ['All quiet. Nap time.', 'All quiet\u2026 zzz.', 'All quiet. Wake me for a run.']);
  assert.ok(out[0].ways.every((w) => w.every((p) => !p.tone)));
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
  assert.deepEqual(sayAll(all[0]), ['22.4 km this week, 1.7 over your usual! Wow!', '1.7 over your usual this week! 22.4 km!',
    '22.4 km this week! 1.7 over usual. Tail wags!']);
  assert.deepEqual(sayAll(all[2]), ['5 km so far this week. Usually 20.7. Walkies?', '5 km this week. We usually do 20.7. Run soon?',
    "5 km this week, 20.7 usually. I'm ready!"]);
  assert.deepEqual(sayAll(all[3]), ["23 km behind this date last year. Let's go!", '23 km behind this date last year. Catch up?',
    '23 km behind this date last year. Sniff\u2026']);
  assert.deepEqual(sayAll(all[1]), [`${fmt0(1098)} km this year! 23 ahead of last year!`, `23 ahead of last year! ${fmt0(1098)} km so far!`,
    `We're 23 ahead of last year! ${fmt0(1098)} km!`]);
  for (const l of all) for (const text of sayAll(l)) assert.doesNotMatch(text, /miles/);
});

test('a name with its own stop gets no second one', () => {
  const named = { stats: stats({ latest: [race({ n: 'Run the Mile.', t: 0 })] }) };
  assert.deepEqual(sayAll(get('latest', named)), ['Run the Mile. Good run!', 'Run the Mile. You flew!', 'Run the Mile. Proud pup!']);
  assert.deepEqual(sayAll(get('raceday', { up: soon('2026-11-27', { n: 'Is it on?', time: null }) })),
    ['Race day! Is it on?', 'Race day!! Is it on?', "It's today! Is it on?"]);
});

test('a long name is cut in his line', () => {
  const n = 'The Orchard And Harbor Invitational Race';
  assert.equal(n.length, 40);
  const cut = `${n.slice(0, 28)}…`;
  assert.deepEqual(sayAll(get('soon', { up: soon('2026-11-29', { n }) })), [`${cut} is on Sunday! Ooh!`, `${cut}: Sunday! So soon!`]);
  assert.deepEqual(sayAll(get('latest', { stats: stats({ latest: [race({ n })] }) })),
    [`${cut} in 21:02! Good run!`, `${cut}, 21:02! You flew!`, `${cut}: 21:02! Proud pup!`]);
  // The ellipsis ends the sentence: no stop after it.
  assert.deepEqual(sayAll(get('latest', { stats: stats({ latest: [race({ n, t: 0 })] }) })),
    [`${cut} Good run!`, `${cut} You flew!`, `${cut} Proud pup!`]);
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
    { key: 'check-1', mood: 'thrilled', ways: [[{ text: 'Mood check: thrilled.' }]] },
    { key: 'check-2', mood: 'thrilled', ways: [[{ text: 'And a second line.' }]] },
  ]);
  assert.deepEqual(moodCheck('asleep').map((l) => l.mood), ['asleep', 'asleep']);
  assert.equal(moodCheck('cat'), null);
  assert.equal(moodCheck('toString'), null);
});

test('a race with no name still gets its lines', () => {
  for (const n of [undefined, '']) {
    const bare = (date) => [{ ...UP[0], date, time: undefined, n }, { ...UP[1], n }];
    assert.deepEqual(sayAll(get('raceday', { up: bare('2026-11-27') })), ['Race day! Your next race!', 'Race day!! Your next race!', "It's today! Your next race!"]);
    assert.deepEqual(sayAll(get('soon', { up: bare('2026-11-29') })), ['Your next race is on Sunday! Ooh!', 'Your next race: Sunday! So soon!']);
    assert.deepEqual(sayAll(get('after', { up: bare('2026-11-29') })),
      ['And then? A race, Jan 17!', 'Then: A race, Jan 17! Ooh?', 'After that? A race, Jan 17!']);
    assert.deepEqual(sayAll(get('latest', { stats: stats({ latest: [race({ n, t: 0 })] }) })), ['A race! Good run!', 'A race! You flew!', 'A race! Proud pup!']);
  }
});

test('a long name is cut between whole characters, emoji included', () => {
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  const n = `${'a'.repeat(27)}${family}tail`;
  assert.equal(say(get('latest', { stats: stats({ latest: [race({ n, t: 0 })] }) })), `${'a'.repeat(27)}${family}\u2026 Good run!`);
  // 28 whole characters are not cut, however many code points they take.
  const whole = family.repeat(28);
  assert.equal(say(get('latest', { stats: stats({ latest: [race({ n: whole, t: 0 })] }) })), `${whole}! Good run!`);
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
      for (const way of l.ways) {
        if (l.key !== 'yearbehind') assert.doesNotMatch(sayWay(way), /behind/);
        for (const p of way) assert.notEqual(p.tone, 'slow');
      }
    }
  }
  assert.deepEqual([...keysSeen].sort(), ['after', 'fetching', 'latest', 'norun', 'quiet', 'raceday', 'record', 'soon',
    'totals', 'weeklow', 'weekover', 'yearahead', 'yearbehind']);
});

test('every line has one to three wordings, each a list of parts', () => {
  const miles = [MI, mi({ week: 22.4, lytd: 1075, runsToday: 0 }), mi({ dow: 5, runsToday: 0 }), mi({ unit: 'km' }), null, false];
  const races = [stats(), stats({ latest: [race({ record: true })] }), null, false];
  const ups = [UP, soon('2026-11-27'), soon('2026-11-29'), null];
  for (const m of miles) for (const st of races) for (const up of ups) {
    for (const l of lines({ mi: m, stats: st, up, sync: { running: true, runsLoaded: false } })) {
      assert.ok(Array.isArray(l.ways) && l.ways.length >= 1 && l.ways.length <= 3, l.key);
      for (const way of l.ways) {
        assert.ok(Array.isArray(way) && way.length > 0, l.key);
        for (const p of way) assert.equal(typeof p.text, 'string');
      }
    }
  }
});

test('each wording keeps its facts, and its toned parts', () => {
  const facts = (l, res, tones = []) => {
    assert.ok(l);
    assert.ok(l.ways.length >= 1);
    for (const way of l.ways) for (const re of res) assert.match(sayWay(way), re, l.key);
    tonedEach(l, tones);
  };
  facts(get('fetching', { mi: null, sync: { running: true, runsLoaded: false } }), [/Strava/]);
  facts(get('raceday', { up: soon('2026-11-27') }), [/Orchard 10K/, /8:00 AM/]);
  facts(get('record', record), [/20:36/, /5K/], [['20:36!', 'go']]);
  facts(get('soon', { up: soon('2026-11-29') }), [/Orchard 10K/, /Sunday/]);
  facts(get('weekover', { mi: mi({ week: 22.4 }) }), [/22\.4 miles/, /1\.7 over/], [['1.7 over', 'go']]);
  facts(get('latest'), [/Orchard 5K/, /21:02/]);
  facts(get('yearahead', { mi: mi({ lytd: 1075 }) }), [/1,098 miles/, /23 ahead of last year/], [['23 ahead', 'go']]);
  facts(get('weeklow', { mi: mi({ dow: 5 }) }), [/5 miles/, /20\.7/]);
  facts(get('yearbehind'), [/23 miles behind this date last year/]);
  facts(get('norun', { mi: mi({ runsToday: 0 }) }), [/No run yet today/]);
  facts(get('after'), [/Harbor Half/, /Jan 17/]);
  facts(get('totals'), [/20 races/, /2 (on an )?age-group podiums?/]);
  facts(lines({ mi: false, stats: false })[0], [/All quiet/]);
});

test('the number of wordings per rule', () => {
  const n = (key, over) => get(key, over).ways.length;
  assert.equal(n('soon', { up: soon('2026-11-29') }), 2);
  for (const [key, over] of [['fetching', { mi: null, sync: { running: true, runsLoaded: false } }], ['raceday', { up: soon('2026-11-27') }],
    ['record', record], ['weekover', { mi: mi({ week: 22.4 }) }], ['latest'], ['yearahead', { mi: mi({ lytd: 1075 }) }],
    ['weeklow', { mi: mi({ dow: 5 }) }], ['yearbehind'], ['norun', { mi: mi({ runsToday: 0 }) }], ['after'], ['totals']]) {
    assert.equal(n(key, over), 3, key);
  }
});

test('every wording fits the cap, with the worst inputs, in miles and in km', () => {
  assert.equal(WORDINGS_CAP, 52);
  const longName = 'The Orchard And Harbor Invitational Race';
  const worst = (unit) => {
    const m = { unit, week: 122.4, weekAvg: 100, ytd: 12345, lytd: 11111, hasLastYear: true, runsWeek: 3, ws: utc(2026, 11, 23), dow: 4,
      days: [0, 0, 0, 0, 0, 0, 0], runsToday: 0 };
    const up = [{ id: 'u1', n: longName, date: '2026-12-02', time: '10:30' }, { id: 'u2', n: longName, date: '2027-09-30' }];
    const st = stats({ count: 120, podiums: 12, latest: [race({ n: longName, t: 5025, cls: 'Half Marathon', record: true })] });
    const sets = [
      { mi: m, stats: st, up: [{ ...up[0], date: '2026-11-27' }, up[1]], sync: { running: true, runsLoaded: false } },
      { mi: m, stats: stats({ ...st, latest: [race({ n: longName, t: 5025, cls: 'Half Marathon' })] }), up, sync: SYNC },
      { mi: { ...m, week: 72.4, weekAvg: 120.7, dow: 5, lytd: 13579 }, stats: st, up, sync: SYNC },
      { mi: { ...m, week: 50, weekAvg: 120.7 }, stats: st, up, sync: SYNC },
    ];
    return sets.flatMap((s) => lines(s));
  };
  const seen = new Set();
  const widest = {};
  for (const unit of ['mi', 'km']) for (const l of worst(unit)) {
    seen.add(l.key);
    for (const way of l.ways) {
      const n = graphemes(sayWay(way)).length;
      widest[l.key] = Math.max(widest[l.key] || 0, n);
      assert.ok(n <= WORDINGS_CAP, `${unit} ${l.key}: ${n} graphemes, "${sayWay(way)}"`);
    }
  }
  for (const k of ['fetching', 'raceday', 'record', 'soon', 'weekover', 'latest', 'yearahead', 'weeklow', 'yearbehind', 'norun', 'after', 'totals']) {
    assert.ok(seen.has(k), `worst case did not reach ${k}`);
  }
  if (process.env.SHOW_WIDEST) console.log(JSON.stringify(widest));
  assert.ok(fmtTime(5025).length > 0);
});
