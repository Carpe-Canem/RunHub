// Strava sign-in, token refresh, local rate limiting and the API call.
import { API, TOKEN_URL, AUTH_URL, DEAUTH_URL, K, LIMIT_15, LIMIT_DAY, DAY, Q, store, UserError, RateLimited } from './core.js';

export const creds = () => store.get(K.creds);

export const token = () => store.get(K.token);

export const redirectUri = () => location.origin + location.pathname;

function randomHex(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function startAuth(clientId) {
  const state = randomHex(16);
  store.set(K.state, state);
  const p = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri(), response_type: 'code',
    approval_prompt: 'auto', scope: 'read,activity:read_all', state,
  });
  location.assign(`${AUTH_URL}?${p}`);
}

async function tokenRequest(params) {
  let r;
  try { r = await fetch(TOKEN_URL, { method: 'POST', body: new URLSearchParams(params) }); }
  catch { throw new UserError("Couldn't reach Strava. Check your connection and try again."); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) {
      const e = new UserError('Strava rejected these credentials. Check the Client ID and Client Secret, then connect again.');
      e.refused = true;   // Strava answered and said no, as opposed to not being reachable
      throw e;
    }
    throw new UserError(`Strava returned an error (${r.status}). Try again in a few minutes.`);
  }
  return body;
}

// Returns true if this page load was a return from Strava's approval screen.
export async function handleCallback() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  history.replaceState(null, '', location.pathname);   // never leave the code in the address bar
  const expected = store.get(K.state);
  store.del(K.state);
  if (q.get('error')) throw new UserError('Strava access wasn\'t granted. Connect again and click Authorize.');
  if (!expected || q.get('state') !== expected) throw new UserError("That sign-in didn't start in this browser. Connect again.");
  const scope = q.get('scope') || '';
  if (!/activity:read/.test(scope)) {
    throw new UserError('The page needs permission to read your activities. Connect again and leave the activity boxes ticked.');
  }
  const c = creds();
  if (!c) throw new UserError('Your Client ID and Secret were cleared. Enter them again.');
  const t = await tokenRequest({ client_id: c.clientId, client_secret: c.clientSecret, code: q.get('code'), grant_type: 'authorization_code' });
  if (!t.athlete || !t.athlete.id) throw new UserError('Strava didn\'t return your athlete ID. Try connecting again.');
  store.set(K.token, {
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at,
    athleteId: t.athlete.id, scope,
  });
  return true;
}

export async function ensureToken(force) {
  const t = token(); const c = creds();
  if (!t || !c) throw new UserError('Not connected.');
  if (!force && t.expires_at * 1000 - Date.now() > 3600e3) return t;
  let nt;
  try {
    nt = await tokenRequest({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'refresh_token', refresh_token: t.refresh_token });
  } catch (e) {
    if (!e.refused) throw e;   // offline or a Strava fault: say that, the connection may be fine
    if (!t.fromLink) {
      const gone = new UserError('Strava access expired or was revoked. Use “Forget this browser” on the Data page, then connect again.');
      gone.refused = true;
      throw gone;
    }
    const dead = new UserError(LINK_DEAD); dead.linkDead = true;
    throw dead;
  }
  const { fromLink, ...rest } = t;   // a token that has refreshed once is an ordinary one
  const merged = { ...rest, access_token: nt.access_token, refresh_token: nt.refresh_token || t.refresh_token, expires_at: nt.expires_at };
  store.set(K.token, merged);  // refresh tokens rotate: always keep the newest
  return merged;
}

export const LINK_DEAD = 'This setup link no longer works. Create a new one on a connected device.';

// Store what a setup link carried. The expiry of zero makes the first request refresh the token.
export function applySetup(f) {
  const ok = store.set(K.creds, { clientId: f.clientId, clientSecret: f.clientSecret })
    && store.set(K.token, { access_token: '', refresh_token: f.refreshToken, expires_at: 0, athleteId: f.athleteId, scope: f.scope, fromLink: true });
  if (!ok) { store.del(K.creds); store.del(K.token); }
  return ok;
}

export const rateKey = () => `lw.rate.${(creds() || {}).clientId || 'none'}`;

export function rateState() {
  const t = Date.now(); const r = store.get(rateKey()) || {};
  const w = Math.floor(t / Q); const d = Math.floor(t / DAY);
  if (r.w !== w) { r.w = w; r.wn = 0; }
  if (r.d !== d) { r.d = d; r.dn = 0; }
  r.until = r.until || 0;
  return r;
}

const nextWindow = (r) => (r.dn >= LIMIT_DAY ? (r.d + 1) * DAY : (r.w + 1) * Q);

export async function api(path, retried) {
  const r = rateState();
  if (Date.now() < r.until) throw new RateLimited(r.until);
  if (r.wn >= LIMIT_15 || r.dn >= LIMIT_DAY) throw new RateLimited(nextWindow(r));
  const t = await ensureToken(!!retried);
  r.wn++; r.dn++; store.set(rateKey(), r);
  let res;
  try { res = await fetch(API + path, { headers: { Authorization: `Bearer ${t.access_token}` } }); }
  catch { throw new UserError("Couldn't reach Strava. Check your connection and try again."); }
  if (res.status === 429) {
    r.until = (Math.floor(Date.now() / Q) + 1) * Q; store.set(rateKey(), r);
    throw new RateLimited(r.until);
  }
  if (res.status === 401 && !retried) return api(path, true);
  if (res.status === 401) throw new UserError('Strava refused access. Use “Forget this browser” on the Data page, then connect again.');
  if (res.status === 404) return null;
  if (!res.ok) throw new UserError(`Strava returned an error (${res.status}). Try again later.`);
  return res.json();
}

// Revoke this app's access at Strava: 'revoked', 'gone' (Strava says the token is not authorized) or 'failed'.
export async function revoke(accessToken) {
  try {
    const r = await fetch(DEAUTH_URL, { method: 'POST', body: new URLSearchParams({ access_token: accessToken }) });
    return r.ok ? 'revoked' : r.status === 401 ? 'gone' : 'failed';
  } catch { return 'failed'; }
}

// "Disconnect everywhere": Strava only accepts a current access token, so refresh a stale one first.
// A refused refresh means the grant is already gone (revoked elsewhere), which is not a failure to report as one.
export async function revokeEverywhere() {
  let t;
  try { t = await ensureToken(false); } catch (e) { return e.refused || e.linkDead ? 'gone' : 'failed'; }
  return revoke(t.access_token);
}
