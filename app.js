import { probeFields } from './js/probe.js';

/*
 * Local Legend Watch: a static, browser-only Strava dashboard.
 * Everything (credentials, tokens, cached data) lives in this browser's localStorage.
 * The only network destinations are www.strava.com (API + OAuth) and OpenStreetMap tiles.
 */
(() => {
  const API = 'https://www.strava.com/api/v3';
  const TOKEN_URL = 'https://www.strava.com/oauth/token';
  const AUTH_URL = 'https://www.strava.com/oauth/authorize';
  const DEAUTH_URL = 'https://www.strava.com/oauth/deauthorize';
  const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];
  const WINDOW = 90;            // Local Legend window, days
  const REACH_GAP = 3;          // "within reach" = this many efforts behind or fewer
  const LIMIT_15 = 90;          // stay under Strava's 100 reads / 15 min
  const LIMIT_DAY = 900;        // stay under Strava's 1,000 reads / day
  const HOT_MAX_AGE = 6 * 3600e3;
  const COLD_MAX_AGE = 24 * 3600e3;
  const MANUAL_MAX_AGE = 15 * 60e3;
  const DAY = 864e5;
  const Q = 15 * 60e3;
  const K = { creds: 'lw.creds', token: 'lw.token', state: 'lw.oauthState', probe: 'lw.probe' };

  const $ = (id) => document.getElementById(id);

  // ---------- storage (every access guarded: storage can be blocked or full) ----------
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  class UserError extends Error {}
  class RateLimited extends Error { constructor(until) { super('rate limited'); this.until = until; } }

  const S = {
    demo: false, cache: null, athleteId: null, syncing: false, progress: null,
    error: null, warn: null, pausedUntil: 0, resumeTimer: null, map: null, layers: {},
    probe: null, probeBusy: false, probeError: null,
  };

  // ---------- dates: Strava's start_date_local ends in "Z" but is local wall time ----------
  function dayOf(localIso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(localIso || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : NaN;
  }
  function todayIdx() { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY; }
  function weekStart(i) { return i - ((new Date(i * DAY).getUTCDay() + 6) % 7); }
  function dayLabel(i) { return new Date(i * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
  function timeLabel(t) { return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60e3);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    return new Date(t).toLocaleDateString();
  }
  const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const fmt0 = (x) => Math.round(x).toLocaleString();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // ---------- tiny DOM helper (text only, never innerHTML with data) ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // ---------- OAuth ----------
  const creds = () => store.get(K.creds);
  const token = () => store.get(K.token);
  const redirectUri = () => location.origin + location.pathname;

  function randomHex(n) {
    const a = new Uint8Array(n); crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function startAuth(clientId) {
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
        throw new UserError('Strava rejected these credentials. Check the Client ID and Client Secret, then connect again.');
      }
      throw new UserError(`Strava returned an error (${r.status}). Try again in a few minutes.`);
    }
    return body;
  }

  // Returns true if this page load was a return from Strava's approval screen.
  async function handleCallback() {
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

  async function ensureToken(force) {
    const t = token(); const c = creds();
    if (!t || !c) throw new UserError('Not connected.');
    if (!force && t.expires_at * 1000 - Date.now() > 3600e3) return t;
    let nt;
    try {
      nt = await tokenRequest({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'refresh_token', refresh_token: t.refresh_token });
    } catch (e) {
      throw new UserError('Strava access expired or was revoked. Disconnect, then connect again.');
    }
    const merged = { ...t, access_token: nt.access_token, refresh_token: nt.refresh_token || t.refresh_token, expires_at: nt.expires_at };
    store.set(K.token, merged);  // refresh tokens rotate: always keep the newest
    return merged;
  }

  // ---------- rate limiting (Strava's headers aren't readable cross-origin, so count locally) ----------
  const rateKey = () => `lw.rate.${(creds() || {}).clientId || 'none'}`;
  function rateState() {
    const t = Date.now(); const r = store.get(rateKey()) || {};
    const w = Math.floor(t / Q); const d = Math.floor(t / DAY);
    if (r.w !== w) { r.w = w; r.wn = 0; }
    if (r.d !== d) { r.d = d; r.dn = 0; }
    r.until = r.until || 0;
    return r;
  }
  const nextWindow = (r) => (r.dn >= LIMIT_DAY ? (r.d + 1) * DAY : (r.w + 1) * Q);

  async function api(path, retried) {
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
    if (res.status === 401) throw new UserError('Strava refused access. Disconnect, then connect again.');
    if (res.status === 404) return null;
    if (!res.ok) throw new UserError(`Strava returned an error (${res.status}). Try again later.`);
    return res.json();
  }

  // ---------- cache ----------
  function emptyCache() { return { v: 1, athlete: null, acts: {}, det: {}, eff: {}, seg: {}, lastStart: 0, lastSync: 0, lastFull: 0 }; }
  function loadCache(id) { const c = store.get(`lw.cache.${id}`); return c && c.v === 1 ? c : emptyCache(); }
  function saveCache() {
    if (S.demo || !S.athleteId) return;
    if (!store.set(`lw.cache.${S.athleteId}`, S.cache)) S.warn = 'This browser\'s storage is full, so some data will be fetched again next time.';
  }

  // ---------- sync ----------
  async function sync(manual) {
    if (S.demo || S.syncing || !token()) return;
    clearTimeout(S.resumeTimer);
    S.syncing = true; S.error = null;
    S.progress = { label: 'Checking for new runs', done: 0, total: 0 };
    renderStatus();
    const c = S.cache;
    try {
      if (!c.athlete) {
        const a = await api('/athlete');
        c.athlete = { id: a.id, units: a.measurement_preference === 'meters' ? 'km' : 'mi' };
        saveCache();
      }
      await syncActivities(c, manual);
      render();
      await syncDetails(c);
      render();
      await syncLeaders(c, manual);
      c.lastSync = Date.now();
      S.pausedUntil = 0;
      saveCache();
    } catch (e) {
      if (e instanceof RateLimited) {
        S.pausedUntil = e.until;
        clearTimeout(S.resumeTimer);
        S.resumeTimer = setTimeout(() => sync(false), Math.max(5e3, e.until - Date.now() + 5e3));
      } else {
        S.error = e instanceof UserError ? e.message : 'Something went wrong while syncing. Try Refresh now.';
        console.error(e);
      }
      saveCache();
    } finally {
      S.syncing = false; S.progress = null;
      render();
    }
  }

  async function syncActivities(c, manual) {
    const nowSec = Math.floor(Date.now() / 1000);
    const floor = Date.UTC(new Date().getFullYear() - 1, 0, 1) / 1000 - 2 * 86400;
    let after = c.lastStart ? c.lastStart - 2 * 86400 : floor;
    // Once a day (or on Refresh now) re-list 95 days to pick up edits, visibility changes and deletions.
    if (manual || !c.lastFull || Date.now() - c.lastFull > DAY) after = Math.min(after, nowSec - 95 * 86400);
    after = Math.max(after, floor);
    S.progress = { label: 'Loading your runs', done: 0, total: 0 };
    renderStatus();
    const seen = new Set();
    for (let page = 1; ; page++) {
      const list = (await api(`/athlete/activities?after=${after}&per_page=200&page=${page}`)) || [];
      for (const a of list) {
        if (!RUN_TYPES.includes(a.sport_type || a.type)) continue;
        const s = Math.floor(Date.parse(a.start_date) / 1000);
        seen.add(String(a.id));
        c.acts[a.id] = { s, d: a.start_date_local, m: a.distance || 0, v: a.visibility || (a.private ? 'only_me' : 'everyone') };
        if (s > c.lastStart) c.lastStart = s;
      }
      if (list.length < 200) break;
    }
    for (const [id, a] of Object.entries(c.acts)) {
      if ((a.s > after && !seen.has(id)) || a.s < floor) { delete c.acts[id]; delete c.det[id]; }
    }
    if (after <= nowSec - 94 * 86400) c.lastFull = Date.now();
    saveCache();
  }

  async function syncDetails(c) {
    const t0 = todayIdx(); const from = t0 - (WINDOW - 1);
    const todo = Object.entries(c.acts)
      .filter(([id, a]) => !c.det[id] && dayOf(a.d) >= from)
      .sort((x, y) => y[1].s - x[1].s);
    S.progress = { label: 'Reading segments from your runs', done: 0, total: todo.length };
    renderStatus();
    for (const [id] of todo) {
      const a = await api(`/activities/${id}?include_all_efforts=true`);
      if (a) {
        for (const e of a.segment_efforts || []) {
          const sg = e.segment;
          if (!sg || sg.activity_type !== 'Run' || sg.private || sg.hazardous) continue;
          const list = c.eff[sg.id] || (c.eff[sg.id] = []);
          if (!list.some((x) => x[0] === e.start_date_local && x[1] === id)) list.push([e.start_date_local, id]);
          if (!c.seg[sg.id]) c.seg[sg.id] = { n: sg.name, m: sg.distance };
        }
      }
      c.det[id] = 1;
      S.progress.done++;
      renderStatus();
      if (S.progress.done % 5 === 0) saveCache();
    }
    for (const [sid, list] of Object.entries(c.eff)) {
      const kept = list.filter((x) => dayOf(x[0]) >= from - 1);
      if (kept.length) c.eff[sid] = kept; else { delete c.eff[sid]; delete c.seg[sid]; }
    }
    for (const id of Object.keys(c.det)) if (!c.acts[id] || dayOf(c.acts[id].d) < from - 1) delete c.det[id];
    saveCache();
  }

  function legendCount(L) {
    const cands = [L.effort_counts && L.effort_counts.overall, L.effort_count, L.effort_description];
    for (const v of cands) {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') { const m = v.replace(/,/g, '').match(/\d+/); if (m) return +m[0]; }
    }
    return null;
  }

  async function syncLeaders(c, manual) {
    const rows = compute(c).rows;
    const now = Date.now();
    const hot = new Set(rows.filter((r) => r.status === 'reach' || r.risk).map((r) => r.id));
    const todo = rows.filter((r) => {
      const s = c.seg[r.id];
      if (!s.at) return true;
      const age = now - s.at;
      if (hot.has(r.id)) return age > (manual ? MANUAL_MAX_AGE : HOT_MAX_AGE);
      return age > COLD_MAX_AGE;
    }).sort((a, b) => (!!c.seg[a.id].at - !!c.seg[b.id].at) || (hot.has(b.id) - hot.has(a.id)) || (b.mine - a.mine));
    S.progress = { label: 'Checking Local Legend counts', done: 0, total: todo.length };
    renderStatus();
    for (const r of todo) {
      const s = await api(`/segments/${r.id}`);
      const seg = c.seg[r.id];
      if (s) {
        const L = s.local_legend;
        // Keep only the leader's athlete id (to tell whether it's you) and the effort count.
        // The leader's name and photo are never stored or shown.
        seg.ll = L ? { id: L.athlete_id, n: legendCount(L) } : null;
        if (s.map && s.map.polyline) seg.p = s.map.polyline;
        if (s.name) seg.n = s.name;
        if (s.distance) seg.m = s.distance;
      } else {
        seg.ll = null;
      }
      seg.at = Date.now();
      S.progress.done++;
      if (S.progress.done % 5 === 0) { saveCache(); render(); } else renderStatus();
    }
  }

  // ---------- model ----------
  function compute(c) {
    const t0 = todayIdx(); const from = t0 - (WINDOW - 1);
    const me = String(c.athlete ? c.athlete.id : '');
    const rows = [];
    for (const [id, list] of Object.entries(c.eff)) {
      let all = 0; let mine = 0; let e7 = 0; let e14 = 0; let next = null;
      for (const [d, a] of list) {
        const act = c.acts[a]; if (!act) continue;
        const di = dayOf(d); if (!(di >= from) || di > t0) continue;
        all++;
        if (act.v !== 'everyone') continue;   // only public activities count toward Local Legends
        mine++;
        const drop = di + WINDOW;             // first day this effort no longer counts
        if (drop <= t0 + 7) e7++;
        if (drop <= t0 + 14) e14++;
        if (next === null || drop < next) next = drop;
      }
      if (!all) continue;
      const seg = c.seg[id] || {}; const ll = seg.ll;
      let status; let gap = null; let need = null;
      if (!seg.at) status = 'pending';
      else if (!ll) status = 'unknown';
      else if (String(ll.id) === me) status = 'held';
      else if (ll.n == null) status = 'unknown';
      else { gap = ll.n - mine; need = Math.max(1, gap + 1); status = gap <= REACH_GAP ? 'reach' : 'behind'; }
      rows.push({
        id, name: seg.n || `Segment ${id}`, m: seg.m, mine, all, e7, e14, next, status, gap, need,
        risk: status === 'held' && e7 > 0,
        stravaCount: status === 'held' ? ll.n : null,
      });
    }
    const held = rows.filter((r) => r.status === 'held');
    return {
      rows, held,
      risk: held.filter((r) => r.risk).sort((a, b) => b.e7 - a.e7 || b.e14 - a.e14),
      reach: rows.filter((r) => r.status === 'reach').sort((a, b) => a.need - b.need),
      chase: rows.filter((r) => r.status === 'reach' || r.status === 'behind').sort((a, b) => a.gap - b.gap),
      pending: rows.filter((r) => r.status === 'pending').length,
      unknown: rows.filter((r) => r.status === 'unknown').length,
    };
  }

  function miles(c) {
    const t0 = todayIdx(); const unit = c.athlete ? c.athlete.units : 'mi';
    const f = unit === 'km' ? 1 / 1000 : 1 / 1609.344;
    const td = new Date(t0 * DAY); const Y = td.getUTCFullYear(); const M = td.getUTCMonth(); const D = td.getUTCDate();
    const ws = weekStart(t0);
    const lySame = Date.UTC(Y - 1, M, D) / DAY; const ly0 = Date.UTC(Y - 1, 0, 1) / DAY;
    const y0 = Date.UTC(Y, 0, 1) / DAY; const m0 = Date.UTC(Y, M, 1) / DAY;
    const weeks = new Array(13).fill(0); const months = new Map();
    let today = 0; let runsToday = 0; let week = 0; let runsWeek = 0; let month = 0; let ytd = 0; let lytd = 0; let hasLastYear = false;
    for (const a of Object.values(c.acts)) {
      const di = dayOf(a.d); if (!(di <= t0)) continue;
      const x = a.m * f;
      if (di === t0) { today += x; runsToday++; }
      if (di >= ws) { week += x; runsWeek++; }
      if (di >= m0) month += x;
      if (di >= y0) ytd += x;
      if (di < y0) hasLastYear = true;
      if (di >= ly0 && di <= lySame) lytd += x;
      const w = Math.floor((di - (ws - 12 * 7)) / 7); if (w >= 0 && w < 13) weeks[w] += x;
      const dd = new Date(di * DAY); const mk = dd.getUTCFullYear() * 12 + dd.getUTCMonth();
      months.set(mk, (months.get(mk) || 0) + x);
    }
    const weekAvg = weeks.slice(0, 12).reduce((s, v) => s + v, 0) / 12;
    let msum = 0; for (let k = 1; k <= 6; k++) msum += months.get(Y * 12 + M - k) || 0;
    return { unit, today, runsToday, week, runsWeek, weekAvg, month, monthAvg: msum / 6, ytd, lytd, hasLastYear, weeks, ws, Y };
  }

  // ---------- rendering ----------
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

  function setCard(prefix, num, sub) { $(`${prefix}N`).textContent = num; $(`${prefix}S`).textContent = sub; }

  function render() {
    const connected = S.demo || !!token();
    $('setup').hidden = connected;
    $('dash').hidden = !connected;
    $('demoBanner').hidden = !S.demo;
    $('disconnectBtn').textContent = S.demo ? 'Leave the demo' : 'Disconnect and wipe this browser';
    renderStatus();
    if (!connected) return;
    const c = S.cache;
    const scope = (token() || {}).scope || '';
    const sw = $('scopeWarn');
    sw.hidden = S.demo || !scope || /activity:read_all/.test(scope);
    sw.textContent = 'You didn\'t allow access to private activities, so private runs are missing from your mileage. Disconnect and connect again to fix this.';
    if (!c || !c.athlete) return;

    const model = compute(c); const mi = miles(c);
    renderHeadlines(model, mi);
    renderDefend(model);
    renderAttack(model);
    renderMiles(mi);
    renderDataStatus(model, c);
    if ($('dMap').open) renderMap(model);
  }

  function renderHeadlines(model, mi) {
    const known = model.rows.length - model.pending;
    const loading = model.rows.length > 0 && known === 0;
    const stillLoading = model.pending ? ` · ${plural(model.pending, 'segment')} still loading` : '';
    const riskCard = $('riskCard');
    riskCard.classList.toggle('danger', model.risk.length > 0);
    riskCard.classList.toggle('ok', !loading && model.risk.length === 0);

    if (loading) {
      setCard('risk', '…', `Loading Local Legend counts for ${plural(model.rows.length, 'segment')}`);
      setCard('reach', '…', 'Loading');
      setCard('held', '…', 'Loading');
    } else if (!model.rows.length) {
      setCard('risk', '0', 'No public runs on segments in the last 90 days yet');
      setCard('reach', '0', 'Nothing to chase yet');
      setCard('held', '0', 'No titles yet');
    } else {
      const r = model.risk;
      let riskSub;
      if (!model.held.length) riskSub = "You don't hold any titles yet";
      else if (!r.length) riskSub = 'None of your titles lose efforts in the next 7 days';
      else {
        const parts = r.slice(0, 2).map((x, i) => `${x.name} loses ${i === 0 ? plural(x.e7, 'effort') : x.e7}`);
        riskSub = `${parts.join(' and ')} this week${r.length > 2 ? `, plus ${r.length - 2} more` : ''}`;
      }
      setCard('risk', String(r.length), riskSub + stillLoading);
      const best = model.reach[0];
      setCard('reach', String(model.reach.length),
        best ? `Closest: ${best.name}, ${plural(best.need, 'more run')} to win` : `No titles within ${REACH_GAP} efforts right now`);
      setCard('held', String(model.held.length), `Out of ${plural(model.rows.length, 'segment')} you ran in the last 90 days`);
    }
    setCard('week', `${fmt1(mi.week)} ${mi.unit}`, `12-week average ${fmt1(mi.weekAvg)} ${mi.unit}`);
    const diff = mi.ytd - mi.lytd;
    setCard('ytd', `${fmt0(mi.ytd)} ${mi.unit}`,
      mi.hasLastYear ? `${diff >= 0 ? '+' : '−'}${fmt0(Math.abs(diff))} vs this date in ${mi.Y - 1}` : 'No runs last year to compare with');
  }

  function segCell(r) {
    const name = h('button', { type: 'button', class: 'linkish', title: 'Show on map', onclick: () => focusSegment(r.id) }, r.name);
    const link = S.demo ? null : h('a', { href: `https://www.strava.com/segments/${encodeURIComponent(r.id)}`, target: '_blank', rel: 'noopener noreferrer', class: 'ext', 'aria-label': `Open ${r.name} on Strava` }, '↗');
    return h('td', { class: 'seg' }, name, ' ', link);
  }

  function table(head, rows) {
    return h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, head.map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', null, rows)));
  }

  function renderDefend(model) {
    const box = $('defend'); box.replaceChildren();
    if (!model.held.length) { box.append(h('p', { class: 'empty' }, "You don't hold any Local Legend titles on segments you ran in the last 90 days.")); return; }
    const rows = [...model.held].sort((a, b) => b.e7 - a.e7 || b.e14 - a.e14 || a.name.localeCompare(b.name)).map((r) => h('tr', { class: r.risk ? 'risk' : null },
      segCell(r),
      h('td', { class: 'n' }, String(r.mine), r.stravaCount != null && r.stravaCount !== r.mine ? h('span', { class: 'note', title: 'Strava\'s own count for you' }, ` (Strava: ${r.stravaCount})`) : null),
      h('td', { class: 'n' }, r.e7 ? `−${r.e7}` : '0'),
      h('td', { class: 'n' }, r.e14 ? `−${r.e14}` : '0'),
      h('td', null, r.next != null ? dayLabel(r.next) : '–')));
    box.append(
      h('p', { class: 'hint' }, 'Your public efforts in the last 90 days, and how many drop out of the window soon. Strava doesn\'t share the runner-up\'s count, so “at risk” means you\'re about to lose efforts.'),
      table(['Segment', 'Efforts', 'Next 7d', 'Next 14d', 'Next drop'], rows));
  }

  function renderAttack(model) {
    const box = $('attack'); box.replaceChildren();
    if (!model.chase.length) { box.append(h('p', { class: 'empty' }, 'No segments to chase yet. Leader counts may still be loading.')); return; }
    const rows = model.chase.map((r) => h('tr', { class: r.status === 'reach' ? 'reach' : null },
      segCell(r),
      h('td', { class: 'n' }, String(r.mine)),
      h('td', { class: 'n' }, r.gap > 0 ? `${r.gap} behind` : r.gap === 0 ? 'tied' : 'ahead*'),
      h('td', { class: 'n' }, String(r.need))));
    box.append(
      h('p', { class: 'hint' }, `Segments you ran in the last 90 days where someone else holds the title, closest first. Highlighted rows are within ${REACH_GAP} efforts. Only the gap is shown, never the leader.`),
      table(['Segment', 'Efforts', 'Gap', 'To win'], rows));
    if (model.chase.some((r) => r.gap < 0)) box.append(h('p', { class: 'note' }, '* Strava\'s leader count hasn\'t caught up with your latest runs yet.'));
  }

  function renderMiles(mi) {
    const box = $('miles'); box.replaceChildren();
    const u = mi.unit;
    const line = (label, value, cmp) => h('div', { class: 'mline' }, h('span', null, label), h('strong', null, value), h('span', { class: 'cmp' }, cmp));
    const max = Math.max(...mi.weeks, mi.weekAvg, 1);
    const bars = mi.weeks.map((v, i) => h('div', { class: `bar${i === 12 ? ' cur' : ''}`, style: `height:${Math.max(2, (v / max) * 100)}%`, title: `Week of ${dayLabel(mi.ws - (12 - i) * 7)}: ${fmt1(v)} ${u}` }));
    box.append(
      line('Today', `${fmt1(mi.today)} ${u}`, plural(mi.runsToday, 'run')),
      line('This week', `${fmt1(mi.week)} ${u}`, `12-week average ${fmt1(mi.weekAvg)}`),
      line('This month', `${fmt1(mi.month)} ${u}`, `6-month average ${fmt1(mi.monthAvg)}`),
      line('Year to date', `${fmt0(mi.ytd)} ${u}`, mi.hasLastYear ? `Same date last year ${fmt0(mi.lytd)}` : '–'),
      h('p', { class: 'chart-title' }, `Last 13 weeks (${u}), current week highlighted`),
      h('div', { class: 'bars', role: 'img', 'aria-label': `Weekly distance for the last 13 weeks. This week ${fmt1(mi.week)} ${u}, 12-week average ${fmt1(mi.weekAvg)} ${u}.` },
        h('div', { class: 'avg', style: `bottom:${(mi.weekAvg / max) * 100}%`, title: `12-week average ${fmt1(mi.weekAvg)} ${u}` }),
        bars),
      h('div', { class: 'bar-axis' }, h('span', null, dayLabel(mi.ws - 12 * 7)), h('span', null, 'This week')));
  }

  function renderDataStatus(model, c) {
    const box = $('dataStatus'); box.replaceChildren();
    const r = rateState();
    const fetched = model.rows.length - model.pending;
    const withLL = model.rows.filter((x) => x.status !== 'pending' && x.status !== 'unknown').length;
    const checked = model.held.filter((x) => x.stravaCount != null);
    const matches = checked.filter((x) => x.stravaCount === x.mine).length;
    const runs90 = Object.values(c.acts).filter((a) => dayOf(a.d) >= todayIdx() - (WINDOW - 1)).length;
    const vis = { everyone: 0, followers_only: 0, only_me: 0 };
    for (const a of Object.values(c.acts)) vis[a.v] = (vis[a.v] || 0) + 1;
    const items = [
      ['Last synced', c.lastSync ? ago(c.lastSync) : 'Not yet'],
      ['Runs cached', `${Object.keys(c.acts).length} since Jan 1 last year · ${runs90} in the last 90 days`],
      ['Runs by visibility', `${vis.everyone} everyone · ${vis.followers_only} followers · ${vis.only_me} only you (only “everyone” counts toward Local Legends)`],
      ['Segments tracked', `${model.rows.length} (leader count checked on ${fetched})`],
      ['Local Legend field returned', fetched ? `${withLL} of ${fetched} segments${withLL === 0 && fetched > 3 ? '. Strava may have removed this field' : ''}` : '–'],
      ['Your count vs Strava\'s, on titles you hold', checked.length ? `${matches} of ${checked.length} match` : '–'],
    ];
    if (!S.demo) items.push(['Strava API calls used', `${r.wn} of ${LIMIT_15} this 15 minutes · ${r.dn} of ${LIMIT_DAY} today`]);
    box.append(h('dl', { class: 'kv' }, items.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
    if (!S.demo && token()) box.append(...probePanel());
  }

  // ---------- field check: which Strava fields this connection receives (counts only, never values) ----------
  const standalone = () => navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const probeContext = () => [
    `Strava permissions granted: ${(token() || {}).scope || 'unknown'}`,
    `Home-screen app: ${standalone() ? 'yes' : 'no'}`,
  ];
  function probeResult(r) {
    if (!r.of) return 'not checked';
    if (!r.returned) return 'not returned';
    if (!r.filled) return 'returned but empty';
    return `filled on ${r.filled} of ${r.of}`;
  }
  const probeText = (p) => [
    ...p.rows.map((r) => `${r.source}.${r.field}: returned ${r.returned}, filled ${r.filled} of ${r.of}`),
    ...probeContext(),
  ].join('\n');

  async function runProbe() {
    if (S.probeBusy) return;
    S.probeBusy = true; S.probeError = null;
    render();
    try {
      const athlete = await api('/athlete');
      const list = (await api('/athlete/activities?per_page=30&page=1')) || [];
      const runs = list.filter((a) => RUN_TYPES.includes(a.sport_type || a.type));
      const pick = runs.find((a) => a.workout_type === 1) || runs[0];
      const detail = pick ? await api(`/activities/${pick.id}`) : null;
      S.probe = { at: Date.now(), rows: probeFields(athlete, runs, detail) };
      store.set(K.probe, S.probe);   // shown below whether or not this browser lets it be saved
    } catch (e) {
      if (e instanceof RateLimited) S.probeError = `Paused for Strava's rate limit. Try again at ${timeLabel(e.until)}.`;
      else if (e instanceof UserError) S.probeError = e.message;
      else { S.probeError = 'The field check failed. Try again.'; console.error(e); }
    } finally {
      S.probeBusy = false;
      render();
    }
  }

  function probePanel() {
    const p = S.probe || store.get(K.probe);
    const copy = async (ev) => {
      const b = ev.currentTarget;
      try { await navigator.clipboard.writeText(probeText(p)); b.textContent = 'Copied'; }
      catch { b.textContent = 'Select the text below and copy'; }
    };
    return [
      h('p', { class: 'chart-title' }, 'Field check: which Strava fields your connection receives. It records counts only, never the values.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn small', disabled: S.probeBusy, onclick: runProbe }, S.probeBusy ? 'Checking…' : 'Run field check (3 Strava requests)'),
        p ? h('button', { type: 'button', class: 'btn small', onclick: copy }, 'Copy results') : null),
      S.probeError ? h('p', { class: 'error', role: 'alert' }, S.probeError) : null,
      ...probeContext().map((t) => h('p', { class: 'note' }, t)),
      p ? h('p', { class: 'note' }, `Checked ${ago(p.at)}`) : null,
      p ? h('div', { class: 'probe' }, table(['Field', 'From', 'Result'], p.rows.map((r) => h('tr', null,
        h('td', null, r.field), h('td', { class: 'n' }, r.source), h('td', { class: 'n' }, probeResult(r)))))) : null,
      p ? h('textarea', { class: 'probe-text', readonly: true, 'aria-label': 'Field check results as text' }, probeText(p)) : null,
    ].filter(Boolean);
  }

  // ---------- map ----------
  function decodePolyline(str) {
    let i = 0; let lat = 0; let lng = 0; const out = [];
    while (i < str.length) {
      for (let k = 0; k < 2; k++) {
        let b; let shift = 0; let result = 0;
        do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const d = result & 1 ? ~(result >> 1) : result >> 1;
        if (k === 0) lat += d; else lng += d;
      }
      out.push([lat / 1e5, lng / 1e5]);
    }
    return out;
  }

  const STYLE = { risk: { color: '#d03b3b', weight: 6 }, reach: { color: '#d98a00', weight: 5 }, held: { color: '#3f8f2f', weight: 5 }, other: { color: '#8a8984', weight: 3 } };
  const kind = (r) => (r.risk ? 'risk' : r.status === 'reach' ? 'reach' : r.status === 'held' ? 'held' : 'other');
  const STATUS_TEXT = (r) => (r.risk ? `Held, loses ${plural(r.e7, 'effort')} this week`
    : r.status === 'held' ? `Held with ${plural(r.mine, 'effort')}`
      : r.status === 'reach' || r.status === 'behind' ? `${r.gap > 0 ? `${r.gap} behind` : 'Level'} · ${plural(r.need, 'run')} to win`
        : 'Leader count not available');

  function renderMap(model) {
    if (!window.L) { $('map').textContent = 'The map library didn\'t load. Check your connection and reload.'; return; }
    if (!S.map) {
      S.map = L.map('map', { scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(S.map);
      S.group = L.featureGroup().addTo(S.map);
    }
    S.group.clearLayers(); S.layers = {};
    const c = S.cache; const order = { other: 0, held: 1, reach: 2, risk: 3 };
    const rows = [...model.rows].sort((a, b) => order[kind(a)] - order[kind(b)]);
    const focus = [];
    for (const r of rows) {
      const seg = c.seg[r.id];
      const pts = seg.pts || (seg.p ? decodePolyline(seg.p) : null);
      if (!pts || pts.length < 2) continue;
      const k = kind(r);
      const line = L.polyline(pts, { ...STYLE[k], opacity: 0.9 });
      line.bindPopup(() => h('div', null, h('strong', null, r.name), h('br'), STATUS_TEXT(r)));
      line.addTo(S.group); S.layers[r.id] = line;
      if (k !== 'other') focus.push(line);
    }
    S.map.invalidateSize();
    const fitTo = focus.length ? L.featureGroup(focus) : S.group;
    if (fitTo.getLayers().length) S.map.fitBounds(fitTo.getBounds(), { padding: [20, 20], maxZoom: 15 });
    else S.map.setView([20, 0], 2);
  }

  function focusSegment(id) {
    const d = $('dMap');
    if (!d.open) d.open = true;   // the toggle handler draws the map
    setTimeout(() => {
      if (!S.map) renderMap(compute(S.cache));
      const line = S.layers[id];
      d.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (line) { S.map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 }); line.openPopup(); }
    }, 50);
  }

  // ---------- demo ----------
  function demoCache() {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const t0 = todayIdx(); const c = emptyCache();
    c.athlete = { id: 1, units: 'mi' }; c.lastSync = Date.now();
    const iso = (di) => `${new Date(di * DAY).toISOString().slice(0, 10)}T07:00:00Z`;
    const start = Date.UTC(new Date().getFullYear() - 1, 0, 1) / DAY;
    let n = 0;
    for (let di = start; di <= t0; di++) {
      const wd = new Date(di * DAY).getUTCDay();
      if (rnd() < [0.85, 0.35, 0.8, 0.55, 0.8, 0.3, 0.7][wd]) {
        c.acts[`d${++n}`] = { s: di * 86400, d: iso(di), m: (2.5 + rnd() * 4.5 + (wd === 0 ? 3 : 0)) * 1609.344, v: rnd() < 0.92 ? 'everyone' : 'only_me' };
      }
    }
    const pub = Object.entries(c.acts).filter(([, a]) => a.v === 'everyone').map(([id]) => id);
    const specs = [
      ['Creekside Path North', 24, 'me', 3], ['Library Hill', 17, 'me', 1], ['Bridge to Bridge', 31, 'me', 0],
      ['Water Tower Climb', 12, 'me', 0], ['Park Loop East', 9, 'me', 0], ['Rail Trail Mile', 40, 'me', 0],
      ['Orchard Lane', 14, 'me', 0], ['Riverbend Sprint', 10, 11, 0], ['Cemetery Hill', 6, 8, 0],
      ['Old Mill Straight', 15, 18, 0], ['Ridge Road Kicker', 3, 22, 0], ['Stadium Stairs Road', 2, 9, 0],
    ];
    specs.forEach(([name, mine, leader, exp7], k) => {
      const id = String(9000 + k); const effs = [];
      for (let j = 0; j < mine; j++) {
        const di = j < exp7 ? t0 - 89 + Math.floor(rnd() * 7) : t0 - 82 + Math.floor(rnd() * 83);
        effs.push([iso(di), pub[Math.floor(rnd() * pub.length)]]);
      }
      let lat = 40.015 + ((k % 4) - 1.5) * 0.016 + (rnd() - 0.5) * 0.004;
      let lng = -105.27 + (Math.floor(k / 4) - 1) * 0.022 + (rnd() - 0.5) * 0.004;
      const dir = rnd() * Math.PI * 2; const pts = [];
      for (let s = 0; s < 14; s++) { pts.push([lat, lng]); lat += Math.sin(dir + s * 0.12) * 0.0008; lng += Math.cos(dir + s * 0.12) * 0.0011; }
      c.eff[id] = effs;
      c.seg[id] = { n: name, m: 400 + Math.floor(rnd() * 1600), at: Date.now(), ll: { id: leader === 'me' ? 1 : 2, n: leader === 'me' ? mine : leader }, pts };
    });
    return c;
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

  // ---------- disconnect ----------
  async function disconnect() {
    if (!window.confirm('Remove your Strava keys and all cached data from this browser? You can connect again any time.')) return;
    const t = token();
    if (t && t.access_token) {
      // Best effort: also revoke this page's access at Strava.
      try { await fetch(DEAUTH_URL, { method: 'POST', body: new URLSearchParams({ access_token: t.access_token }) }); } catch { /* ignore */ }
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

  // ---------- setup screen ----------
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

  // ---------- start ----------
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
      render();
      sync(false);
    } else if (new URLSearchParams(location.search).has('demo')) {
      startDemo();
    } else {
      render();
    }
    setInterval(renderStatus, 60e3);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !S.demo && token() && S.cache && Date.now() - (S.cache.lastSync || 0) > 15 * 60e3) sync(false);
    });
  }

  init();
})();
