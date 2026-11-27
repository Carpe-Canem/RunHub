import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS, framePos, sheetSize, sheetUrl } from '../js/ziggy-frames.js';

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
  assert.deepEqual(framePos('hub', 'happy-ear'), { x: 192, y: 0, w: 96, h: 88 });
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
