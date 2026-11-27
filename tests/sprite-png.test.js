import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePng, decodePng } from '../scripts/sprite-png.mjs';

const PALETTE = [[0, 0, 0], [255, 255, 255], [47, 108, 214]];

test('a grid survives encode then decode', () => {
  const indices = Uint8Array.from([0, 1, 2, 2, 1, 0]);
  const back = decodePng(encodePng(3, 2, indices, PALETTE));
  assert.equal(back.width, 3);
  assert.equal(back.height, 2);
  assert.deepEqual([...back.indices], [...indices]);
  assert.deepEqual(back.palette, PALETTE);
});

test('the file is an indexed PNG with index 0 transparent', () => {
  const png = encodePng(3, 2, Uint8Array.from([0, 1, 2, 2, 1, 0]), PALETTE);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('latin1', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 3, 'width');
  assert.equal(png.readUInt32BE(20), 2, 'height');
  assert.equal(png[24], 8, 'bit depth');
  assert.equal(png[25], 3, 'colour type');
  const at = png.indexOf('tRNS', 0, 'latin1');
  assert.ok(at > 0, 'has a tRNS chunk');
  assert.equal(png[at + 4], 0, 'index 0 is fully transparent');
  assert.ok(png.indexOf('PLTE', 0, 'latin1') < at, 'PLTE comes before tRNS');
});

test('a grid that is not width × height is refused', () => {
  assert.throws(() => encodePng(3, 2, Uint8Array.from([0, 1, 2]), PALETTE), /3 × 2/);
});
