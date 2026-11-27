import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// Just enough PNG to read pixels: 8-bit RGB or RGBA, not interlaced.
function readPng(name) {
  const b = readFileSync(new URL(`../${name}`, import.meta.url));
  let p = 8; const idat = []; let w = 0; let h = 0; let ch = 0;
  while (p < b.length) {
    const len = b.readUInt32BE(p); const type = b.toString('latin1', p + 4, p + 8); const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      assert.equal(data[8], 8, `${name}: 8 bits per channel`);
      assert.ok(data[9] === 2 || data[9] === 6, `${name}: RGB or RGBA`);
      assert.equal(data[12], 0, `${name}: not interlaced`);
      ch = data[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * ch; const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const u = y ? px[(y - 1) * stride + x] : 0;
      const c = y && x >= ch ? px[(y - 1) * stride + x - ch] : 0;
      const pa = Math.abs(u - c); const pb = Math.abs(a - c); const pc = Math.abs(a + u - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      px[y * stride + x] = (v + [0, a, u, (a + u) >> 1, paeth][f]) & 255;
    }
  }
  return { w, h, at: (x, y) => [...px.subarray(y * stride + x * ch, y * stride + x * ch + 3)] };
}

const AMBER = [255, 181, 46];
const near = (c) => c.every((v, i) => Math.abs(v - AMBER[i]) <= 6);

for (const size of [180, 512]) {
  test(`icon-${size}.png is ${size} px square and amber on every edge (full-bleed: the home screen masks it)`, () => {
    const img = readPng(`icon-${size}.png`);
    assert.deepEqual([img.w, img.h], [size, size]);
    for (let i = 0; i < size; i++) {
      for (const [x, y] of [[i, 0], [i, size - 1], [0, i], [size - 1, i]]) assert.ok(near(img.at(x, y)), `pixel ${x},${y} is ${img.at(x, y)}`);
    }
  });

  test(`icon-${size}.png keeps both figures inside the middle 88%, centred`, () => {
    const img = readPng(`icon-${size}.png`);
    let l = size; let r = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!near(img.at(x, y))) { if (x < l) l = x; if (x > r) r = x; }
    assert.ok(l >= size * 0.06 && r <= size * 0.94, `ink spans ${l} to ${r}`);
    assert.ok(Math.abs((l + r) / 2 - size / 2) <= size * 0.02, `ink is centred: ${l} to ${r}`);
  });
}
