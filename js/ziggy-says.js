// What Ziggy says: every rule that holds gives one line {key, mood, ways}, in the order he says them. ways: one to
// three wordings of the line, each a list of parts; the stage picks which one is said (see wordsFor).
// Pure: no DOM. A part is {text} or {text, tone: 'go'}.
import { DAY, dayOf, fmt0, fmt1, plural } from './core.js';
import { fmtTime } from './races-model.js';
import { isoDay } from './upcoming.js';
import { overBy, yearDiff, timeText } from './hub-model.js';
import { graphemes } from './ziggy-moves.js';

const NAME_MAX = 28;
// The most graphemes any wording may take with the worst inputs: one row of the bubble (tested, with the stage's look).
export const WORDINGS_CAP = 52;

const t = (text, tone) => (tone ? { text, tone } : { text });
// Each way is a list of parts (strings or t(text, tone)).
const line = (key, mood, ...ways) => ({ key, mood, ways: ways.map((way) => way.map((p) => (typeof p === 'string' ? t(p) : p))) });

// The wording turn n says: the line in the shape lengthOf and splitParts take.
export const wordsFor = (l, n) => ({ key: l.key, mood: l.mood, parts: l.ways[n % l.ways.length] });
// One decimal, without a trailing ".0": "5 miles", "22.4 miles".
const dist = (x) => fmt1(x).replace(/\.0$/, '');
// Cut by whole character, so the cut never splits one in two.
const shortName = (n) => {
  const chars = graphemes(n);
  return chars.length > NAME_MAX ? `${chars.slice(0, NAME_MAX).join('').trimEnd()}…` : n;
};
// A name that ends its own sentence, or is cut with an ellipsis, gets no second stop.
// The same for a name that ends the line on a bang.
const bang = (text) => (/[.!?…]$/.test(text) ? '' : '!');

// Whole days from one YYYY-MM-DD to another.
const daysFrom = (from, to) => dayOf(to) - dayOf(from);

// mi: from miles(), null while the runs load, false when working it out threw. stats: from hubStats(), null
// while the race history loads, false when it failed. up: the upcoming rows, or null when reading them threw.
// sync: {running, runsLoaded}.
export function ziggyLines({ mi, stats, up, sync, now, locale }) {
  const quiet = [line('quiet', 'asleep', ['All quiet. Nap time.'], ['All quiet… zzz.'], ['All quiet. Wake me for a run.'])];
  if (mi === false && stats === false) return quiet;
  const out = [];
  const add = (...args) => out.push(line(...args));
  const today = isoDay(now);
  const unit = mi && mi.unit === 'km' ? 'km' : 'miles';
  const [next, second] = up || [];
  const away = next ? daysFrom(today, next.date) : NaN;
  const last = stats && stats.latest ? stats.latest[0] : null;
  const age = last ? daysFrom(last.date, today) : NaN;
  // A race with no name is called what the hub calls it.
  const nextName = next ? shortName(next.n || 'Your next race') : '';
  const lastName = last ? shortName(last.n || 'A race') : '';
  const isRecord = !!(last && last.record && last.t > 0 && age >= 0 && age <= 14);
  const over = mi ? overBy(mi) : 0;
  const diff = mi ? yearDiff(mi) : null;
  // The last two days of the week with under 60% of the usual run.
  const weekLow = !!mi && mi.dow >= 5 && mi.weekAvg > 0 && mi.week < 0.6 * mi.weekAvg;

  if (sync.running && !sync.runsLoaded && mi !== false) {
    add('fetching', 'eager', ['Fetch! Getting your runs from Strava!'], ['Fetching your runs from Strava! Good boy!'],
      ['Hang on, fetching your runs from Strava!']);
  }
  if (away === 0) {
    const time = timeText(next, locale);
    const end = time ? '' : bang(nextName);
    const at = time ? `${nextName} at ${time}!` : `${nextName}${end}`;
    const comma = time ? `${nextName}, ${time}!` : `${nextName}${end}`;
    add('raceday', 'thrilled', [`Race day! ${at}`], [`Race day!! ${comma}`], [`It's today! ${comma}`]);
  }
  if (isRecord) {
    const rt = t(`${fmtTime(last.t)}!`, 'go');
    add('record', 'thrilled', [rt, ` New ${last.cls} record! Good human!`], [rt, ` Your best ${last.cls} ever! Zoomies!`],
      [rt, ` A ${last.cls} record! So proud!`]);
  }
  if (away >= 1 && away <= 7) {
    const weekday = new Date(dayOf(next.date) * DAY).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
    add('soon', 'eager', [`${nextName} is on ${weekday}! Ooh!`], [`${nextName}: ${weekday}! So soon!`]);
  }
  if (over > 0) {
    const wk = `${dist(mi.week)} ${unit}`;
    const o = () => t(`${dist(over)} over`, 'go');
    add('weekover', 'happy', [`${wk} this week, `, o(), ' your usual! Wow!'], [o(), ` your usual this week! ${wk}!`],
      [`${wk} this week! `, o(), ' usual. Tail wags!']);
  }
  if (!isRecord && age >= 0 && age <= 30) {
    const rt = last.t > 0 ? fmtTime(last.t) : '';
    const e = rt ? '!' : bang(lastName);
    add('latest', 'happy', [rt ? `${lastName} in ${rt}! Good run!` : `${lastName}${e} Good run!`],
      [rt ? `${lastName}, ${rt}! You flew!` : `${lastName}${e} You flew!`], [rt ? `${lastName}: ${rt}! Proud pup!` : `${lastName}${e} Proud pup!`]);
  }
  if (diff > 0) {
    const ytd = `${fmt0(mi.ytd)} ${unit}`;
    const a = () => t(`${fmt0(diff)} ahead`, 'go');
    add('yearahead', 'happy', [`${ytd} this year! `, a(), ' of last year!'], [a(), ` of last year! ${ytd} so far!`],
      ["We're ", a(), ` of last year! ${ytd}!`]);
  }
  if (weekLow) {
    const wk = `${dist(mi.week)} ${unit}`;
    const usual = dist(mi.weekAvg);
    add('weeklow', 'worried', [`${wk} so far this week. Usually ${usual}. Walkies?`], [`${wk} this week. We usually do ${usual}. Run soon?`],
      [`${wk} this week, ${usual} usually. I'm ready!`]);
  }
  if (diff < 0) {
    const behind = `${fmt0(-diff)} ${unit} behind this date last year.`;
    add('yearbehind', 'worried', [`${behind} Let's go!`], [`${behind} Catch up?`], [`${behind} Sniff…`]);
  }
  if (mi && !weekLow && mi.runsToday === 0 && +fmt1(mi.week - mi.weekAvg) < 0) {
    add('norun', 'eager', ['No run yet today! Walkies? Please?'], ["No run yet today. I'll get my leash!"], ["No run yet today! Shoes on? Let's go!"]);
  }
  if (second) {
    const day = new Date(dayOf(second.date) * DAY).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const name = shortName(second.n || 'A race');
    add('after', 'curious', [`And then? ${name}, ${day}!`], [`Then: ${name}, ${day}! Ooh?`], [`After that? ${name}, ${day}!`]);
  }
  if (stats && stats.count > 0) {
    const races = (word) => plural(stats.count, word);
    const pod = stats.podiums;
    if (pod > 0) {
      add('totals', 'curious', [`${races('race')} finished! ${pod} on an age-group podium!`],
        [`${races('race')} done, ${plural(pod, 'age-group podium')}! Wow!`], [`${races('race')} finished! ${plural(pod, 'age-group podium')}, too!`]);
    } else {
      add('totals', 'curious', [`${races('race')} finished!`], [`${races('race')} done! Wow!`], [`${races('race')} finished! Tail wags!`]);
    }
  }
  return out.length ? out : quiet;
}

const MOODS = ['happy', 'thrilled', 'eager', 'curious', 'worried', 'asleep'];

// The two lines of the check hook, for looking at one mood; null for a mood he does not have.
export function moodCheck(mood) {
  if (!MOODS.includes(mood)) return null;
  return [line('check-1', mood, [`Mood check: ${mood}.`]), line('check-2', mood, ['And a second line.'])];
}
