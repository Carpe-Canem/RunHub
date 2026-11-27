// Local Legends: fetching runs, segments and leader counts from Strava.
import { S, bus, RUN_TYPES, WINDOW, DAY, HOT_MAX_AGE, COLD_MAX_AGE, MANUAL_MAX_AGE, UserError, RateLimited, dayOf, todayIdx } from './core.js';
import { api, token } from './strava.js';
import { saveCache, compute, legendCount } from './legends-model.js';
import { noteListed, saveRaces, scanHistory, fetchRaceDetails } from './races-sync.js';

export async function sync(manual) {
  if (S.demo || S.syncing || !token()) return;
  clearTimeout(S.resumeTimer);
  S.syncing = true; S.error = null;
  S.progress = { label: 'Checking for new runs', done: 0, total: 0 };
  bus.emit('status');
  const c = S.cache;
  try {
    if (!c.athlete) {
      const a = await api('/athlete');
      c.athlete = { id: a.id, units: a.measurement_preference === 'meters' ? 'km' : 'mi' };
      saveCache();
    }
    await syncActivities(c, manual);
    bus.emit('data');
    await syncDetails(c);
    bus.emit('data');
    await syncLeaders(c, manual);
    c.lastSync = Date.now();
    S.pausedUntil = 0;
    saveCache();
    await syncRaces();
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
    bus.emit('data');
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
  bus.emit('status');
  const seen = new Set();
  const listed = [];
  for (let page = 1; ; page++) {
    const list = (await api(`/athlete/activities?after=${after}&per_page=200&page=${page}`)) || [];
    listed.push(...list);
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
  // Every item listed, before the run filter, so only runs can become races. Once, after the last page.
  if (S.races) { noteListed(S.races, listed, after); saveRaces(); }
}

// After the Legends work: the whole-history race scan, then one detail request per race.
async function syncRaces() {
  if (!S.races || !S.raceDet) return;
  S.progress = { label: 'Scanning your race history', done: 0, total: 0 };
  bus.emit('status');
  await scanHistory(S.races);
  bus.emit('data');
  S.progress = { label: 'Reading race details', done: 0, total: 0 };
  bus.emit('status');
  await fetchRaceDetails(S.races, S.raceDet, api, (done, total) => {
    S.progress.done = done; S.progress.total = total;
    bus.emit('data');
  });
}

async function syncDetails(c) {
  const t0 = todayIdx(); const from = t0 - (WINDOW - 1);
  const todo = Object.entries(c.acts)
    .filter(([id, a]) => !c.det[id] && dayOf(a.d) >= from)
    .sort((x, y) => y[1].s - x[1].s);
  S.progress = { label: 'Reading segments from your runs', done: 0, total: todo.length };
  bus.emit('status');
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
    bus.emit('status');
    if (S.progress.done % 5 === 0) saveCache();
  }
  for (const [sid, list] of Object.entries(c.eff)) {
    const kept = list.filter((x) => dayOf(x[0]) >= from - 1);
    if (kept.length) c.eff[sid] = kept; else { delete c.eff[sid]; delete c.seg[sid]; }
  }
  for (const id of Object.keys(c.det)) if (!c.acts[id] || dayOf(c.acts[id].d) < from - 1) delete c.det[id];
  saveCache();
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
  bus.emit('status');
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
    if (S.progress.done % 5 === 0) { saveCache(); bus.emit('data'); } else bus.emit('status');
  }
}
