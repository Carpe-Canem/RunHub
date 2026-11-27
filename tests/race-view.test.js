import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elevationPlan, weatherState } from '../js/race-view.js';

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

test('weatherState follows the start point and the cache', () => {
  assert.equal(weatherState({ ll: null, wx: null }), 'none');
  assert.equal(weatherState({ ll: null, wx: { t: 1 } }), 'none');
  assert.equal(weatherState({ ll: [1, 2], wx: null }), 'pending');
  assert.equal(weatherState({ ll: [1, 2], wx: { t: 1 } }), 'ok');
});

test('finishPhase: the run-up, then three hops for a record only, then done', async () => {
  const { finishPhase, RUN_MS, HOP_MS } = await import('../js/race-view.js');
  assert.deepEqual(finishPhase(0, false), { phase: 'run', p: 0 });
  assert.deepEqual(finishPhase(RUN_MS / 2, true), { phase: 'run', p: 0.5 });
  assert.deepEqual(finishPhase(RUN_MS, false), { phase: 'done', p: 1 });
  assert.deepEqual(finishPhase(RUN_MS, true), { phase: 'hop', p: 1 });
  assert.deepEqual(finishPhase(RUN_MS + HOP_MS - 1, true), { phase: 'hop', p: 1 });
  assert.deepEqual(finishPhase(RUN_MS + HOP_MS, true), { phase: 'done', p: 1 });
  assert.ok(RUN_MS >= 1000 && RUN_MS <= 1400);
});

test('easeOut: 0 to 1, slowing into the end, and the run-up uses it', async () => {
  const { easeOut, runUpAt } = await import('../js/race-rules.js');
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(5), 1);
  assert.ok(easeOut(0.5) > 0.8);
  assert.equal(runUpAt(1000, 0.5), Math.round(1000 * easeOut(0.5)));
});
