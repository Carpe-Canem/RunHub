import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applySetup, ensureToken } from '../js/strava.js';

const FIELDS = { clientId: '123456', clientSecret: 'secret-abc', refreshToken: 'refresh-xyz', athleteId: 42, scope: 'read,activity:read_all' };
let mem;
const saved = (k) => JSON.parse(mem[k] || 'null');
beforeEach(() => {
  mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
});
afterEach(() => { delete globalThis.localStorage; delete globalThis.fetch; });
const answer = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

test('applySetup stores the keys and a token that refreshes on first use', () => {
  assert.equal(applySetup(FIELDS), true);
  assert.deepEqual(saved('lw.creds'), { clientId: '123456', clientSecret: 'secret-abc' });
  assert.deepEqual(saved('lw.token'), { access_token: '', refresh_token: 'refresh-xyz', expires_at: 0, athleteId: 42, scope: 'read,activity:read_all', fromLink: true });
});
test('applySetup reports blocked storage and leaves nothing half-saved', () => {
  globalThis.localStorage = { getItem: () => null, setItem(k, v) { if (k === 'lw.token') throw new Error('full'); mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  assert.equal(applySetup(FIELDS), false);
  assert.equal(mem['lw.creds'], undefined);
});
test('a link-seeded token is refreshed with the keys from the link, then is an ordinary token', async () => {
  applySetup(FIELDS);
  let sent;
  globalThis.fetch = async (url, init) => { sent = Object.fromEntries(init.body); return answer(200, { access_token: 'access-new', refresh_token: 'refresh-new', expires_at: 2000000000 })(); };
  const t = await ensureToken(false);
  assert.deepEqual(sent, { client_id: '123456', client_secret: 'secret-abc', grant_type: 'refresh_token', refresh_token: 'refresh-xyz' });
  assert.deepEqual(t, { access_token: 'access-new', refresh_token: 'refresh-new', expires_at: 2000000000, athleteId: 42, scope: 'read,activity:read_all' });
  assert.deepEqual(saved('lw.token'), t);
});
test('Strava refusing a link-seeded token says the link no longer works', async () => {
  applySetup(FIELDS);
  globalThis.fetch = answer(400, { message: 'Bad Request' });
  await assert.rejects(ensureToken(false), (e) => e.linkDead === true && e.message === 'This setup link no longer works. Create a new one on a connected device.');
});
test('Strava refusing an ordinary token does not blame a link', async () => {
  applySetup(FIELDS);
  const t = saved('lw.token'); delete t.fromLink; mem['lw.token'] = JSON.stringify(t);
  globalThis.fetch = answer(401, {});
  await assert.rejects(ensureToken(false), (e) => !e.linkDead && /^Strava access expired or was revoked\./.test(e.message));
});
test('being offline is not reported as a dead link or a revoked connection', async () => {
  applySetup(FIELDS);
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(ensureToken(false), (e) => !e.linkDead && /^Couldn't reach Strava\./.test(e.message));
  assert.equal(saved('lw.token').fromLink, true);   // still link-seeded, to be tried again
});
