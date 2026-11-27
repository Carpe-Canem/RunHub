import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applySetup, ensureToken, revokeEverywhere } from '../js/strava.js';

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

// "Disconnect everywhere" must really reach Strava: it is the only way to cancel a stray setup link.
const strava = (answers) => {
  const seen = [];
  globalThis.fetch = async (url, init) => { const path = new URL(url).pathname; seen.push([path, Object.fromEntries(init.body)]); return answers[path](); };
  return seen;
};
test('revokeEverywhere refreshes a stale token first, then revokes with the fresh one', async () => {
  applySetup(FIELDS);   // no usable access token yet
  const seen = strava({ '/oauth/token': answer(200, { access_token: 'access-new', refresh_token: 'refresh-new', expires_at: 2000000000 }), '/oauth/deauthorize': answer(200, {}) });
  assert.equal(await revokeEverywhere(), 'revoked');
  assert.deepEqual(seen.map((s) => s[0]), ['/oauth/token', '/oauth/deauthorize']);
  assert.deepEqual(seen[1][1], { access_token: 'access-new' });
});
test('revokeEverywhere reports gone when Strava says the fresh token is not authorized', async () => {
  applySetup(FIELDS);
  strava({ '/oauth/token': answer(200, { access_token: 'access-new', refresh_token: 'refresh-new', expires_at: 2000000000 }), '/oauth/deauthorize': answer(401, {}) });
  assert.equal(await revokeEverywhere(), 'gone');
});
test('revokeEverywhere reports gone when Strava refuses the refresh (access already revoked)', async () => {
  applySetup(FIELDS);
  strava({ '/oauth/token': answer(400, {}) });
  assert.equal(await revokeEverywhere(), 'gone');
});
test('revokeEverywhere reports failed when Strava answers the revoke with a server error', async () => {
  applySetup(FIELDS);
  strava({ '/oauth/token': answer(200, { access_token: 'access-new', refresh_token: 'refresh-new', expires_at: 2000000000 }), '/oauth/deauthorize': answer(500, {}) });
  assert.equal(await revokeEverywhere(), 'failed');
});
test('revokeEverywhere reports failed when Strava cannot be reached', async () => {
  applySetup(FIELDS);
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.equal(await revokeEverywhere(), 'failed');
});
test('two concurrent ensureToken calls on an expired token share one refresh', async () => {
  applySetup(FIELDS);
  let n = 0;
  globalThis.fetch = async () => {
    n++;
    await new Promise((r) => setTimeout(r, 5));
    return answer(200, { access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_at: 0 })();
  };
  const [a, b] = await Promise.all([ensureToken(false), ensureToken(false)]);
  assert.equal(n, 1);
  assert.equal(a.access_token, 'access-1');
  assert.deepEqual(a, b);
  // settled, so a later call on a still-expired token refreshes again
  const c = await ensureToken(false);
  assert.equal(n, 2);
  assert.equal(c.access_token, 'access-2');
});
