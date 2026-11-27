// Upcoming races: the stored list (hand-added races and the parsed Strava bio), kept apart from the other caches.
import { S, store, DAY, RateLimited } from './core.js';
import { api, token } from './strava.js';
import { FULL } from './races-sync.js';
import { parseBio, mergeUpcoming, isoDay, importUpcoming } from './upcoming.js';

export const NOT_SAVED = 'This browser couldn\'t save the race (its storage is full or blocked), so nothing was added.';
const upKey = (id) => `lw.upcoming.${id}`;

export const emptyUp = () => ({ v: 1, hand: [], bio: null });

// Hand-added races dated before today are finished: they come in from Strava now.
export function loadUp(athleteId, today = isoDay(new Date())) {
  const c = store.get(upKey(athleteId));
  if (!c || c.v !== 1 || !Array.isArray(c.hand)) return emptyUp();
  const ok = (r) => r && typeof r.n === 'string' && typeof r.date === 'string' && typeof r.cls === 'string' && r.date >= today;
  return { v: 1, hand: c.hand.filter(ok), bio: c.bio && typeof c.bio === 'object' ? c.bio : null };
}

// Hand-added races still to come, counted without the merge rules so a malformed list cannot throw.
export function handCount(up, today = isoDay(new Date())) {
  const hand = up && Array.isArray(up.hand) ? up.hand : [];
  return hand.filter((r) => r && typeof r.date === 'string' && r.date >= today).length;
}

// True without writing in the demo or with no athlete; false only when the browser refused the write.
export function saveUp(up = S.upcoming) {
  if (S.demo || !S.athleteId || !up) return true;
  return store.set(upKey(S.athleteId), up);
}

// What a change starts from. Another tab may have changed the stored list since this one loaded it, so outside
// the demo it is read again. null when this athlete is no longer connected here (another tab wiped this
// browser or connected someone else): nothing is then written, so a wipe is not undone.
function current(today) {
  if (!S.upcoming) return null;
  if (S.demo || !S.athleteId) return S.upcoming;
  const t = token();
  if (!t || String(t.athleteId) !== String(S.athleteId)) return null;
  return loadUp(S.athleteId, today);
}

// Keeps the parsed lines and the count of unreadable ones, never the bio text itself.
export function readBio(athlete, nowMs = Date.now(), today = isoDay(new Date())) {
  if (!S.upcoming) return;
  const text = athlete && typeof athlete.bio === 'string' ? athlete.bio : null;
  let bio;
  if (text === null) bio = { at: nowMs, races: [], bad: 0, none: true };
  else { const { races, bad } = parseBio(text); bio = { at: nowMs, races, bad }; }
  const cur = current(today);
  if (!cur) { S.upcoming = { ...S.upcoming, bio }; return; }
  S.upcoming = { ...cur, bio };
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
  readBio(a, nowMs, isoDay(new Date(nowMs)));
}

// Unique among `taken` (the ids already used, which it adds to): races added in one go share nowMs.
function newId(nowMs, taken) {
  const base = 'h' + nowMs.toString(36) + Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');
  let id = base;
  for (let i = 1; taken.has(id); i++) id = base + i.toString(36);
  taken.add(id);
  return id;
}
const ids = (hand) => new Set(hand.map((r) => r.id));

// Hand-added races cannot be fetched again: memory takes the change only once it is saved, so a failed save
// leaves it as it was and the caller reports it.
export function addHand(race, nowMs = Date.now(), today = isoDay(new Date())) {
  const cur = current(today);
  if (!cur) return null;
  const r = { id: newId(nowMs, ids(cur.hand)), n: race.n, date: race.date, time: race.time || null, cls: race.cls, place: race.place || null, at: nowMs };
  const next = { ...cur, hand: [...cur.hand, r] };
  if (!saveUp(next)) return null;
  S.upcoming = next;
  return r;
}

export function removeHand(id, today = isoDay(new Date())) {
  if (!S.upcoming) return true;
  const cur = current(today);
  if (!cur) return false;
  if (!cur.hand.some((r) => r.id === id)) { S.upcoming = cur; return true; }
  const next = { ...cur, hand: cur.hand.filter((r) => r.id !== id) };
  if (!saveUp(next)) return false;
  S.upcoming = next;
  return true;
}

export function upcomingRows(today = isoDay(new Date())) {
  return S.upcoming ? mergeUpcoming(S.upcoming, today) : [];
}

// All or nothing: a failed save adds none. Checked against hand-added races only, so a race that is in the bio can be added.
export function importHand(text, today = isoDay(new Date()), nowMs = Date.now()) {
  const cur = current(today);
  if (!cur) return { error: NOT_SAVED };
  const res = importUpcoming(text, cur.hand, today);
  if (res.error) return res;
  if (!res.add.length) { S.upcoming = cur; return { added: 0, dup: res.dup, past: res.past, bad: res.bad }; }
  const taken = ids(cur.hand);
  const next = { ...cur, hand: [...cur.hand, ...res.add.map((r) => ({ id: newId(nowMs, taken), n: r.n, date: r.date, time: r.time, cls: r.cls, place: r.place, at: nowMs }))] };
  if (!saveUp(next)) return { error: NOT_SAVED };
  S.upcoming = next;
  return { added: res.add.length, dup: res.dup, past: res.past, bad: res.bad };
}
