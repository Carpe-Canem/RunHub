/*
 * Local Legend Watch: a static, browser-only Strava dashboard.
 * Everything (credentials, tokens, cached data) lives in this browser's localStorage.
 * The only network destinations are www.strava.com (API + OAuth) and OpenStreetMap tiles.
 */
import { S, K, bus, store, UserError, timeLabel, ago } from './core.js';
import { $ } from './dom.js';
import { creds, token, redirectUri, startAuth, handleCallback, rateKey, revoke } from './strava.js';
import { loadCache, compute, miles, demoCache } from './legends-model.js';
import { sync } from './legends-sync.js';
import { renderLegends, renderMap } from './legends-view.js';
import { renderData } from './data-view.js';
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
  $('disconnectBtn').textContent = S.demo ? 'Leave the demo' : 'Disconnect and wipe this browser';
  renderStatus();
  if (!connected) return;
  const c = S.cache;
  const scope = (token() || {}).scope || '';
  const sw = $('scopeWarn');
  sw.hidden = S.demo || !scope || /activity:read_all/.test(scope);
  sw.textContent = 'You didn\'t allow access to private activities, so private runs are missing from your mileage. Disconnect and connect again to fix this.';
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

async function disconnect() {
  if (!window.confirm('Remove your Strava keys and all cached data from this browser? You can connect again any time.')) return;
  const t = token();
  if (t && t.access_token) {
    await revoke(t.access_token);
  }
  const id = (t && t.athleteId) || S.athleteId;
  store.del(rateKey());
  if (id) store.del(`lw.cache.${id}`);
  store.del(K.token); store.del(K.creds); store.del(K.state); store.del(K.probe);
  clearTimeout(S.resumeTimer);
  Object.assign(S, { cache: null, athleteId: null, error: null, warn: null, pausedUntil: 0, probe: null, probeError: null });
  if (S.map) { S.map.remove(); S.map = null; }
  render();
  window.scrollTo(0, 0);
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
  $('disconnectBtn').addEventListener('click', () => (S.demo ? exitDemo() : disconnect()));
  $('dMap').addEventListener('toggle', () => { if ($('dMap').open && S.cache && S.cache.athlete) renderMap(compute(S.cache)); });
  S.showSetupError = showErr;
}

async function init() {
  wireSetup();
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
