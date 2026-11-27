// Upcoming races: pure rules for bio lines, hand-added races and countdowns.
import { plural } from './core.js';
import { STANDARDS, classify, classColour, seriesKey } from './race-rules.js';

export const CLASS_OPTIONS = [...STANDARDS.map((s) => s.cls), 'Other'];
export const PAST = 'Finished races come in from Strava.';
export const DUP = 'That race is already in Up next.';

const pad = (n) => String(n).padStart(2, '0');
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const validDate = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const isoOk = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return !!m && validDate(+m[1], +m[2], +m[3]);
};
const utcDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((utcDay(a) - utcDay(b)) / 86400000);
const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const DATE_LIKE = /^\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/;
const READABLE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/;

// Only MM/DD/YYYY with "/" is readable; other separators count as unreadable.
export function parseBio(text) {
  const races = [];
  let bad = 0;
  for (const line of String(text ?? '').split(/\r\n|\r|\n/)) {
    if (!DATE_LIKE.test(line)) continue;
    const m = READABLE.exec(line);
    const n = m ? cleanName(m[4]).slice(0, 80).trim() : '';
    if (m && n && validDate(+m[3], +m[1], +m[2])) races.push({ date: `${m[3]}-${pad(+m[1])}-${pad(+m[2])}`, n });
    else bad++;
  }
  return { races, bad };
}

export function sameRace(a, b) {
  if (a.date !== b.date) return false;
  const ka = seriesKey(a.n), kb = seriesKey(b.n);
  if (!ka || !kb) return cleanName(a.n).toLowerCase() === cleanName(b.n).toLowerCase();
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

export function checkHand(f, today, existing) {
  const n = cleanName(f.n);
  if (!n) return { error: 'Enter the race name.' };
  if (n.length > 80) return { error: 'Keep the name to 80 characters.' };
  if (!isoOk(f.date)) return { error: 'Enter the race date.' };
  if (f.date < today) return { error: PAST };
  const time = f.time ? String(f.time).trim() : '';
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Enter the start time as hours and minutes, or leave it empty.' };
  let cls = f.cls || '';
  if (cls && !CLASS_OPTIONS.includes(cls)) return { error: 'Choose a distance from the list.' };
  if (!cls) { const c = classify(n, 0).cls; cls = CLASS_OPTIONS.includes(c) ? c : 'Other'; }
  const place = cleanName(f.place);
  if (place.length > 60) return { error: 'Keep the place to 60 characters.' };
  const race = { n, date: f.date, time: time || null, cls, place: place || null };
  if ((existing || []).some((e) => sameRace(e, race))) return { error: DUP };
  return { race };
}

const bioId = (r) => 'bio-' + r.date + '-' + cleanName(r.n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function mergeUpcoming(up, today) {
  const hand = ((up && up.hand) || []).filter((r) => r.date >= today)
    .map((r) => ({ id: r.id, n: r.n, date: r.date, time: r.time || null, cls: r.cls, colour: classColour(r.cls), place: r.place || null, src: 'hand' }));
  const bio = ((up && up.bio && up.bio.races) || []).filter((r, i, all) => r.date >= today && !hand.some((h) => sameRace(h, r)) && !all.slice(0, i).some((e) => sameRace(e, r)))
    .map((r) => {
      const cls = classify(r.n, 0).cls;
      return { id: bioId(r), n: r.n, date: r.date, time: null, cls, colour: classColour(cls), place: null, src: 'bio' };
    });
  return [...hand, ...bio].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '99:99') < (b.time || '99:99') ? -1 : (a.time || '99:99') > (b.time || '99:99') ? 1 : 0);
}

export function daysText(row, today) {
  const d = dayDiff(row.date, today);
  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
}

// Counts to local midnight at the start of race day, whatever the start time; from then on it is race day.
export function countdown(row, now) {
  const [y, m, d] = row.date.split('-').map(Number);
  const s = Math.ceil((new Date(y, m - 1, d) - now) / 1000);
  if (!(s > 0)) return { kind: 'today' };
  return { kind: 'clock', days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), mins: Math.floor((s % 3600) / 60), secs: s % 60 };
}

// Upcoming rows without the ones Strava already has: a race logged on the row's date with the same name or the
// same distance (any race that day when the row's distance is Other). races: the cached Strava race summaries.
export function dropLogged(rows, races) {
  const dates = new Set(rows.map((r) => r.date));
  const done = Object.values(races || {}).filter((r) => r && typeof r.d === 'string' && dates.has(r.d.slice(0, 10)))
    .map((r) => ({ date: r.d.slice(0, 10), n: r.n || '', cls: classify(r.n, r.m).cls }));
  if (!done.length) return rows;
  return rows.filter((row) => !done.some((r) => r.date === row.date && (row.cls === 'Other' || r.cls === row.cls || sameRace(r, row))));
}

// What the hub's tick does, given what Next start last drew ({id, kind}, or null when it could not draw).
export function tickAction(shown, up, now, hasClock) {
  if (!shown || !Array.isArray(up)) return { do: 'nothing' };
  const r = up[0] || null;
  if (!r) return { do: shown.id === null ? 'nothing' : 'redraw' };
  const cd = countdown(r, now);
  if (r.id !== shown.id || cd.kind !== shown.kind || !hasClock) return { do: 'redraw' };
  return { do: 'clock', cd };
}

// Has the local day moved on from the one (YYYY-MM-DD) that was drawn?
export const dayChanged = (drawn, now) => isoDay(now) !== drawn;

// What a screen reader hears for the countdown: no seconds, and no days part on the last day; null for "Race day".
export function countdownLabel(cd) {
  if (cd.kind !== 'clock') return null;
  const hm = `${plural(cd.hours, 'hour')} and ${plural(cd.mins, 'minute')}`;
  return `${cd.days ? `${plural(cd.days, 'day')}, ` : ''}${hm} to race day`;
}

const NOT_EXPORT = "This isn't a Run Hub races export.";
const TOO_LONG = 'That is too long to be a Run Hub races export.';
const MAX_TEXT = 200000, MAX_RACES = 200;

export function exportUpcoming(hand) {
  const races = (hand || []).map((r) => ({ n: r.n, date: r.date, time: r.time || null, cls: r.cls, place: r.place || null }));
  return JSON.stringify({ app: 'Run Hub', kind: 'upcoming', v: 1, races }, null, 2);
}

const optText = (v) => v == null || typeof v === 'string';

// Each race goes through the same rules as the Add race sheet; text is only ever data.
export function importUpcoming(text, existing, today) {
  if (typeof text !== 'string' || text.length > MAX_TEXT) return { error: TOO_LONG };
  let j;
  try { j = JSON.parse(text); } catch { return { error: NOT_EXPORT }; }
  if (!j || typeof j !== 'object' || Array.isArray(j) || j.app !== 'Run Hub' || j.kind !== 'upcoming' || j.v !== 1 || !Array.isArray(j.races)) return { error: NOT_EXPORT };
  if (j.races.length > MAX_RACES) return { error: TOO_LONG };
  const out = { add: [], dup: 0, past: 0, bad: 0 };
  const seen = [...(existing || [])];
  for (const f of j.races) {
    if (!f || typeof f !== 'object' || typeof f.n !== 'string' || typeof f.date !== 'string' || !optText(f.time) || !optText(f.cls) || !optText(f.place)) { out.bad++; continue; }
    const r = checkHand(f, today, seen);
    if (r.race) { out.add.push(r.race); seen.push(r.race); }
    else if (r.error === PAST) out.past++;
    else if (r.error === DUP) out.dup++;
    else out.bad++;
  }
  return out;
}
