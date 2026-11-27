// What the hub shows: the two mileage tiles, the week's strip, the notes on the rows and the next start's line.
// Pure: no DOM. mi is from miles() in runs-model.js, stats from hubStats() in races-model.js.
import { DAY, fmt0, fmt1, plural } from './core.js';
import { fmtTime } from './races-model.js';

export const NOTHING_ON = 'Nothing on the calendar.';

// The two comparisons, shared with Ziggy's lines so the tiles and the bubble never disagree.
// How far the week is over the usual, as shown (one decimal): 0 or less is not over.
export const overBy = (mi) => (mi.weekAvg > 0 ? +fmt1(mi.week - mi.weekAvg) : 0);
// Whole units ahead of this date last year (below 0: behind), or null without last year's runs.
export const yearDiff = (mi) => (mi.hasLastYear ? Math.round(mi.ytd) - Math.round(mi.lytd) : null);

const share = (x, of) => Math.min(1, Math.max(0, x / of));
const loading = () => ({ value: '–', unit: '', line: '', tone: null, meter: null });

export function weekTile(mi) {
  if (!mi) return loading();
  const over = overBy(mi);
  const line = over > 0 ? `${fmt1(over)} over your usual` : mi.weekAvg > 0 ? `of your usual ${fmt1(mi.weekAvg)}` : '';
  return { value: fmt1(mi.week), unit: mi.unit, line, tone: over > 0 ? 'go' : null, meter: mi.weekAvg > 0 ? share(mi.week, mi.weekAvg) : null };
}

export function yearTile(mi) {
  if (!mi) return loading();
  const d = yearDiff(mi);
  const tile = { value: fmt0(mi.ytd), unit: mi.unit, line: '', tone: null, meter: null };
  if (d === null) return tile;
  if (d > 0) Object.assign(tile, { line: `${fmt0(d)} ahead of last year`, tone: 'go' });
  else if (d < 0) Object.assign(tile, { line: `${fmt0(-d)} behind last year`, tone: 'slow' });
  else tile.line = 'level with last year';
  // Nothing by this date last year: any distance this year fills the meter, none leaves no meter.
  tile.meter = mi.lytd > 0 ? share(mi.ytd, mi.lytd) : mi.ytd > 0 ? 1 : null;
  return tile;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// The week's seven days, Monday first. A past day without a run shows a dash; today and later show nothing.
export function weekStrip(mi, locale) {
  const date = (i) => new Date((mi.ws + i) * DAY);
  const range = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).formatRange(date(0), date(6));
  const most = Math.max(...mi.days);
  const days = mi.days.map((v, i) => ({ letter: LETTERS[i], text: v > 0 ? fmt1(v) : i < mi.dow ? '–' : '', fill: most > 0 ? share(v, most) : 0, today: i === mi.dow }));
  const ran = mi.days.map((v, i) => (v > 0 ? `${date(i).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })} ${fmt1(v)} ${mi.unit}` : null)).filter(Boolean);
  return { range, runs: mi.runsWeek > 0 ? plural(mi.runsWeek, 'run') : '', days, label: `This week: ${ran.length ? ran.join(', ') : 'no runs yet'}` };
}

// The text at the right of each row. Empty while what it comes from is still loading.
export function rowNotes(mi, stats) {
  const out = { weeks: mi ? `avg ${fmt1(mi.weekAvg)} ${mi.unit}` : '', latest: '', records: '' };
  if (!stats) return out;
  if (!stats.count) return { ...out, latest: 'No races yet', records: 'No races yet' };
  const r = stats.latest[0];
  if (r) out.latest = [r.t > 0 ? fmtTime(r.t) : null, r.n || 'Race'].filter(Boolean).join(', ');
  out.records = stats.records.length ? plural(stats.records.length, 'distance') : 'No records yet';
  return out;
}

// "8:00 AM", or '' without a valid start time.
export function timeText(r, locale) {
  if (!/^\d{2}:\d{2}$/.test(r.time || '')) return '';
  return new Date(`1970-01-01T${r.time}:00Z`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).replace(/ /g, ' ');
}

// "Sat, Dec 12, 8:00 AM, Harbor City". The date and time are the ones typed, so they are read as UTC.
export function startText(r, now = new Date(), locale) {
  const day = new Date(`${r.date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  const year = day.getUTCFullYear() === now.getFullYear() ? {} : { year: 'numeric' };
  const out = [day.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', ...year, timeZone: 'UTC' })];
  const time = timeText(r, locale);
  if (time) out.push(time);
  if (r.place) out.push(r.place);
  return out.join(', ');
}
