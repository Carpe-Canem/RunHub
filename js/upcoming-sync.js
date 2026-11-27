// Upcoming races: the stored list (hand-added races and the parsed Strava bio), kept apart from the other caches.
import { S, store, DAY, RateLimited } from './core.js';
import { api } from './strava.js';
import { FULL } from './races-sync.js';
import { parseBio, mergeUpcoming, isoDay } from './upcoming.js';

export const NOT_SAVED = 'This browser couldn\'t save the race (its storage is full or blocked), so nothing was added.';
const upKey = (id) => `lw.upcoming.${id}`;

export const emptyUp = () => ({ v: 1, hand: [], bio: null });

// Hand-added races dated before today are finished: they come in from Strava now.
export function loadUp(athleteId, today = isoDay(new Date())) {
  const c = store.get(upKey(athleteId));
  if (!c || c.v !== 1 || !Array.isArray(c.hand)) return emptyUp();
  return { v: 1, hand: c.hand.filter((r) => r && typeof r.date === 'string' && r.date >= today), bio: c.bio && typeof c.bio === 'object' ? c.bio : null };
}

// True without writing in the demo or with no athlete; false only when the browser refused the write.
export function saveUp() {
  if (S.demo || !S.athleteId || !S.upcoming) return true;
  return store.set(upKey(S.athleteId), S.upcoming);
}

// Keeps the parsed lines and the count of unreadable ones, never the bio text itself.
export function readBio(athlete, nowMs = Date.now()) {
  if (!S.upcoming) return;
  const text = athlete && typeof athlete.bio === 'string' ? athlete.bio : null;
  if (text === null) S.upcoming.bio = { at: nowMs, races: [], bad: 0, none: true };
  else { const { races, bad } = parseBio(text); S.upcoming.bio = { at: nowMs, races, bad }; }
  if (!saveUp()) S.warn = FULL;   // the bio is fetched again, like the other caches
}

// One /athlete request when the stored bio is missing or a day old, and on every manual refresh.
export async function syncBio(manual, call = api, nowMs = Date.now()) {
  const up = S.upcoming;
  if (!up || S.demo) return;
  if (!manual && up.bio && nowMs - up.bio.at < DAY) return;
  let a;
  try { a = await call('/athlete'); }
  catch (e) {
    if (e instanceof RateLimited) throw e;
    console.warn('Bio request failed', e);
    return;
  }
  readBio(a, nowMs);
}

const newId = (nowMs) => 'h' + nowMs.toString(36) + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');

// Hand-added races cannot be fetched again, so a failed save is undone and reported to the caller.
export function addHand(race, nowMs = Date.now()) {
  if (!S.upcoming) return null;
  const before = S.upcoming.hand;
  const r = { id: newId(nowMs), n: race.n, date: race.date, time: race.time || null, cls: race.cls, place: race.place || null, at: nowMs };
  S.upcoming.hand = [...before, r];
  if (saveUp()) return r;
  S.upcoming.hand = before;
  return null;
}

export function removeHand(id) {
  if (!S.upcoming) return true;
  const before = S.upcoming.hand;
  if (!before.some((r) => r.id === id)) return true;
  S.upcoming.hand = before.filter((r) => r.id !== id);
  if (saveUp()) return true;
  S.upcoming.hand = before;
  return false;
}

export function upcomingRows(today = isoDay(new Date())) {
  return S.upcoming ? mergeUpcoming(S.upcoming, today) : [];
}
