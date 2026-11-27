// The sync: the athlete, the list of runs (for mileage and for spotting races), the bio, then the race history.
import { S, bus, RUN_TYPES, DAY, UserError, RateLimited } from './core.js';
import { api, token } from './strava.js';
import { saveCache } from './runs-model.js';
import { enrich } from './enrich-sync.js';
import { readBio, syncBio } from './upcoming-sync.js';
import { noteListed, saveRaces, scanHistory, fetchRaceDetails, detailStepEvent } from './races-sync.js';

export async function sync(manual) {
  if (S.demo || S.syncing || !token()) return;
  clearTimeout(S.resumeTimer);
  S.syncing = true; S.error = null;
  S.progress = { label: 'Checking for new runs', done: 0, total: 0 };
  bus.emit('status');
  const c = S.cache;
  // The first sync has no runs to show yet. The views redraw now, so Ziggy can say he is fetching them.
  if (!c.athlete) bus.emit('data');
  try {
    if (!c.athlete) {
      const a = await api('/athlete');
      c.athlete = { id: a.id, units: a.measurement_preference === 'meters' ? 'km' : 'mi' };
      saveCache();
      readBio(a);   // the same answer carries the bio
    }
    await syncActivities(c, manual);
    c.lastSync = Date.now();
    S.pausedUntil = 0;
    saveCache();
    bus.emit('data');
    await syncBio(manual);
    await syncRaces();
  } catch (e) {
    if (e instanceof RateLimited) {
      S.pausedUntil = e.until;
      clearTimeout(S.resumeTimer);
      S.resumeTimer = setTimeout(() => sync(false), Math.max(5e3, e.until - Date.now() + 5e3));
    } else {
      S.error = e instanceof UserError ? e.message : 'Something went wrong while syncing. Press Retry to try again.';
      console.error(e);
    }
    saveCache();
  } finally {
    S.syncing = false; S.progress = null;
    bus.emit('data');
    enrich();   // not awaited; also when the race scan was skipped, so new races get weather (it returns at once in the demo or with no caches)
  }
}

async function syncActivities(c, manual) {
  const nowSec = Math.floor(Date.now() / 1000);
  const floor = Date.UTC(new Date().getFullYear() - 1, 0, 1) / 1000 - 2 * 86400;
  let after = c.lastStart ? c.lastStart - 2 * 86400 : floor;
  // Once a day (or on Refresh now) re-list 95 days to pick up edits, changed race flags and deletions.
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
      c.acts[a.id] = { s, d: a.start_date_local, m: a.distance || 0 };
      if (s > c.lastStart) c.lastStart = s;
    }
    if (list.length < 200) break;
  }
  for (const [id, a] of Object.entries(c.acts)) {
    if ((a.s > after && !seen.has(id)) || a.s < floor) delete c.acts[id];
  }
  if (after <= nowSec - 94 * 86400) c.lastFull = Date.now();
  saveCache();
  // Every item listed, before the run filter, so only runs can become races. Once, after the last page.
  if (S.races) { noteListed(S.races, listed, after); saveRaces(); }
}

// After the runs: the whole-history race scan, then one detail request per race.
async function syncRaces() {
  if (!S.races || !S.raceDet) return;
  S.progress = { label: 'Scanning your race history', done: 0, total: 0 };
  bus.emit('status');
  await scanHistory(S.races);
  enrich();   // not awaited: it runs outside the Strava budget
  bus.emit('data');
  S.progress = { label: 'Reading race details', done: 0, total: 0 };
  bus.emit('status');
  await fetchRaceDetails(S.races, S.raceDet, api, (done, total) => {
    S.progress.done = done; S.progress.total = total;
    bus.emit(detailStepEvent(done, total));   // a full redraw every 5 races
  });
}
