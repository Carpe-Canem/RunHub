import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elevationPlan } from '../js/race-view.js';

const P = [[0, 10], [500, 12], [1000, 11]];
const det = (extra) => ({ at: 1, sp: { mi: [], km: [] }, ...extra });

test('elevationPlan draws a saved profile and asks for nothing', () => {
  assert.deepEqual(elevationPlan(det({ prof: P }), true, false, undefined), { draw: P });
});

test('elevationPlan fetches once: a GPS race with a detail and no profile, nothing in flight', () => {
  assert.deepEqual(elevationPlan(det(), true, false, undefined), { show: 'loading', fetch: true });
  assert.deepEqual(elevationPlan(det(), true, false, 'loading'), { show: 'loading' });
  assert.deepEqual(elevationPlan(det(), true, false, 'failed'), { show: 'unavailable' });
});

test('elevationPlan draws a fetched profile kept in memory when saving it was lost, and never fetches again', () => {
  // storage full: saveRaceDet dropped det.prof, the page kept the fetched array
  assert.deepEqual(elevationPlan(det(), true, false, P), { draw: P });
  assert.deepEqual(elevationPlan(det(), true, false, []), { show: 'none' });
});

test('elevationPlan: no GPS, no detail, a missing detail or the demo never fetch', () => {
  assert.deepEqual(elevationPlan(det(), false, false, undefined), { show: 'none' });
  assert.deepEqual(elevationPlan(null, true, false, undefined), { show: 'unavailable' });
  assert.deepEqual(elevationPlan({ at: 1, missing: true }, true, false, undefined), { show: 'unavailable' });
  assert.deepEqual(elevationPlan(det(), true, true, undefined), { show: 'unavailable' });
  assert.deepEqual(elevationPlan(det({ prof: [] }), true, false, undefined), { show: 'none' });
});
