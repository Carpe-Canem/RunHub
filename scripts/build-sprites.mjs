// Usage: node scripts/build-sprites.mjs [--out <dir>]
// Builds Ziggy's sprite sheets from the text grids in sprites/src/: one PNG per sheet in js/ziggy-frames.js,
// written to sprites/ (or to <dir>). Each grid is one palette letter per pixel, "." for transparent.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SHEETS, framePos, sheetSize } from '../js/ziggy-frames.js';
import { encodePng } from './sprite-png.mjs';

const SRC = new URL('../sprites/src/', import.meta.url);
const OUT = new URL('../sprites/', import.meta.url);

// [{ letter, hex, name }], in file order. A pixel's palette index is its colour's place here plus one. The dog's
// sheets use palette.txt; a sheet that names a palette of its own (the props) uses that.
export function readPalette(file = 'palette.txt') {
  const lines = readFileSync(new URL(file, SRC), 'utf8').split(/\r?\n/).filter((line) => line.trim());
  const palette = lines.map((line) => {
    const m = /^([a-z]) (#[0-9A-F]{6}) (.+)$/.exec(line.trim());
    if (!m) throw new Error(`${file}: "${line}" is not a letter, #RRGGBB and a name`);
    return { letter: m[1], hex: m[2], name: m[3] };
  });
  if (palette.length > 16) throw new Error(`${file}: ${palette.length} colours, and the limit is 16`);
  if (new Set(palette.map((c) => c.letter)).size !== palette.length) throw new Error(`${file}: a letter is used twice`);
  return palette;
}

// The rows of one grid, checked against its cell and the letters it may use.
export function parseGrid(text, [w, h], letters, file) {
  const rows = text.split(/\r?\n/);
  while (rows.length && rows.at(-1) === '') rows.pop();
  if (rows.length !== h) throw new Error(`${file}: ${rows.length} rows, and the cell is ${h} high`);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${file}: row ${y + 1} is ${row.length} wide, and the cell is ${w}`);
    for (const ch of row) if (!letters.includes(ch)) throw new Error(`${file}: row ${y + 1} uses "${ch}", which is not in the palette`);
  });
  return rows;
}

export const paletteOf = (sheet) => readPalette(SHEETS[sheet].palette);

export function readFrame(sheet, name) {
  const file = `sprites/src/${sheet}/${name}.txt`;
  let text;
  try {
    text = readFileSync(new URL(`${sheet}/${name}.txt`, SRC), 'utf8');
  } catch {
    throw new Error(`${file} is missing`);
  }
  return parseGrid(text, SHEETS[sheet].cell, `.${paletteOf(sheet).map((c) => c.letter).join('')}`, file);
}

// The whole sheet as palette indices, row by row: 0 is transparent, 1 is the palette's first colour.
export function sheetIndices(sheet) {
  const letters = `.${paletteOf(sheet).map((c) => c.letter).join('')}`;
  const { w, h } = sheetSize(sheet);
  const out = new Uint8Array(w * h);
  for (const name of SHEETS[sheet].frames) {
    const pos = framePos(sheet, name);
    readFrame(sheet, name).forEach((row, y) => {
      for (let x = 0; x < pos.w; x++) out[(pos.y + y) * w + pos.x + x] = letters.indexOf(row[x]);
    });
  }
  return out;
}

export function buildSheet(sheet) {
  const { w, h } = sheetSize(sheet);
  const rgb = paletteOf(sheet).map(({ hex }) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  return encodePng(w, h, sheetIndices(sheet), [[0, 0, 0], ...rgb]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const at = process.argv.indexOf('--out');
  if (at > 0 && !process.argv[at + 1]) throw new Error('--out needs a folder');
  const dir = at > 0 ? resolve(process.argv[at + 1]) : fileURLToPath(OUT);
  mkdirSync(dir, { recursive: true });
  for (const sheet of Object.keys(SHEETS)) {
    const path = resolve(dir, `ziggy-${sheet}.png`);
    const png = buildSheet(sheet);
    writeFileSync(path, png);
    const { w, h } = sheetSize(sheet);
    console.log(`${path}: ${SHEETS[sheet].frames.length} frames, ${w} × ${h}, ${png.length} bytes`);
  }
}
