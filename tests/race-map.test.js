import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseLayers, STATIC, canMap } from '../js/race-map.js';

test('courseLayers draws the glow, the line, the finish, then the start last, in the class colour', () => {
  const pts = [[1, 2], [3, 4], [5, 6]];
  assert.deepEqual(courseLayers(pts, '#abcdef'), [
    { kind: 'line', weight: 9, opacity: 0.22, colour: '#abcdef' },
    { kind: 'line', weight: 3.5, opacity: 1, colour: '#abcdef' },
    { kind: 'dot', at: [5, 6], radius: 5, fill: '#FF7373' },
    { kind: 'ring', at: [1, 2], radius: 6, stroke: '#35D69B', fill: '#04070D' },
  ]);
});

test('STATIC turns off every way to pan or zoom', () => {
  for (const k of ['zoomControl', 'dragging', 'touchZoom', 'scrollWheelZoom', 'doubleClickZoom', 'boxZoom', 'keyboard', 'tap']) assert.equal(STATIC[k], false, k);
});

test('canMap needs Leaflet and two points', () => {
  const pts = [[1, 2], [3, 4]];
  assert.equal(canMap(undefined, pts), false);
  assert.equal(canMap({}, []), false);
  assert.equal(canMap({}, [[1, 2]]), false);
  assert.equal(canMap({}, null), false);
  assert.equal(canMap({}, pts), true);
});
