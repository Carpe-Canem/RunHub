/*
 * Run Hub: a static, browser-only Strava dashboard.
 * Everything (credentials, tokens, cached data) lives in this browser's localStorage.
 * The only network destinations are www.strava.com (API + OAuth) and OpenStreetMap tiles.
 */
import { S, K, bus, store, UserError, timeLabel, ago } from './core.js';
import { $ } from './dom.js';
import { creds, token, redirectUri, startAuth, handleCallback, rateKey, revokeEverywhere, ensureToken, applySetup, LINK_DEAD } from './strava.js';
import { decodeSetup, sameAthlete } from './setup-link.js';
import { loadCache, compute, miles, demoCache } from './legends-model.js';
import { sync } from './legends-sync.js';
import { renderLegends, renderMap } from './legends-view.js';
import { renderData, hideSetupLink } from './data-view.js';
import { renderHub } from './hub.js';
import { startRouter, current } from './router.js';

// Views that exist so far. Phase 2 adds 'races' and 'race'.
const ENABLED = ['hub', 'legends', 'data'];
const scrolls = {};

function renderStatus() {
  const text = $('statusText'); const prog = $('progress'); const btn = $('refreshBtn');
  const connected = !S.demo && !!token();
  btn.hidden = !connected || S.syncing;
  text.className = '';
  if (S.demo) { text.textContent = 'Demo'; prog.hidden = true; return; }
  if (!connected) { text.textContent = ''; prog.hidden = true; return; }
  if (S.syncing && S.progress) {
    const p = S.progress;
    text.textContent = p.total ? `${p.label}: ${p.done} of ${p.total}` : `${p.label}…`;
    prog.hidden = false;
    if (p.total) { prog.max = p.total; prog.value = p.done; } else prog.removeAttribute('value');
    return;
  }
  prog.hidden = true;
  if (S.error) { text.textContent = S.error; text.className = 'err'; return; }
  if (S.pausedUntil > Date.now()) {
    text.textContent = `Paused for Strava's rate limit. Resumes at ${timeLabel(S.pausedUntil)} if this page is open.`;
    return;
  }
  const last = S.cache && S.cache.lastSync;
  text.textContent = (last ? `Synced ${ago(last)}` : 'Not synced yet') + (S.warn ? `. ${S.warn}` : '');
}

function render() {
  const connected = S.demo || !!token();
  $('setup').hidden = connected;
  $('dash').hidden = !connected;
  $('nav').hidden = !connected;
  $('dataLink').hidden = !connected;
  const view = current().view;
  for (const v of ENABLED) $(`view-${v}`).hidden = v !== view;
  for (const a of document.querySelectorAll('#nav a')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  $('demoBanner').hidden = !S.demo;
  $('disconnectBtn').textContent = S.demo ? 'Leave the demo' : 'Disconnect everywhere';
  $('forgetBtn').hidden = S.demo;
  $('leaveNote').hidden = S.demo;
  renderStatus();
  if (!connected) return;
  const c = S.cache;
  const scope = (token() || {}).scope || '';
  const sw = $('scopeWarn');
  sw.hidden = S.demo || !scope || /activity:read_all/.test(scope);
  sw.textContent = 'You didn\'t allow access to private activities, so private runs are missing from your mileage. Use “Forget this browser” on the Data page, then connect again to fix this.';
  const ready = !!(c && c.athlete);   // false until the first sync has loaded the athlete
  if (view === 'hub') { renderHub(ready ? compute(c) : null); return; }
  if (!ready) return;

  const model = compute(c);
  if (view === 'legends') {
    renderLegends(model, miles(c));
    if ($('dMap').open) renderMap(model);
  } else if (view === 'data') {
    renderData(model, c);
  }
}

// Called by the router at start and on every hash change.
function onRoute(route, prev) {
  if (prev) scrolls[prev.view] = window.scrollY;
  if (prev && prev.view === 'data') hideSetupLink();   // a setup link is not left on screen
  render();
  if (route.view === 'legends' && S.map) S.map.invalidateSize();
  if (prev) window.scrollTo(0, scrolls[route.view] || 0);
}

function startDemo() {
  S.demo = true; S.cache = demoCache(); S.error = null;
  render();
}

function exitDemo() {
  S.demo = false; S.cache = null;
  if (location.search) history.replaceState(null, '', location.pathname);
  render();
  window.scrollTo(0, 0);
}

// Remove everything this browser holds. Sends nothing to Strava.
function wipe() {
  const t = token();
  const id = (t && t.athleteId) || S.athleteId;
  store.del(rateKey());
  if (id) store.del(`lw.cache.${id}`);
  store.del(K.token); store.del(K.creds); store.del(K.state); store.del(K.probe); store.del(K.units); store.del(K.ui);
  clearTimeout(S.resumeTimer);
  Object.assign(S, { cache: null, athleteId: null, error: null, warn: null, pausedUntil: 0, probe: null, probeError: null });
  if (S.map) { S.map.remove(); S.map = null; }
  hideSetupLink();
}

// "Forget this browser" wipes here only. "Disconnect everywhere" also revokes the grant at Strava,
// which signs out every device and cancels every setup link.
async function leave(everywhere) {
  if (!window.confirm(everywhere
    ? 'Revoke access at Strava and wipe this browser? Every device you connected is signed out and every setup link stops working.'
    : 'Remove your Strava keys and all cached data from this browser? Your other devices stay connected.')) return;
  const result = everywhere && token() ? await revokeEverywhere() : null;
  if (result === 'failed') {
    // Nothing is wiped, so the button can be pressed again. Saying "done" here would leave a stray link working.
    window.alert('Strava did not confirm the disconnect, so your other devices and any setup links may still work. Nothing was removed from this browser. Try again, or remove the app at strava.com/settings/apps. To wipe only this browser, use “Forget this browser”.');
    return;
  }
  if (result === 'gone') window.alert('Access was already revoked at Strava, so your other devices and setup links had already stopped working. This browser is now wiped.');
  wipe();
  render();
  window.scrollTo(0, 0);
}

// Show the connected page for whatever token is now stored, and sync.
function enter() {
  const t = token();
  S.demo = false; S.error = null;
  S.athleteId = t.athleteId;
  S.cache = loadCache(t.athleteId);
  if (location.hash) history.replaceState(null, '', location.pathname);   // a new connection opens on the hub
  render();
  window.scrollTo(0, 0);
  sync(false);
}

const putBack = (was) => { store.set(K.creds, was.creds); store.set(K.token, was.token); };

// Take a setup link (a whole link or just the code). Returns true when this browser is now connected by it.
async function useSetup(text) {
  const fail = (msg) => { if (token()) window.alert(msg); else S.showLinkError(msg); return false; };
  const f = decodeSetup(text);
  if (!f) return fail(LINK_DEAD);
  const was = { creds: creds(), token: token() };
  const other = !!was.token && !sameAthlete(was.token.athleteId, f.athleteId);
  if (other && !window.confirm('This browser is connected as a different Strava athlete. Replace that connection with the one in the setup link?')) return false;
  const keep = !other && !!was.token && !!was.creds;   // same athlete already here: put it back if the link fails
  if (other) wipe();
  if (!applySetup(f)) {
    if (keep) putBack(was);
    return fail("This browser is blocking storage, so it can't remember your keys. Allow site data for this page and try again.");
  }
  try {
    await ensureToken(false);
  } catch (e) {
    if (e.linkDead) {
      if (keep) putBack(was); else wipe();
      return fail(LINK_DEAD);
    }
    // Strava could not be reached: keep what the link gave. The sync says why and tries again.
  }
  return true;
}

function wireSetup() {
  $('siteUrl').textContent = redirectUri();
  $('cbDomain').textContent = location.hostname || '(open this page from a web address)';
  for (const b of document.querySelectorAll('[data-copy]')) {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($(b.dataset.copy).textContent); b.textContent = 'Copied'; }
      catch { b.textContent = 'Select and copy'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1500);
    });
  }
  const c = creds();
  if (c) $('clientId').value = c.clientId;
  const err = $('setupError');
  const showErr = (msg) => { err.textContent = msg; err.hidden = !msg; };
  for (const id of ['clientId', 'clientSecret']) $(id).addEventListener('input', () => showErr(''));
  $('connectForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const clientId = $('clientId').value.trim();
    const clientSecret = $('clientSecret').value.trim();
    if (location.protocol === 'file:') return showErr('Open this page from a web address (https://…), not from a file on your computer.');
    if (!/^\d+$/.test(clientId)) return showErr('Enter your Client ID. It\'s a number, such as 123456.');
    if (!/^[A-Za-z0-9]{20,}$/.test(clientSecret)) return showErr('Enter your Client Secret. Click “show” on Strava\'s API page and copy all of it.');
    if (!store.set(K.creds, { clientId, clientSecret })) return showErr('This browser is blocking storage, so it can\'t remember your keys. Allow site data for this page and try again.');
    startAuth(clientId);
    return undefined;
  });
  $('demoBtn').addEventListener('click', startDemo);
  $('exitDemoBtn').addEventListener('click', exitDemo);
  $('refreshBtn').addEventListener('click', () => sync(true));
  $('disconnectBtn').addEventListener('click', () => (S.demo ? exitDemo() : leave(true)));
  $('forgetBtn').addEventListener('click', () => leave(false));
  const linkErr = $('linkError');
  S.showLinkError = (msg) => { linkErr.textContent = msg; linkErr.hidden = !msg; };
  $('setupLink').addEventListener('input', () => S.showLinkError(''));
  $('linkForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const box = $('setupLink'); const btn = $('linkBtn');
    const text = box.value;
    box.value = ''; btn.disabled = true; S.showLinkError('');
    try { if (await useSetup(text)) enter(); } finally { btn.disabled = false; }
  });
  $('dMap').addEventListener('toggle', () => { if ($('dMap').open && S.cache && S.cache.athlete) renderMap(compute(S.cache)); });
  S.showSetupError = showErr;
}

// A setup link is read and taken out of the address bar at once, valid or not.
async function linkFromAddress() {
  if (!location.hash.startsWith('#setup=')) return false;
  const text = location.hash;
  history.replaceState(null, '', location.pathname);
  return useSetup(text);
}

async function init() {
  wireSetup();
  await linkFromAddress();   // before anything else
  // The same link arriving in a page that is already open (no reload happens for a change after the #).
  // On a failed link, redraw: the router may already have drawn the hub for a token that is now wiped.
  window.addEventListener('hashchange', async () => {
    if (!location.hash.startsWith('#setup=')) return;
    if (await linkFromAddress()) enter(); else render();
  });
  try {
    await handleCallback();
  } catch (e) {
    S.showSetupError(e instanceof UserError ? e.message : 'Connecting to Strava failed. Try again.');
    if (!(e instanceof UserError)) console.error(e);
  }
  const t = token();
  if (t) {
    S.athleteId = t.athleteId;
    S.cache = loadCache(t.athleteId);
  } else if (new URLSearchParams(location.search).has('demo')) {
    S.demo = true; S.cache = demoCache(); S.error = null;
  }
  // After handleCallback, which strips the sign-in code (and any hash) from the address.
  startRouter({ enabled: ENABLED, onRoute });   // draws the first view
  if (t) sync(false);
  setInterval(renderStatus, 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !S.demo && token() && S.cache && Date.now() - (S.cache.lastSync || 0) > 15 * 60e3) sync(false);
  });
}

bus.on('data', render);
bus.on('status', renderStatus);
init();
