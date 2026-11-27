import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS, framePos, sheetSize } from '../js/ziggy-frames.js';
import { readPalette, readFrame, parseGrid, sheetIndices, buildSheet } from '../scripts/build-sprites.mjs';
import { decodePng } from '../scripts/sprite-png.mjs';

const HUB = SHEETS.hub.frames;
const opaque = (rows) => rows.join('').replaceAll('.', '').length;
const count = (rows, letters) => [...rows.join('')].filter((ch) => letters.includes(ch)).length;

// The smallest box holding every pixel where two grids differ: { w, h }, or zeros when they are the same.
function diffBox(a, b) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  a.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === b[y][x]) return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }));
  return x1 < 0 ? { w: 0, h: 0 } : { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

test('the palette has at most 16 colours, each one letter and #RRGGBB', () => {
  const palette = readPalette();
  assert.ok(palette.length >= 1 && palette.length <= 16, `${palette.length} colours`);
  for (const { letter, hex, name } of palette) {
    assert.match(letter, /^[a-z]$/);
    assert.match(hex, /^#[0-9A-F]{6}$/);
    assert.ok(name.length > 0, `${letter} has a name`);
  }
  assert.equal(new Set(palette.map((c) => c.letter)).size, palette.length, 'letters are unique');
});

test('every frame has a grid of exactly its cell, in palette letters', () => {
  const letters = `.${readPalette().map((c) => c.letter).join('')}`;
  for (const [sheet, { cell: [w, h], frames }] of Object.entries(SHEETS)) {
    for (const name of frames) {
      const rows = readFrame(sheet, name);
      assert.equal(rows.length, h, `${sheet}/${name} has ${h} rows`);
      for (const row of rows) {
        assert.equal(row.length, w, `${sheet}/${name} rows are ${w} wide`);
        for (const ch of row) assert.ok(letters.includes(ch), `${sheet}/${name} uses "${ch}"`);
      }
    }
  }
});

test('a missing or mis-sized grid is an error naming the file', () => {
  assert.throws(() => readFrame('hub', 'no-such-frame'), /no-such-frame\.txt/);
  assert.throws(() => parseGrid('ok\nok\n', [2, 3], '.ok', 'short.txt'), /short\.txt.*2 rows.*3/);
  assert.throws(() => parseGrid('ok\no\n', [2, 2], '.ok', 'narrow.txt'), /narrow\.txt.*row 2/);
  assert.throws(() => parseGrid('ok\nox\n', [2, 2], '.ok', 'letters.txt'), /letters\.txt.*"x"/);
  assert.deepEqual(parseGrid('ok\r\n.o\r\n', [2, 2], '.ok', 'crlf.txt'), ['ok', '.o']);
});

test('the outline is one colour', () => {
  for (const [sheet, { cell: [w, h], frames }] of Object.entries(SHEETS)) {
    for (const name of frames) {
      const rows = readFrame(sheet, name);
      const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || rows[y][x] === '.';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (rows[y][x] === '.' || rows[y][x] === 'o') continue;
        assert.ok(!clear(x - 1, y) && !clear(x + 1, y) && !clear(x, y - 1) && !clear(x, y + 1),
          `${sheet}/${name}: "${rows[y][x]}" at ${x},${y} is on the edge, where only the outline goes`);
      }
    }
  }
});

test('every hub frame stands on the bottom row', () => {
  for (const name of HUB) assert.match(readFrame('hub', name).at(-1), /[^.]/, name);
});

test('tan is a small accent', () => {
  for (const name of HUB) {
    const rows = readFrame('hub', name);
    const share = count(rows, 'tu') / opaque(rows);
    assert.ok(share > 0 && share < 0.015, `${name}: tan is ${(share * 100).toFixed(2)}% of him`);   // the approved still: 0.72%
  }
});

test('happy talks by shutting his mouth: the talking frame shows no tongue', () => {
  assert.ok(count(readFrame('hub', 'happy'), 'p') > 0, 'the still has his tongue out');
  assert.equal(count(readFrame('hub', 'happy-talk'), 'p'), 0);
});

test('the collar is in every frame', () => {
  for (const name of HUB) assert.ok(count(readFrame('hub', name), 'b') > 0, name);
});

test('a talking or ear frame differs from its still only near the mouth or ear', () => {
  const still = readFrame('hub', 'happy');
  const talk = diffBox(still, readFrame('hub', 'happy-talk'));
  const ear = diffBox(still, readFrame('hub', 'happy-ear'));
  // The boxes are the approved frames' own: the mouth shut is 12 × 9, the ear swung out is 16 × 18.
  assert.ok(talk.w > 0 && talk.w <= 12 && talk.h <= 9, `talk differs in a ${talk.w} × ${talk.h} box`);
  assert.ok(ear.w > 0 && ear.w <= 16 && ear.h <= 18, `ear differs in a ${ear.w} × ${ear.h} box`);
});

test('a built sheet holds each frame at its place', () => {
  const letters = `.${readPalette().map((c) => c.letter).join('')}`;
  const { w } = sheetSize('hub');
  const sheet = sheetIndices('hub');
  assert.equal(sheet.length, w * sheetSize('hub').h);
  for (const name of HUB) {
    const rows = readFrame('hub', name);
    const pos = framePos('hub', name);
    for (let y = 0; y < pos.h; y++) for (let x = 0; x < pos.w; x++) {
      assert.equal(letters[sheet[(pos.y + y) * w + pos.x + x]], rows[y][x], `${name} at ${x},${y}`);
    }
  }
});

test('the PNG a sheet builds into decodes back to the grids, in the palette\'s colours', () => {
  const png = decodePng(buildSheet('hub'));
  assert.deepEqual({ w: png.width, h: png.height }, sheetSize('hub'));
  assert.deepEqual([...png.indices], [...sheetIndices('hub')]);
  const first = readPalette()[0];
  assert.equal(`#${png.palette[1].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`, first.hex);
});
