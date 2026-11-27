import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitPoints, markSplits, elevationChart } from '../js/race-draw.js';

test('fitPoints keeps every point inside the box with its padding', () => {
  const pts = [[40.0, -75.0], [40.01, -74.98], [39.995, -75.02], [40.02, -75.01]];
  const out = fitPoints(pts, 100, 60, 6);
  assert.equal(out.length, pts.length);
  for (const [x, y] of out) {
    assert.ok(x >= 6 - 1e-9 && x <= 94 + 1e-9, `x ${x} inside`);
    assert.ok(y >= 6 - 1e-9 && y <= 54 + 1e-9, `y ${y} inside`);
  }
});

test('fitPoints: a north-south line stays taller than it is wide, north at the top', () => {
  const out = fitPoints([[50.0, 8.0], [50.02, 8.001], [50.04, 8.0]], 80, 80, 4);
  const xs = out.map((p) => p[0]), ys = out.map((p) => p[1]);
  assert.ok(Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs));
  assert.ok(out[2][1] < out[0][1]);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 40) < 1e-9, 'centred across');
});

test('fitPoints keeps the aspect ratio using cos(mean latitude)', () => {
  // at 60°N one degree of longitude is half a degree of latitude on the ground: a 0.02 x 0.01 box is square
  const out = fitPoints([[60.0, 10.0], [60.01, 10.02]], 100, 100, 0);
  const w = Math.abs(out[1][0] - out[0][0]), hgt = Math.abs(out[1][1] - out[0][1]);
  assert.ok(Math.abs(w - hgt) / w < 0.01, `${w} vs ${hgt}`);
});

test('fitPoints of a single point puts it in the centre', () => {
  assert.deepEqual(fitPoints([[40, -75]], 100, 60, 6), [[50, 30]]);
  assert.deepEqual(fitPoints([[1, 2], [1, 2]], 40, 40, 4), [[20, 20], [20, 20]]);
});

test('fitPoints of nothing is empty', () => {
  assert.deepEqual(fitPoints([], 40, 40, 4), []);
  assert.deepEqual(fitPoints(null, 40, 40, 4), []);
});

test('markSplits marks fastest and slowest full splits and never the short last one', () => {
  assert.deepEqual(markSplits([[1609, 400, 0], [1609, 380, 0], [1609, 420, 0], [300, 60, 0]], 1609.344), { fastest: 1, slowest: 2 });
});

test('markSplits of one full split marks nothing', () => {
  assert.deepEqual(markSplits([[1609, 400, 0]], 1609.344), { fastest: null, slowest: null });
  assert.deepEqual(markSplits([[1000, 300, 0], [400, 100, 0]], 1000), { fastest: null, slowest: null });
});

test('markSplits skips empty splits and marks nothing when every pace is equal', () => {
  assert.deepEqual(markSplits([[0, 0, 0], [1000, 300, 0], [1000, 290, 0]], 1000), { fastest: 2, slowest: 1 });
  assert.deepEqual(markSplits([[1000, 300, 0], [1000, 300, 0]], 1000), { fastest: null, slowest: null });
  assert.deepEqual(markSplits(null, 1000), { fastest: null, slowest: null });
});

test('elevationChart draws nothing with fewer than two usable points', () => {
  assert.equal(elevationChart([], 'mi'), null);
  assert.equal(elevationChart([[0, 100]], 'mi'), null);
  assert.equal(elevationChart([[0, NaN], [10, 100], [null, 5], 'x'], 'km'), null);
});
