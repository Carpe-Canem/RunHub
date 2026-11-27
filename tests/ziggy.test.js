import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAMES, W, H, cellPaths } from '../js/ziggy.js';

test('every frame is 14 rows of 24 allowed cells', () => {
  assert.deepEqual(Object.keys(FRAMES).sort(), ['nap', 'sit', 'trot1', 'trot2']);
  for (const [name, rows] of Object.entries(FRAMES)) {
    assert.equal(rows.length, H, `${name} has ${H} rows`);
    for (const row of rows) assert.match(row, new RegExp(`^[.oe#c]{${W}}$`), `${name}: "${row}"`);
  }
});

test('the trot frames differ only in the last three rows', () => {
  assert.deepEqual(FRAMES.trot1.slice(0, 11), FRAMES.trot2.slice(0, 11));
  assert.notDeepEqual(FRAMES.trot1.slice(11), FRAMES.trot2.slice(11));
});

test('every pose stands on the bottom row and has an unlit eye inside the head', () => {
  for (const [name, rows] of Object.entries(FRAMES)) assert.match(rows[H - 1], /[^.]/, `${name} touches the ground`);
  for (const name of ['trot1', 'sit']) assert.match(FRAMES[name][3], /o\.ooo/, `${name} has an eye`);
});

test('white on the muzzle is a single cell behind the nose, never a run', () => {
  for (const name of ['trot1', 'sit']) {
    assert.match(FRAMES[name][4], /o#o$/, `${name}: one white cell, then the nose`);
    assert.match(FRAMES[name][5], /o#\.\.$/, `${name}: one white cell under it`);
  }
});

test('only the collar is blue, and the nap has none', () => {
  assert.equal(FRAMES.trot1.join('').split('c').length - 1, 2);
  assert.equal(FRAMES.sit.join('').split('c').length - 1, 2);
  assert.ok(!FRAMES.nap.join('').includes('c'));
});

test('cellPaths draws one square per lit cell, grouped by kind, for the rows asked', () => {
  const d = cellPaths(['.o#', 'c.o'], 0, 2);
  assert.deepEqual(Object.keys(d).sort(), ['#', 'c', 'o']);
  assert.equal(d.o.split('M').length - 1, 2);
  assert.match(d['#'], /^M2\.08 0\.08h/);
  assert.deepEqual(Object.keys(cellPaths(['.o#', 'c.o'], 1, 2)).sort(), ['c', 'o']);
});
