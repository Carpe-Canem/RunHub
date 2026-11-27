// Races: a cache of the athlete's whole race history, kept apart from the Local Legends cache.
import { S, store, RateLimited } from './core.js';
import { api } from './strava.js';
import { isRace, summaryFrom, detailFrom, reduceProfile } from './races-model.js';

const FULL = 'This browser\'s storage is full, so some data will be fetched again next time.';
const SKIPPED = 'Some race details could not be read; they will be retried.';
const PER = 200;
const racesKey = (id) => `lw.races.${id}`;
const detKey = (id) => `lw.raceDet.${id}`;
const freshScan = () => ({ done: false, started: 0, cursor: 0, seen: [] });

export const emptyRaces = () => ({ v: 1, races: {}, scan: freshScan(), lastScan: 0 });

export function loadRaces(id) { const c = store.get(racesKey(id)); return c && c.v === 1 && c.races && c.scan ? c : emptyRaces(); }

// Stored as {v: 1, det: {...}}; held in S.raceDet as the bare id map.
export function loadRaceDet(id) { const c = store.get(detKey(id)); return c && c.v === 1 && c.det ? c.det : {}; }

const off = () => S.demo || !S.athleteId;

export function saveRaces() {
  if (off() || !S.races) return;
  if (store.set(racesKey(S.athleteId), S.races)) return;
  // Details go before summaries. Only the stored copy: the details stay in memory, so this session does not
  // fetch them all again, and the next load does (hence the warning).
  store.del(detKey(S.athleteId));
  S.warn = FULL;
  store.set(racesKey(S.athleteId), S.races);
}

export function saveRaceDet() {
  if (off() || !S.raceDet) return;
  const put = () => store.set(detKey(S.athleteId), { v: 1, det: S.raceDet });
  if (put()) return;
  for (const d of Object.values(S.raceDet)) delete d.prof;
  if (!put()) S.warn = FULL;
}

const startOf = (a) => (a.start_date ? Date.parse(a.start_date) / 1000 || 0 : 0);

// Races in an activity list the Legends sync already fetched. A cached race inside the listed window
// that is no longer a race there was un-flagged or deleted.
export function noteListed(rc, list, after) {
  if (!rc) return;
  const now = new Set();
  const sc = rc.scan;
  for (const a of list) {
    if (!isRace(a)) continue;
    const r = summaryFrom(a); rc.races[r.id] = r; now.add(r.id);
    // during a scan, a race added here counts as seen, so the end-of-scan prune keeps it
    if (sc && !sc.done && !sc.seen.includes(r.id)) sc.seen.push(r.id);
  }
  for (const [id, r] of Object.entries(rc.races)) if (r.s > after && !now.has(id)) delete rc.races[id];
}

// Walk back through the whole history, 200 at a time. Safe to re-run: a pause leaves the cursor saved.
export async function scanHistory(rc, call = api) {
  if (!rc || rc.scan.done) return;
  const sc = rc.scan;
  // A day ahead, so a race started "now" in a far-east time zone is not missed.
  if (!sc.started) { sc.started = Math.floor(Date.now() / 1000) + 86400; saveRaces(); }
  for (;;) {
    const before = sc.cursor || sc.started;
    const list = (await call(`/athlete/activities?before=${before}&per_page=${PER}`)) || [];
    let oldest = Infinity;
    for (const a of list) {
      const s = startOf(a);
      if (s && s < oldest) oldest = s;
      if (!isRace(a)) continue;
      const r = summaryFrom(a);
      rc.races[r.id] = r;
      if (!sc.seen.includes(r.id)) sc.seen.push(r.id);
    }
    if (Number.isFinite(oldest)) sc.cursor = Math.floor(oldest) + 1;
    saveRaces();
    if (list.length < PER || sc.cursor === before) break;
  }
  const seen = new Set(sc.seen);
  for (const [id, r] of Object.entries(rc.races)) if (r.s < sc.started && !seen.has(id)) delete rc.races[id];
  sc.done = true; sc.seen = [];
  rc.lastScan = Date.now();
  saveRaces();
}

export function rescan(rc) { rc.scan = freshScan(); }

// Errors that would fail every remaining request too: lost access or no connection. The sync reports them.
const stopsPass = (e) => !!(e && (e.refused || e.linkDead || e.authFailed || e.offline));

// One detail request per race not yet in rd, newest first. A rate-limit pause, lost access or no connection
// stops the pass (the sync says why; a resumed sync picks up where it left off). Any other error (a Strava
// 5xx, an unexpected throw) skips that race for this pass only: it is not recorded, so the next pass asks
// again, and the older races still get read.
export async function fetchRaceDetails(rc, rd, call = api, onStep = () => {}) {
  if (!rc || !rd) return;
  const todo = Object.values(rc.races).filter((r) => !rd[r.id]).sort((a, b) => b.s - a.s);
  let done = 0, read = 0, skipped = 0;
  if (S.warn === SKIPPED) S.warn = null;   // this pass asks for those races again
  try {
    for (const r of todo) {
      let a;
      try { a = await call(`/activities/${r.id}`); }
      catch (e) {
        if (e instanceof RateLimited || stopsPass(e)) throw e;
        console.warn('Race detail request failed', e);
        a = undefined; skipped++;
      }
      if (a !== undefined) { rd[r.id] = a ? detailFrom(a) : { at: Date.now(), missing: true }; read++; }
      done++;
      onStep(done, todo.length);
      if (read && done % 5 === 0) saveRaceDet();
    }
  } finally {
    if (read) saveRaceDet();
  }
  if (skipped) S.warn = SKIPPED;
}

export async function fetchProfile(id, call = api) {
  const st = await call(`/activities/${id}/streams?keys=altitude,distance&key_by_type=true`);
  const alt = st && st.altitude && st.altitude.data;
  const dist = st && st.distance && st.distance.data;
  if (!Array.isArray(alt) || !alt.length || !Array.isArray(dist)) return null;
  return reduceProfile(dist, alt, 80);
}

// What the details pass asks for after each race: a full redraw every 5 and at the end, else the status line.
export const detailStepEvent = (done, total) => (done % 5 === 0 || done === total ? 'data' : 'status');
