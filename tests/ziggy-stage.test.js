import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START, onLines, onPress } from '../js/ziggy-stage.js';

const line = (key, text, mood = 'happy') => ({ key, mood, parts: [{ text }] });
const two = [line('a', 'First line.'), line('b', 'A second, longer line.')];

test('the first list starts at its first line and types from nothing', () => {
  const s = onLines(START, two, true);
  assert.deepEqual({ key: s.key, i: s.i, typed: s.typed, len: s.len, phase: s.phase }, { key: 'a', i: 0, typed: 0, len: 11, phase: 'typing' });
});

test('a redraw with the same lines changes nothing', () => {
  const s = { ...onLines(START, two, true), typed: 4 };
  assert.deepEqual(onLines(s, two, true), s);
  const still = { ...s, typed: 11, phase: 'still' };
  assert.deepEqual(onLines(still, two, true), still);
});

test('the line he is on is kept when the order changes, and its typing carries on', () => {
  const s = { ...onLines(START, two, true), typed: 4 };
  const n = onLines(s, [line('z', 'Something more important.'), two[0]], true);
  assert.deepEqual({ key: n.key, i: n.i, typed: n.typed, phase: n.phase }, { key: 'a', i: 1, typed: 4, phase: 'typing' });
});

test('new words for the same line: a part-typed line carries on, a finished one stays whole', () => {
  const typing = { ...onLines(START, two, true), typed: 4 };
  const grown = onLines(typing, [line('a', 'First line, grown.'), two[1]], true);
  assert.deepEqual([grown.typed, grown.len, grown.phase], [4, 18, 'typing']);
  const cut = onLines({ ...typing, typed: 9 }, [line('a', 'First.'), two[1]], true);
  assert.deepEqual([cut.typed, cut.len], [6, 6]);
  for (const phase of ['moving', 'still', 'fidget', 'wander']) {
    const done = onLines({ ...typing, typed: 11, phase, to: 40 }, [line('a', 'First line, grown.'), two[1]], true);
    assert.deepEqual([done.typed, done.len, done.phase], [18, 18, phase], phase);
  }
});

test('a line that is gone: he starts again from the first line', () => {
  const s = { ...onLines(START, two, true), typed: 11, phase: 'still', x: 120, last: 'ear' };
  const n = onLines(s, [line('c', 'New.'), line('d', 'Newer.')], true);
  assert.deepEqual({ key: n.key, i: n.i, typed: n.typed, len: n.len, phase: n.phase, x: n.x, last: n.last },
    { key: 'c', i: 0, typed: 0, len: 4, phase: 'typing', x: 120, last: 'ear' });
});

test('a press shows the next line, wraps to the first, and does nothing with one line', () => {
  let s = { ...onLines(START, two, true), typed: 11, phase: 'still' };
  s = onPress(s, two, true);
  assert.deepEqual([s.key, s.i, s.typed, s.len, s.phase], ['b', 1, 0, 22, 'typing']);
  s = onPress(s, two, true);
  assert.deepEqual([s.key, s.i, s.typed, s.phase], ['a', 0, 0, 'typing']);
  const one = onLines(START, [two[0]], true);
  assert.equal(onPress(one, [two[0]], true), one);
});

test('a press mid-wander puts him at his target at once, and the next line types', () => {
  const s = { ...onLines(START, two, true), typed: 11, phase: 'wander', x: 30, to: 210, last: 'wander' };
  const n = onPress(s, two, true);
  assert.deepEqual({ key: n.key, typed: n.typed, phase: n.phase, x: n.x, to: n.to }, { key: 'b', typed: 0, phase: 'typing', x: 210, to: null });
});

test('a new list mid-wander: a kept line leaves the trip alone, a fresh one lands him', () => {
  const s = { ...onLines(START, two, true), typed: 11, phase: 'wander', x: 30, to: 210 };
  const kept = onLines(s, two, true);
  assert.deepEqual([kept.phase, kept.x, kept.to], ['wander', 30, 210]);
  const fresh = onLines(s, [line('c', 'New.')], true);
  assert.deepEqual([fresh.phase, fresh.x, fresh.to], ['typing', 210, null]);
});

test('reduced motion: every line is whole at once and he is still where he stands', () => {
  const first = onLines(START, two, false);
  assert.deepEqual([first.typed, first.len, first.phase], [11, 11, 'still']);
  const next = onPress(first, two, false);
  assert.deepEqual([next.key, next.typed, next.len, next.phase], ['b', 22, 22, 'still']);
  // Motion was switched off part-way through a line, or a trip.
  const typing = { ...onLines(START, two, true), typed: 3 };
  assert.deepEqual([onLines(typing, two, false).typed, onLines(typing, two, false).phase], [11, 'still']);
  const trip = onLines({ ...typing, typed: 11, phase: 'wander', x: 30, to: 210 }, two, false);
  assert.deepEqual([trip.phase, trip.x, trip.to], ['still', 210, null]);
});

test('a line of several parts is as long as all of them', () => {
  const parts = [{ text: '20:36!', tone: 'go' }, { text: ' A new 5K record.' }];
  assert.equal(onLines(START, [{ key: 'record', mood: 'thrilled', parts }], true).len, 23);
});
