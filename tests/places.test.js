import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACE_LOOKUPS, pointKey, placeUrl, placeLabel } from '../js/places.js';

test('PLACE_LOOKUPS is on', () => assert.equal(PLACE_LOOKUPS, true));

test('pointKey rounds to two decimals', () => {
  assert.equal(pointKey([40.01549, -105.27051]), '40.02,-105.27');
  assert.equal(pointKey([40, -105.2]), '40,-105.2');
});

test('placeUrl asks Nominatim for a town-level reverse lookup', () => {
  assert.equal(placeUrl([40.01549, -105.27051]), 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=40.02&lon=-105.27&zoom=10&addressdetails=1');
});

test('placeLabel builds town and region', () => {
  assert.equal(placeLabel({ address: { town: 'Riverbend', 'ISO3166-2-lvl4': 'US-CO', state: 'Colorado' } }), 'Riverbend, CO');
  assert.equal(placeLabel({ address: { city: 'Orchard', hamlet: 'Old Mill', state: 'Frostbite' } }), 'Orchard, Frostbite');
  assert.equal(placeLabel({ address: { county: 'Canyon County', state: 'Frostbite' } }), 'Canyon County, Frostbite');
  assert.equal(placeLabel({ address: { village: 'Creekside', 'ISO3166-2-lvl4': 'GB-ENGL', state: 'Rail Trail' } }), 'Creekside, Rail Trail');
  assert.equal(placeLabel({ address: { state: 'Frostbite' } }), 'Frostbite');
  assert.equal(placeLabel({ address: { country: 'Water Tower' } }), 'Water Tower');
  assert.equal(placeLabel({ address: { town: 'Library Hill' } }), 'Library Hill');
});

test('placeLabel returns null when there is nothing to say', () => {
  assert.equal(placeLabel({ error: 'Unable to geocode' }), null);
  assert.equal(placeLabel({}), null);
  assert.equal(placeLabel(null), null);
});
