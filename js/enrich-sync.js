// Race enrichment: weather for each race's start point and hour, and the town of each start point, cached apart from the race details.
// Runs outside sync(): it uses fetch directly, never api(), so it neither spends nor waits on the Strava budget.
import { S, K, bus, store } from './core.js';
import { FULL } from './races-sync.js';
import { weatherUrl, utcStart, pickHour, needsWeather, isProvisional } from './weather.js';
import { PLACE_LOOKUPS, pointKey, placeUrl, placeLabel } from './places.js';

const envKey = (id) => `lw.raceEnv.${id}`;
const MAX_FAILS = 3;
const SAVE_EVERY = 5;

export const emptyEnv = () => ({ v: 2, wx: {}, pl: {} });

export function loadEnv(id) {
  const c = store.get(envKey(id));
  return c && c.v === 2 && c.wx && c.pl ? c : emptyEnv();
}

export function saveEnv() {
  if (S.demo || !S.athleteId || !S.raceEnv) return;
  if (!store.set(envKey(S.athleteId), S.raceEnv)) S.warn = FULL;
}

// One archive request per race with a start point that needs weather, newest first. Three request failures in a
// row (an HTTP error or a thrown fetch) end the pass; the next pass asks again. An answer with no usable start
// hour is not a failure: it is stored as {at, none: true}, which is asked again only a week later. A permanent
// client error (4xx other than 429) is the same: no point asking again at once. A race with no UTC start is skipped.
// The hour is read in GMT from the race's UTC start s.
export async function fetchWeather(rc, env, get = fetch, nowSec = Date.now() / 1000) {
  if (!rc || !env) return;
  let dropped = 0;
  for (const id of Object.keys(env.wx)) if (!rc.races[id]) { delete env.wx[id]; dropped++; }
  const todo = Object.values(rc.races).filter((r) => needsWeather(r, env.wx[r.id], nowSec)).sort((a, b) => b.s - a.s);
  let fails = 0, stored = 0;
  try {
    for (const r of todo) {
      if (S.raceEnv !== env) break;   // wiped or replaced mid-pass: send nothing more
      const { date, time } = utcStart(r.s);
      let json = null;
      try {
        const res = await get(weatherUrl(r.ll, date));
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 429) json = {};   // permanent: stored as none below
          else throw new Error(`HTTP ${res.status}`);
        } else json = await res.json();
      } catch (e) {
        console.warn('Weather request failed', e);
        if (++fails >= MAX_FAILS) break;
        continue;
      }
      fails = 0;
      const hour = pickHour(json, date, time);
      env.wx[r.id] = hour ? { ...hour, at: nowSec, prov: isProvisional(r.s, nowSec) } : { at: nowSec, none: true };
      if (++stored % SAVE_EVERY === 0) { saveEnv(); bus.emit('data'); }
    }
  } finally {
    if (stored || dropped) saveEnv();
  }
  if (stored % SAVE_EVERY !== 0 || dropped) bus.emit('data');
}

export const placesOn = () => PLACE_LOOKUPS && store.get(K.places) !== false;
export function setPlaces(on) { if (on) store.del(K.places); else store.set(K.places, false); }

const GAP_MS = 1500;
let blocked = false, sentOne = false;
export function resetPlaces() { blocked = false; sentOne = false; }   // for tests

// One Nominatim request per distinct rounded start point not yet asked, newest race first, 1.5 s apart (also across
// passes). A 429 or 403 stops lookups for the rest of the page session; any other failure ends only this pass.
// A point with no town is stored as {n: null, at} and never asked again.
export async function fetchPlaces(rc, env, get = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), nowSec = Date.now() / 1000) {
  if (!rc || !env || !placesOn() || blocked) return;
  const seen = new Set(), todo = [];
  for (const r of Object.values(rc.races).filter((x) => x.ll).sort((a, b) => b.s - a.s)) {
    const k = pointKey(r.ll);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!env.pl[k]) todo.push([k, r.ll]);
  }
  let stored = 0;
  try {
    for (const [k, ll] of todo) {
      if (S.raceEnv !== env || blocked) break;   // wiped or replaced mid-pass, or blocked: send nothing more
      if (sentOne) await sleep(GAP_MS);
      if (S.raceEnv !== env || blocked || !placesOn()) break;
      let json;
      try {
        sentOne = true;
        const res = await get(placeUrl(ll));
        if (res.status === 429 || res.status === 403) { blocked = true; break; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      } catch (e) {
        console.warn('Place request failed', e);
        break;
      }
      env.pl[k] = { n: placeLabel(json), at: nowSec };
      if (++stored % SAVE_EVERY === 0) { saveEnv(); bus.emit('data'); }
    }
  } finally {
    if (stored) saveEnv();
  }
  if (stored % SAVE_EVERY !== 0) bus.emit('data');
}

let running = false, again = false;

// One pass in flight at a time; a call during a pass queues exactly one more. Never rejects.
export async function enrich(get = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (S.demo || !S.races || !S.raceEnv) return;
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      if (S.demo || !S.races || !S.raceEnv) break;
      try { await fetchWeather(S.races, S.raceEnv, get); }
      catch (e) { console.error('Weather pass failed', e); }
      try { await fetchPlaces(S.races, S.raceEnv, get, sleep); }
      catch (e) { console.error('Place pass failed', e); }
    } while (again);
  } finally { running = false; }
}
