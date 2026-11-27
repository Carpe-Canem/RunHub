// Race enrichment: weather for each race's start point and hour, cached apart from the race details.
// Runs outside sync(): it uses fetch directly, never api(), so it neither spends nor waits on the Strava budget.
import { S, bus, store } from './core.js';
import { FULL } from './races-sync.js';
import { weatherUrl, pickHour, needsWeather, isProvisional } from './weather.js';

const envKey = (id) => `lw.raceEnv.${id}`;
const MAX_FAILS = 3;
const SAVE_EVERY = 5;

export const emptyEnv = () => ({ v: 1, wx: {}, pl: {} });

export function loadEnv(id) {
  const c = store.get(envKey(id));
  return c && c.v === 1 && c.wx && c.pl ? c : emptyEnv();
}

export function saveEnv() {
  if (S.demo || !S.athleteId || !S.raceEnv) return;
  if (!store.set(envKey(S.athleteId), S.raceEnv)) S.warn = FULL;
}

// One archive request per race with a start point that needs weather, newest first. Three request failures in a
// row (an HTTP error or a thrown fetch) end the pass; the next pass asks again. An answer with no usable start
// hour is not a failure: it is stored as {at, none: true}, which is asked again only a week later.
export async function fetchWeather(rc, env, get = fetch, nowSec = Date.now() / 1000) {
  if (!rc || !env) return;
  let dropped = 0;
  for (const id of Object.keys(env.wx)) if (!rc.races[id]) { delete env.wx[id]; dropped++; }
  const todo = Object.values(rc.races).filter((r) => needsWeather(r, env.wx[r.id], nowSec)).sort((a, b) => b.s - a.s);
  let fails = 0, stored = 0;
  try {
    for (const r of todo) {
      if (S.raceEnv !== env) break;   // wiped or replaced mid-pass: send nothing more
      const date = r.d.slice(0, 10);
      let json;
      try {
        const res = await get(weatherUrl(r.ll, date));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      } catch (e) {
        console.warn('Weather request failed', e);
        if (++fails >= MAX_FAILS) break;
        continue;
      }
      fails = 0;
      const hour = pickHour(json, date, r.d.slice(11, 16));
      env.wx[r.id] = hour ? { ...hour, at: nowSec, prov: isProvisional(r.s, nowSec) } : { at: nowSec, none: true };
      if (++stored % SAVE_EVERY === 0) saveEnv();
    }
  } finally {
    if (stored) saveEnv();
  }
  if (stored || dropped) bus.emit('data');
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
    } while (again);
  } finally { running = false; }
}
