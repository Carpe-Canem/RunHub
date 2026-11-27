import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, bus } from '../js/core.js';
import { sync } from '../js/sync.js';
import * as runs from '../js/runs-model.js';

let mem; let events; let was;
bus.on('data', () => events.push(['data', S.syncing]));
beforeEach(() => {
  events = [];
  mem = { 'lw.token': JSON.stringify({ access_token: 'A0', refresh_token: 'R0', expires_at: Math.floor(Date.now() / 1000) + 86400, athleteId: 42 }), 'lw.creds': JSON.stringify({ clientId: '1', clientSecret: 'testsecretnotreal000000' }) };
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  was = { fetch: globalThis.fetch, error: console.error };
  globalThis.fetch = async () => { throw new TypeError('no network in this test'); };
  console.error = () => {};
});
afterEach(() => { globalThis.fetch = was.fetch; console.error = was.error; delete globalThis.localStorage; Object.assign(S, { athleteId: null, cache: null, error: null }); });

// The views redraw on 'data' only. Ziggy's "Fetching your runs from Strava." needs a draw while the sync runs and
// the runs are not loaded yet, and 'status' does not give him one.
test('the first sync asks for a redraw as it starts, before any run is loaded', async () => {
  Object.assign(S, { athleteId: 42, cache: { athlete: null, acts: {}, lastStart: 0 } });
  const done = sync(false);
  assert.deepEqual(events, [['data', true]]);
  await done;
});

test('a later sync, with the runs on screen, does not redraw as it starts', async () => {
  Object.assign(S, { athleteId: 42, cache: { athlete: { id: 42, units: 'mi' }, acts: {}, lastStart: 0, lastSync: Date.now() - 36e5 } });
  const done = sync(false);
  assert.deepEqual(events, []);
  await done;
});

// Strava lists oldest first, so a list that stops part-way holds old runs only. Shown as loaded, they would put
// "0 miles, behind last year" on the hub and in Ziggy's mouth.
test('a first sync that stops part-way does not leave the runs counted as loaded', async () => {
  const old = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, sport_type: 'Run', distance: 5000, start_date: new Date(Date.UTC(new Date().getFullYear() - 1, 0, 2) + i * 36e5).toISOString(), start_date_local: '2000-01-02T07:00:00' }));
  let pages = 0;
  globalThis.fetch = async () => { if (++pages > 1) throw new TypeError('the signal drops'); return new Response(JSON.stringify(old)); };
  Object.assign(S, { athleteId: 42, cache: { athlete: { id: 42, units: 'mi' }, acts: {}, lastStart: 0, lastSync: 0 } });
  await sync(false);
  assert.equal(Object.keys(S.cache.acts).length, 200);
  assert.equal(runs.runsLoaded(S.cache), false);
  // The next try is still a first sync: it redraws as it starts.
  events = [];
  const again = sync(false);
  assert.deepEqual(events, [['data', true]]);
  await again;
});

test('the runs are loaded once a whole list has finished, and not before', () => {
  assert.deepEqual([null, runs.emptyCache(), { athlete: { id: 1 }, lastSync: 0 }, { athlete: { id: 1 }, lastSync: 5 }].map((c) => runs.runsLoaded(c)), [false, false, false, true]);
  assert.equal(runs.runsLoaded(runs.demoCache()), true);
});
