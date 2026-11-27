import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS } from '../js/ziggy-frames.js';
import {
  TYPE_MS, TALK_MS, MOOD_MS, FIDGETS, WANDER, pickFidget, fidgetWait, steps, typedCount, carryTyped,
  splitParts, keepLine, canFidget, wanderTo, wanderMs,
} from '../js/ziggy-moves.js';

const MOODS = ['happy', 'thrilled', 'eager', 'curious', 'worried', 'asleep'];
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const total = (seq) => seq.reduce((s, [, ms]) => s + ms, 0);
const frames = (seq) => seq.map(([f]) => f);

test('the timings', () => {
  assert.deepEqual([TYPE_MS, TALK_MS, MOOD_MS], [1500, 130, 3200]);
});

test("a fidget is always from the mood's set and never the same twice running", () => {
  assert.deepEqual(Object.keys(FIDGETS).sort(), [...MOODS].sort());
  const rnd = seeded();
  for (const mood of MOODS) {
    let last = null;
    const got = new Set();
    for (let i = 0; i < 300; i++) {
      const next = pickFidget(mood, last, rnd);
      assert.ok(FIDGETS[mood].includes(next), `${mood}: ${next}`);
      assert.notEqual(next, last);
      got.add(next); last = next;
    }
    assert.equal(got.size, FIDGETS[mood].length, `${mood} plays its whole set`);
    // The ends of the generator's range still give a name from the set.
    for (const r of [0, 0.999999]) assert.ok(FIDGETS[mood].includes(pickFidget(mood, FIDGETS[mood][0], () => r)));
  }
});

test('asleep only twitches, worried only sighs or glances', () => {
  assert.deepEqual(FIDGETS.asleep, ['ear', 'paw']);
  assert.deepEqual(FIDGETS.worried, ['sigh', 'glance']);
});

test('the wait is 6 to 14 seconds', () => {
  assert.equal(fidgetWait(() => 0), 6000);
  const long = fidgetWait(() => 0.999);
  assert.ok(long > 13000 && long <= 14000);
});

test('every fidget lasts 1 to 2 seconds and uses real frames', () => {
  for (const mood of MOODS) {
    for (const move of FIDGETS[mood].filter((f) => f !== 'wander')) {
      const seq = steps(mood, move);
      assert.ok(total(seq) >= 1000 && total(seq) <= 2000, `${mood} ${move}: ${total(seq)} ms`);
      for (const f of frames(seq)) assert.ok(SHEETS.hub.frames.includes(f), `${mood} ${move}: ${f}`);
      assert.equal(seq.at(-1)[0], mood, `${mood} ${move} ends on the still`);
    }
  }
});

// He types and then moves without a break, so the two together are what must stay under 5 s (WCAG 2.2.2). The
// margin is for the stage's own timers, which run late by up to a quarter of a second over a line.
test("a mood's movement is about 3 seconds, ends on its still, and with the typing stays under 5", () => {
  for (const mood of MOODS) {
    const seq = steps(mood, 'mood');
    assert.ok(total(seq) >= 2500 && total(seq) <= MOOD_MS, `${mood}: ${total(seq)} ms`);
    assert.ok(TYPE_MS + total(seq) <= 4700, `${mood}: ${TYPE_MS + total(seq)} ms of unbroken movement`);
    assert.equal(seq.at(-1)[0], mood);
    for (const move of ['talk', 'mood', ...FIDGETS[mood].filter((f) => f !== 'wander')]) {
      const s = steps(mood, move);
      assert.ok(total(s) < 5000, `${mood} ${move}`);
      for (const f of frames(s)) assert.ok(SHEETS.hub.frames.includes(f), `${mood} ${move}: ${f}`);
    }
  }
});

test('talking swaps the still and its talking frame; asleep breathes', () => {
  for (const mood of MOODS.filter((m) => m !== 'asleep')) {
    assert.deepEqual(steps(mood, 'talk'), [[mood, 130], [`${mood}-talk`, 130]]);
  }
  assert.deepEqual(steps('asleep', 'talk'), [['asleep-breathe', 1000], ['asleep', 1000], ['asleep-breathe', 1000], ['asleep', 1000]]);
  assert.deepEqual(steps('asleep', 'mood'), [['asleep-breathe', 800], ['asleep', 800], ['asleep-breathe', 800], ['asleep', 800]]);
});

test('the sequences the owner approved', () => {
  assert.deepEqual(steps('happy', 'blink'), [['happy', 400], ['happy-blink', 120], ['happy', 220], ['happy-blink', 120], ['happy', 400]]);
  assert.deepEqual(steps('eager', 'tail').slice(0, 2), [['eager-tail', 150], ['eager', 150]]);
  assert.deepEqual(steps('thrilled', 'tail').slice(0, 2), [['thrilled-wag', 150], ['thrilled', 150]]);
  assert.equal(steps('thrilled', 'mood').length, 26);
  assert.deepEqual(steps('worried', 'sigh'), [['worried-low', 1300], ['worried', 300]]);
  assert.deepEqual(steps('curious', 'tilt'), [['curious-tilt', 1100], ['curious', 300]]);
  assert.deepEqual(steps('asleep', 'ear'), [['asleep-ear', 150], ['asleep', 150], ['asleep-ear', 150], ['asleep', 600]]);
});

test('a move a mood does not have is an error', () => {
  assert.throws(() => steps('worried', 'yawn'), /worried.*yawn/);
  assert.throws(() => steps('happy', 'wander'), /happy.*wander/);
  assert.throws(() => steps('cat', 'mood'), /cat/);
});

test("the wander's frames exist in its sheet and its scale is a whole number", () => {
  assert.deepEqual(WANDER, { sheet: 'hub', frames: ['eager', 'eager-trot'], scale: 1 });
  for (const f of WANDER.frames) assert.ok(SHEETS[WANDER.sheet].frames.includes(f));
  assert.ok(Number.isInteger(WANDER.scale));
});

test('typing', () => {
  assert.deepEqual([[0, 30], [750, 30], [1500, 30], [9999, 30], [100, 0], [-5, 30]].map(([ms, len]) => typedCount(ms, len)),
    [0, 15, 30, 30, 0, 0]);
});

test('the same line with new words keeps its place', () => {
  assert.equal(carryTyped(12, false, 40), 12);
  assert.equal(carryTyped(12, false, 8), 8);
  assert.equal(carryTyped(12, true, 40), 40);
});

test('a line cut part-way keeps its tones', () => {
  const parts = [{ text: '20:36!', tone: 'go' }, { text: ' A new 5K record.' }];
  assert.deepEqual(splitParts(parts, 3), { on: [{ text: '20:', tone: 'go' }], off: [{ text: '36!', tone: 'go' }, { text: ' A new 5K record.' }] });
  assert.deepEqual(splitParts(parts, 0), { on: [], off: parts });
  assert.deepEqual(splitParts(parts, 6), { on: [parts[0]], off: [parts[1]] });
  assert.deepEqual(splitParts(parts, 99), { on: parts, off: [] });
});

test('the line being shown survives a new list', () => {
  const list = [{ key: 'raceday' }, { key: 'latest' }, { key: 'totals' }];
  assert.deepEqual(keepLine(list, 'latest'), { i: 1, fresh: false });
  assert.deepEqual(keepLine(list, 'quiet'), { i: 0, fresh: true });
  assert.deepEqual(keepLine(list, null), { i: 0, fresh: true });
});

test('no fidget while hidden, off screen, typing or with reduced motion', () => {
  for (const hidden of [true, false]) {
    for (const onScreen of [true, false]) {
      for (const typing of [true, false]) {
        for (const motion of [true, false]) {
          assert.equal(canFidget({ hidden, onScreen, typing, motion }), !hidden && onScreen && !typing && motion);
        }
      }
    }
  }
});

test('a wander stays on the strip, goes somewhere else, and takes under 2 seconds', () => {
  const rnd = seeded(11);
  let x = 0;
  for (let i = 0; i < 200; i++) {
    const to = wanderTo(x, 312, rnd);
    assert.ok(to >= 0 && to <= 312, `${to}`);
    assert.ok(Math.abs(to - x) >= 48, `${x} to ${to}`);
    assert.ok(wanderMs(to - x) < 2000);
    x = to;
  }
  // The narrowest strip he walks on, from every kind of place, and a place the strip no longer reaches.
  for (const from of [0, 20, 48, 70, 96, 500]) {
    for (const r of [0, 0.5, 0.999999]) {
      const to = wanderTo(from, 96, () => r);
      assert.ok(to >= 0 && to <= 96 && Math.abs(to - Math.min(from, 96)) >= 48, `${from} to ${to}`);
    }
  }
  assert.equal(wanderTo(10, 60), 10);
  assert.ok(wanderMs(312) < 2000);
  assert.ok(wanderMs(-2000) < 2000);
  assert.equal(wanderMs(-100), wanderMs(100));
  assert.equal(wanderMs(0), 0);
});
