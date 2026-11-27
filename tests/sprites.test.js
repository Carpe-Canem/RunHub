import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHEETS, HEAD, framePos, sheetSize } from '../js/ziggy-frames.js';
import { readPalette, readFrame, parseGrid, sheetIndices, buildSheet } from '../scripts/build-sprites.mjs';
import { decodePng } from '../scripts/sprite-png.mjs';

const HUB = SHEETS.hub.frames;
const SIDE = SHEETS.side.frames;
const AWAKE = ['happy', 'thrilled', 'eager', 'curious', 'worried'];
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

test('he talks with the opposite mouth: tongue out in the still means none in the talking frame, and the other way round', () => {
  for (const mood of AWAKE) {
    const still = count(readFrame('hub', mood), 'p') > 0;
    const talk = count(readFrame('hub', `${mood}-talk`), 'p') > 0;
    assert.notEqual(still, talk, `${mood}: the still's mouth is ${still ? 'open' : 'shut'}, and so is the talking frame's`);
  }
  assert.ok(count(readFrame('hub', 'happy'), 'p') > 0, 'the happy still has his tongue out');
});

test('the collar is in every frame', () => {
  for (const name of HUB) assert.ok(count(readFrame('hub', name), 'b') > 0, name);
});

test('the collar is in every side frame', () => {
  for (const name of SIDE) assert.ok(count(readFrame('side', name), 'b') > 0, name);
});

test('every talking, blink and ear frame differs from its still only in a small box', () => {
  // Measured from the frames as drawn: the widest mouth is happy's (12 × 9), the widest pair of eyes 17 × 7,
  // the longest ear curious's (14 × 19, and happy's is 16 wide). Curious has his head cocked, so one eye sits
  // well above the other and his blink spans 16 × 14.
  const LIMIT = { talk: [12, 9], blink: [17, 7], ear: [16, 19], 'curious-blink': [16, 14] };
  for (const name of HUB) {
    const [mood, move] = name.split('-');
    if (!LIMIT[move]) continue;
    const box = diffBox(readFrame('hub', mood), readFrame('hub', name));
    const [w, h] = LIMIT[name] ?? LIMIT[move];
    assert.ok(box.w > 0 && box.w <= w && box.h <= h, `${name} differs in a ${box.w} × ${box.h} box, and the limit is ${w} × ${h}`);
  }
});

test('the approved happy frames keep their boxes', () => {
  const still = readFrame('hub', 'happy');
  const talk = diffBox(still, readFrame('hub', 'happy-talk'));
  const ear = diffBox(still, readFrame('hub', 'happy-ear'));
  // The owner approved these on 2026-11-27: the mouth shut is 12 × 9, the ear swung out is 16 × 18.
  assert.ok(talk.w > 0 && talk.w <= 12 && talk.h <= 9, `talk differs in a ${talk.w} × ${talk.h} box`);
  assert.ok(ear.w > 0 && ear.w <= 16 && ear.h <= 18, `ear differs in a ${ear.w} × ${ear.h} box`);
});

test('every frame but the still differs from its still', () => {
  for (const name of HUB) {
    const mood = name.split('-')[0];
    if (name !== mood) assert.ok(diffBox(readFrame('hub', mood), readFrame('hub', name)).w > 0, name);
  }
});

test("every mood's head point has him under it", () => {
  for (const [mood, x] of Object.entries(HEAD)) {
    assert.ok(readFrame('hub', mood).some((row) => row[x] !== '.'), `${mood}: column ${x} is empty`);
  }
});

test('the side frames stand on the bottom row, and the sit fills the cell top to bottom', () => {
  for (const name of SIDE) assert.match(readFrame('side', name).at(-1), /[^.]/, name);
  assert.match(readFrame('side', 'sit')[0], /[^.]/, 'sit reaches the top row');
});

test('the second trot frame is the first with the legs moved: the head and back are the same', () => {
  const a = readFrame('side', 'trot1'), b = readFrame('side', 'trot2');
  assert.ok(diffBox(a, b).w > 0, 'the legs moved');
  const top = a.findIndex((row) => /[^.]/.test(row));
  for (let y = top; y < top + 12; y++) assert.equal(b[y], a[y], `row ${y}`);
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

test('the committed sheets are what the grids build', () => {
  for (const sheet of Object.keys(SHEETS)) {
    const png = decodePng(readFileSync(new URL(`../sprites/ziggy-${sheet}.png`, import.meta.url)));
    assert.deepEqual({ w: png.width, h: png.height }, sheetSize(sheet), sheet);
    assert.deepEqual([...png.indices], [...sheetIndices(sheet)], `${sheet}: run node scripts/build-sprites.mjs`);
  }
});

test('he sniffs with his mouth shut, and his scratching paw is white', () => {
  for (const name of ['happy-sniff1', 'happy-sniff2']) assert.equal(count(readFrame('hub', name), 'p'), 0, name);
  for (const name of ['happy-scratch1', 'happy-scratch2']) {
    const rows = readFrame('hub', name), still = readFrame('hub', 'happy');
    // the raised paw is white well above where his feet are
    assert.ok(rows.slice(38, 52).join('').split('').filter((ch) => ch === 'w').length >
      still.slice(38, 52).join('').split('').filter((ch) => ch === 'w').length + 20, name);
  }
});
