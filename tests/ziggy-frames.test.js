import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS, HEAD, framePos, sheetSize, sheetUrl } from '../js/ziggy-frames.js';

const MOODS = ['happy', 'thrilled', 'eager', 'curious', 'worried', 'asleep'];

test('every named frame lies inside its sheet', () => {
  for (const [sheet, { cell, frames }] of Object.entries(SHEETS)) {
    const size = sheetSize(sheet);
    for (const name of frames) {
      const { x, y, w, h } = framePos(sheet, name);
      assert.deepEqual([w, h], cell, `${sheet}/${name} is one cell`);
      assert.ok(x >= 0 && y >= 0 && x + w <= size.w && y + h <= size.h, `${sheet}/${name} is inside the sheet`);
    }
  }
});

test('a frame sits at its place in the list, eight to a row on the hub sheet', () => {
  assert.deepEqual(framePos('hub', 'happy'), { x: 0, y: 0, w: 96, h: 88 });
  assert.deepEqual(framePos('hub', 'happy-wag'), { x: 192, y: 0, w: 96, h: 88 });
  assert.deepEqual(framePos('hub', 'happy-tilt'), { x: 0, y: 88, w: 96, h: 88 });
  assert.deepEqual(framePos('side', 'nap'), { x: 144, y: 0, w: 48, h: 40 });
});

test('the hub sheet is 768 × 440 with 33 frames, the side sheet 192 × 40 with four', () => {
  assert.equal(SHEETS.hub.frames.length, 33);
  assert.deepEqual(sheetSize('hub'), { w: 768, h: 440 });
  assert.deepEqual(SHEETS.side.frames, ['sit', 'trot1', 'trot2', 'nap']);
  assert.deepEqual(sheetSize('side'), { w: 192, h: 40 });
});

test('every mood has a still and a movement, and a talking frame unless it is asleep', () => {
  const MOVE = { happy: 'wag', thrilled: 'wag', eager: 'trot', curious: 'tilt', worried: 'low', asleep: 'breathe' };
  for (const mood of MOODS) {
    assert.ok(SHEETS.hub.frames.includes(mood), `${mood} has a still`);
    assert.ok(SHEETS.hub.frames.includes(`${mood}-${MOVE[mood]}`), `${mood} has its movement`);
    assert.equal(SHEETS.hub.frames.includes(`${mood}-talk`), mood !== 'asleep', `${mood}-talk`);
  }
});

test('every hub frame belongs to one of the six moods', () => {
  for (const name of SHEETS.hub.frames) assert.ok(MOODS.includes(name.split('-')[0]), name);
});

test("every mood's head point lies inside the cell", () => {
  assert.deepEqual(Object.keys(HEAD), MOODS);
  for (const mood of MOODS) assert.ok(Number.isInteger(HEAD[mood]) && HEAD[mood] >= 0 && HEAD[mood] < SHEETS.hub.cell[0], `${mood}: ${HEAD[mood]}`);
});

test('an unknown frame or sheet is an error', () => {
  assert.throws(() => framePos('hub', 'no-such-frame'), /no-such-frame/);
  assert.throws(() => framePos('no-such-sheet', 'happy'), /no-such-sheet/);
});

test('a sheet is a whole number of cells', () => {
  for (const [sheet, { cell, cols }] of Object.entries(SHEETS)) {
    const { w, h } = sheetSize(sheet);
    assert.equal(w, cols * cell[0], `${sheet} is ${cols} cells wide`);
    assert.equal(h % cell[1], 0, `${sheet} is whole rows high`);
    assert.ok(h >= cell[1], `${sheet} has at least one row`);
  }
});

test('frame names are unique within a sheet', () => {
  for (const [sheet, { frames }] of Object.entries(SHEETS)) assert.equal(new Set(frames).size, frames.length, sheet);
});

test('the sheet\'s address carries the script\'s version', () => {
  assert.equal(sheetUrl('hub', 'https://x.test/js/ziggy-frames.js?v=43'), 'https://x.test/sprites/ziggy-hub.png?v=43');
  assert.equal(sheetUrl('side', 'https://x.test/js/ziggy-frames.js'), 'https://x.test/sprites/ziggy-side.png');
});
