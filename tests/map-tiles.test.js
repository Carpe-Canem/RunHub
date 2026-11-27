import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARTO_HOST, mapSource, tileSpec } from '../js/map-tiles.js';

test('mapSource picks CARTO only on the site\'s host with a key, and the browser\'s choice wins', () => {
  assert.equal(mapSource('carpe-canem.github.io', null, 'k'), 'carto');
  assert.equal(mapSource('localhost', null, 'k'), 'osm');
  assert.equal(mapSource(CARTO_HOST, null, ''), 'osm');
  assert.equal(mapSource('localhost', 'carto', 'k'), 'carto');
  assert.equal(mapSource(CARTO_HOST, 'osm', 'k'), 'osm');
  assert.equal(mapSource(CARTO_HOST, 'carto', ''), 'osm');
  assert.equal(mapSource('localhost', 'carto', ''), 'osm');
});

test('tileSpec for CARTO is the navy recipe', () => {
  const t = tileSpec('carto', 'k');
  assert.deepEqual(t.base, { url: 'https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png?key=k', className: 'map-carto' });
  assert.deepEqual(t.labels, { url: 'https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png?key=k', className: 'map-labels' });
  assert.match(t.attribution, /OpenStreetMap/);
  assert.match(t.attribution, /CARTO/);
});

test('tileSpec for OpenStreetMap is the single recoloured layer', () => {
  const t = tileSpec('osm', 'k');
  assert.deepEqual(t.base, { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', className: 'map-navy' });
  assert.equal(t.labels, null);
  assert.match(t.attribution, /OpenStreetMap/);
});

test('the key is URL-encoded in the tile address', () => {
  assert.match(tileSpec('carto', 'a b&c').base.url, /\?key=a%20b%26c$/);
});
