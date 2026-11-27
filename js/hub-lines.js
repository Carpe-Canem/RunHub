// The hub's sentences. Pure: no DOM. A line is {key, parts, href?}; a part is {text}, {led} (a number drawn in
// clock digits) or {text, tone: 'go' | 'slow'}. hub.js turns them into nodes.
import { fmt0, fmt1 } from './core.js';
import { fmtTime } from './races-model.js';

export const NOTHING_ON = 'Nothing on the calendar.';

const unitWord = (u) => (u === 'km' ? 'km' : 'miles');
const t = (text, tone) => (tone ? { text, tone } : { text });

// mi: from miles() in runs-model.js, or null until the first sync has loaded the runs.
export function mileLines(mi, units) {
  if (!mi) return [{ key: 'runs-loading', parts: [t('Loading your runs from Strava.')] }];
  const u = unitWord(mi.unit || units);
  // A part-week under the average is normal, so the week is never called "behind".
  const over = +fmt1(mi.week - mi.weekAvg);
  const week = [{ led: fmt1(mi.week) }, t(` ${u} this week.`)];
  if (over > 0 && mi.weekAvg > 0) week.push(t(" That's "), t(`${fmt1(over)} over`, 'go'), t(' your usual.'));
  else if (mi.weekAvg > 0) week.push(t(` Your usual week is ${fmt1(mi.weekAvg)}.`));
  const year = [{ led: fmt0(mi.ytd) }, t(` ${u} this year`)];
  const diff = Math.round(mi.ytd) - Math.round(mi.lytd);
  if (!mi.hasLastYear) year.push(t('.'));
  else if (diff > 0) year.push(t(', '), t(`${fmt0(diff)} ahead`, 'go'), t(' of this date last year.'));
  else if (diff < 0) year.push(t(', '), t(`${fmt0(-diff)} behind`, 'slow'), t(' this date last year.'));
  else year.push(t(', level with this date last year.'));
  return [{ key: 'week', parts: week }, { key: 'year', parts: year }];
}

// stats: from hubStats() in races-model.js, or null while the race history is still loading.
export function raceLines(stats) {
  if (!stats) return [{ key: 'races-loading', parts: [t('Loading your race history.')] }];
  if (!stats.count) return [{ key: 'none', parts: [t('No races yet.')] }];
  const out = [];
  const r = stats.latest && stats.latest[0];
  if (r) {
    const name = r.n || 'a race';
    const parts = [t(`Last out: ${name}`)];
    if (r.t > 0) parts.push(t(' in '), { led: fmtTime(r.t) }, t('.'));
    else if (!/[.!?]$/.test(name)) parts.push(t('.'));   // a name that ends its own sentence gets no second stop
    if (r.record) parts.push(t(' '), t(`Your fastest ${r.cls} yet.`, 'go'));
    out.push({ key: 'last', href: `#race/${r.id}`, parts });
  }
  const totals = [{ led: String(stats.count) }, t(` race${stats.count === 1 ? '' : 's'} finished`)];
  if (stats.podiums > 0) totals.push(t(`, ${stats.podiums} on an age-group podium`));
  totals.push(t('.'));
  out.push({ key: 'totals', href: '#races', parts: totals });
  return out;
}

export function hubLines({ mi, stats, units }) {
  return [...mileLines(mi, units), ...raceLines(stats)];
}

// The sentence under the countdown: "to Harbor 10K." On race day the clock reads "Race day", so "at".
export function nextParts(r, kind) {
  const name = r.n || 'your next race';
  return [t(kind === 'today' ? 'at ' : 'to '), t(name), t(/[.!?]$/.test(name) ? '' : '.')];
}

// "Sat, Dec 12, 8:00 AM, Harbor City". The date and time are the ones typed, so they are read as UTC.
export function startText(r, now = new Date(), locale) {
  const day = new Date(`${r.date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  const year = day.getUTCFullYear() === now.getFullYear() ? {} : { year: 'numeric' };
  const out = [day.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', ...year, timeZone: 'UTC' })];
  if (/^\d{2}:\d{2}$/.test(r.time || '')) {
    out.push(new Date(`${r.date}T${r.time}:00Z`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).replace(/ /g, ' '));
  }
  if (r.place) out.push(r.place);
  return out.join(', ');
}
