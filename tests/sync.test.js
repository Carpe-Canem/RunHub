import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, bus } from '../js/core.js';
import { sync } from '../js/sync.js';

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
  Object.assign(S, { athleteId: 42, cache: { athlete: { id: 42, units: 'mi' }, acts: {}, lastStart: 0 } });
  const done = sync(false);
  assert.deepEqual(events, []);
  await done;
});
