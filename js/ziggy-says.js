// What Ziggy says: every rule that holds gives one line {key, mood, parts}, in the order he says them.
// Pure: no DOM. A part is {text} or {text, tone: 'go'}.
import { DAY, dayOf, fmt0, fmt1, plural } from './core.js';
import { fmtTime } from './races-model.js';
import { isoDay } from './upcoming.js';
import { overBy, yearDiff, timeText } from './hub-model.js';

const NAME_MAX = 28;

const t = (text, tone) => (tone ? { text, tone } : { text });
const line = (key, mood, ...parts) => ({ key, mood, parts: parts.map((p) => (typeof p === 'string' ? t(p) : p)) });
// One decimal, without a trailing ".0": "5 miles", "22.4 miles".
const dist = (x) => fmt1(x).replace(/\.0$/, '');
// Cut by character, so the cut never splits one in two.
const shortName = (n) => {
  const chars = [...n];
  return chars.length > NAME_MAX ? `${chars.slice(0, NAME_MAX).join('').trimEnd()}…` : n;
};
// A name that ends its own sentence, or is cut with an ellipsis, gets no second stop.
const stop = (text) => (/[.!?…]$/.test(text) ? '' : '.');
const sentence = (text) => `${text}${stop(text)}`;

// Whole days from one YYYY-MM-DD to another.
const daysFrom = (from, to) => dayOf(to) - dayOf(from);

// mi: from miles(), null while the runs load, false when working it out threw. stats: from hubStats(), null
// while the race history loads, false when it failed. up: the upcoming rows, or null when reading them threw.
// sync: {running, runsLoaded}.
export function ziggyLines({ mi, stats, up, sync, now, locale }) {
  const quiet = [line('quiet', 'asleep', 'All quiet.')];
  if (mi === false && stats === false) return quiet;
  const out = [];
  const add = (...args) => out.push(line(...args));
  const today = isoDay(now);
  const unit = mi && mi.unit === 'km' ? 'km' : 'miles';
  const [next, second] = up || [];
  const away = next ? daysFrom(today, next.date) : NaN;
  const last = stats && stats.latest ? stats.latest[0] : null;
  const age = last ? daysFrom(last.date, today) : NaN;
  const lastName = last ? shortName(last.n || 'A race') : '';
  const isRecord = !!(last && last.record && last.t > 0 && age >= 0 && age <= 14);
  const over = mi ? overBy(mi) : 0;
  const diff = mi ? yearDiff(mi) : null;
  // The last two days of the week with under 60% of the usual run.
  const weekLow = !!mi && mi.dow >= 5 && mi.weekAvg > 0 && mi.week < 0.6 * mi.weekAvg;

  if (sync.running && !sync.runsLoaded && mi !== false) add('fetching', 'eager', 'Fetching your runs from Strava.');
  if (away === 0) {
    const name = shortName(next.n);
    const time = timeText(next, locale);
    add('raceday', 'thrilled', `Race day. ${sentence(time ? `${name} at ${time}` : name)}`);
  }
  if (isRecord) add('record', 'thrilled', t(`${fmtTime(last.t)}!`, 'go'), ` A new ${last.cls} record.`);
  if (away >= 1 && away <= 7) {
    const weekday = new Date(dayOf(next.date) * DAY).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
    add('soon', 'eager', `${shortName(next.n)} is on ${weekday}.`);
  }
  if (over > 0) add('weekover', 'happy', `${dist(mi.week)} ${unit} this week, `, t(`${dist(over)} over`, 'go'), ' your usual.');
  if (!isRecord && age >= 0 && age <= 30) add('latest', 'happy', sentence(last.t > 0 ? `${lastName} in ${fmtTime(last.t)}` : lastName));
  if (diff > 0) add('yearahead', 'happy', `${fmt0(mi.ytd)} ${unit} this year, `, t(`${fmt0(diff)} ahead`, 'go'), ' of last year.');
  if (weekLow) add('weeklow', 'worried', `${dist(mi.week)} ${unit} so far this week. Your usual is ${dist(mi.weekAvg)}.`);
  if (diff < 0) add('yearbehind', 'worried', `${fmt0(-diff)} ${unit} behind this date last year.`);
  if (mi && !weekLow && mi.runsToday === 0 && +fmt1(mi.week - mi.weekAvg) < 0) add('norun', 'eager', 'No run yet today. Shall we?');
  if (second) {
    const day = new Date(dayOf(second.date) * DAY).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    add('after', 'curious', `After that: ${shortName(second.n)}, ${day}.`);
  }
  if (stats && stats.count > 0) {
    const podiums = stats.podiums > 0 ? `, ${stats.podiums} on an age-group podium` : '';
    add('totals', 'curious', `${plural(stats.count, 'race')} finished${podiums}.`);
  }
  return out.length ? out : quiet;
}

const MOODS = ['happy', 'thrilled', 'eager', 'curious', 'worried', 'asleep'];

// The two lines of the check hook, for looking at one mood; null for a mood he does not have.
export function moodCheck(mood) {
  if (!MOODS.includes(mood)) return null;
  return [line('check-1', mood, `Mood check: ${mood}.`), line('check-2', mood, 'And a second line.')];
}
