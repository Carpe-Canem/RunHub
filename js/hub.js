// Hub: the first view, read at a glance. The countdown to the next start, the week's and the year's mileage, the
// week's days, and three rows: the last 13 weeks, the latest results and the personal records.
import { S, bus, fmt1, dayLabel } from './core.js';
import { $, h, led } from './dom.js';
import { miles } from './runs-model.js';
import { RACES_DOWN } from './races-view.js';
import { hubStats, fmtTime } from './races-model.js';
import { countdown, countdownLabel, tickAction } from './upcoming.js';
import { openAddSheet } from './add-race.js';
import { startText, NOTHING_ON, weekTile, yearTile, weekStrip, rowNotes } from './hub-model.js';
import { ziggyLines, moodCheck } from './ziggy-says.js';
import { ziggyStage } from './ziggy-stage.js';

// What Next start last drew: {id, kind}, id null for "Nothing on the calendar.", or null when it could not draw.
let shown = null;

const MILES_DOWN = 'Mileage is not available right now.';
const p2 = (n) => String(n).padStart(2, '0');
// With the year: the records can reach back years.
const dateText = (r) => new Date(`${r.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const badge = (r) => h('span', { class: 'badge', style: `--c: ${r.colour}` }, r.cls);

// Shown in place of a section whose code threw.
const down = (note) => h('p', { class: 'empty races-down' }, note);

// The countdown digits. Only these are replaced by the one-second tick.
function clockParts(cd) {
  const grp = (n, unit) => h('span', { class: 'cd-grp' }, led(p2(n)), h('span', { class: 'cd-unit' }, unit));
  // On the last day (days 0) the days group is left out, never "00 days"; the tick rebuilds the whole clock.
  if (cd.kind === 'clock') return [cd.days ? grp(cd.days, 'days') : null, grp(cd.hours, 'hrs'), grp(cd.mins, 'min'), grp(cd.secs, 'sec')].filter(Boolean);
  return [h('span', { class: 'cd-today' }, 'Race day')];
}

function setClock(el, cd) {
  el.replaceChildren(...clockParts(cd));
  const label = countdownLabel(cd);
  // The label has no seconds: it is only written when it changes, so a screen reader is not told every second.
  if (label === el.getAttribute('aria-label')) return;
  if (label) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); }
  else { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
}

const nextSection = (...kids) => h('section', { id: 'nextStart', class: 'next-start', 'aria-label': 'Next start' },
  h('p', { class: 'label' }, 'Next start'), kids);

// up: the upcoming rows, or null when reading them threw.
function nextStart(up) {
  if (!Array.isArray(up)) throw new Error('upcoming races not available');
  if (!up.length) {
    shown = { id: null, kind: null };
    return nextSection(
      h('p', { class: 'empty' }, NOTHING_ON),
      h('button', { type: 'button', class: 'btn small', 'data-focus': 'hub-add', onclick: (e) => openAddSheet(e.currentTarget) }, 'Add race'));
  }
  const r = up[0];
  const cd = countdown(r, new Date());
  const clock = h('div', { id: 'nextClock', class: 'next-clock' });
  setClock(clock, cd);
  shown = { id: r.id, kind: cd.kind };
  return nextSection(
    clock,
    h('p', { class: 'next-race' }, r.n || 'Your next race'),
    h('p', { class: 'next-when' }, startText(r)));
}

// The one-second tick: only the digits change, so focus on the hub's links and buttons stays where it is.
export function tickHub(up) {
  const el = $('nextClock');
  const act = tickAction(shown, up, new Date(), !!el);
  if (act.do === 'redraw') bus.emit('data');
  else if (act.do === 'clock') setClock(el, act.cd);
}

// t: from weekTile() or yearTile(). The meter is decoration: the line under the number says the same thing.
function tile(label, t, loading) {
  return h('div', { class: loading ? 'tile dim' : 'tile' },
    h('span', { class: 'label' }, label),
    h('p', { class: 'tile-num' }, t.unit ? `${t.value} ${t.unit}` : t.value),
    h('p', { class: t.tone ? `tile-line ${t.tone}` : 'tile-line' }, t.line),
    t.meter === null ? null : h('i', { class: 'meter', 'aria-hidden': 'true', style: `--w: ${t.meter * 100}%` }));
}

// The week's seven days, one picture to a screen reader.
function days(mi) {
  const w = weekStrip(mi);
  return h('section', { class: 'days panel' },
    h('p', { class: 'days-head label' }, h('span', null, w.range), h('span', null, w.runs)),
    h('div', { class: 'days-strip', role: 'img', 'aria-label': w.label }, w.days.map((d) => h('div', { class: d.today ? 'day today' : 'day', 'aria-hidden': 'true' },
      h('i', { class: 'day-bar', style: `--h: ${d.fill * 100}%` }),
      h('span', { class: 'day-letter' }, d.letter),
      h('span', { class: 'day-num' }, d.text)))));
}

// mi: from miles(), or null until the first sync has loaded the runs: the tiles then wait and the days are left out.
const mileage = (mi) => [
  h('div', { class: 'tiles' }, tile('This week', weekTile(mi), !mi), tile('This year', yearTile(mi), !mi)),
  mi ? days(mi) : null,
];

const rowText = (title, note) => [h('span', { class: 'row-title' }, title), h('span', { class: 'row-note' }, note)];
// A row that unfolds. kids are what it holds.
const fold = (cls, key, open, title, note, ...kids) => h('details', { class: cls, open },
  h('summary', { class: 'hub-row', 'data-focus': key }, rowText(title, note)), kids);
// A row with nothing behind it.
const still = (title, note) => h('div', { class: 'hub-row' }, rowText(title, note));

function weeks(mi, open) {
  const u = mi.unit;
  const max = Math.max(...mi.weeks, mi.weekAvg, 1);
  const bars = mi.weeks.map((v, i) => h('div', { class: `bar${i === 12 ? ' cur' : ''}`, style: `height:${Math.max(2, (v / max) * 100)}%`, title: `Week of ${dayLabel(mi.ws - (12 - i) * 7)}: ${fmt1(v)} ${u}` }));
  return fold('weeks', 'hub-weeks', open, 'Last 13 weeks', rowNotes(mi, null).weeks,
    h('div', { class: 'bars', role: 'img', 'aria-label': `Weekly distance for the last 13 weeks. This week ${fmt1(mi.week)} ${u}, 12-week average ${fmt1(mi.weekAvg)} ${u}.` },
      h('div', { class: 'avg', style: `bottom:${(mi.weekAvg / max) * 100}%`, title: `12-week average ${fmt1(mi.weekAvg)} ${u}` }),
      bars),
    h('div', { class: 'bar-axis' }, h('span', null, dayLabel(mi.ws - 12 * 7)), h('span', null, 'This week')),
    h('p', { class: 'weeks-more' }, `The dashed line is your 12-week average, ${fmt1(mi.weekAvg)} ${u}. Today ${fmt1(mi.today)} ${u}. This month ${fmt1(mi.month)} ${u}; your usual month is ${fmt1(mi.monthAvg)}.`));
}

// st: from hubStats(), or null while the race history is still loading: the rows then have nothing at the right.
function raceRows(st, recsOpen) {
  const note = rowNotes(null, st);
  const latest = st && st.count
    ? h('a', { class: 'hub-row', href: '#races', 'data-focus': 'hub-latest' }, rowText('Latest results', note.latest))
    : still('Latest results', note.latest);
  if (!st || !st.records.length) return [latest, still('Personal records', note.records)];
  return [latest, fold('recs', 'hub-recs', recsOpen, 'Personal records', note.records,
    h('ul', { class: 'rec-list' }, st.records.map((r) => h('li', null,
      h('a', { class: 'rec-row', href: `#race/${r.id}`, 'data-focus': `rec-${r.id}`, 'aria-label': `${r.cls} record, ${fmtTime(r.t)}, ${dateText(r)}` },
        badge(r),
        h('span', { class: 'rec-date' }, dateText(r)),
        h('span', { class: 'rec-time' }, fmtTime(r.t)))))))];
}

// Each section draws on its own: a throw shows that section's note and the rest of the hub still draws.
function part(draw, note) {
  try { return draw(); } catch (e) { console.error(e); return note ? down(note) : null; }
}

// Ziggy's stage, after the body: his lines are brought up to date, and the node itself is placed once and never
// taken out, so his line, his place and focus on his bubble carry over a redraw. A throw leaves him as he was.
// mi, stats, up: as ziggyLines() takes them. In the demo, ?ziggy=<mood> shows that mood with two lines and
// &fidget=<name> plays that fidget every time (hooks for the checks).
function stage(box, mi, stats, up, runsLoaded) {
  try {
    const q = S.demo ? new URLSearchParams(location.search) : null;
    const lines = (q && moodCheck(q.get('ziggy')))
      || ziggyLines({ mi, stats, up, sync: { running: !!S.syncing, runsLoaded }, now: new Date() });
    const el = ziggyStage(lines, { only: q && q.get('fidget') });
    if (el.parentNode !== box) box.append(el);
  } catch (e) { console.error(e); }
}

// cache: the cache of runs, null until the first sync has loaded the athlete. races: null until the race cache
// is loaded, or {failed: true}. up: the upcoming rows, or null when reading them threw.
export function renderHub(cache, races, up) {
  const box = $('view-hub');
  // The body is made once and only its children are replaced, so whatever stands beside it stays in the page.
  let body = box.querySelector(':scope > .hub-body');
  if (!body) { body = h('div', { class: 'hub-body' }); box.prepend(body); }
  const a = document.activeElement;
  const key = a && a.closest && a.closest('#view-hub') ? a.dataset.focus : null;
  const isOpen = (sel) => { const d = body.querySelector(sel); return !!(d && d.open); };
  const weeksOpen = isOpen('details.weeks');
  const recsOpen = isOpen('details.recs');
  let next;
  try { next = nextStart(up); } catch (e) {
    if (Array.isArray(up)) console.error(e);   // null: main.js has already logged why
    shown = null;
    next = nextSection(down('Upcoming races are not available right now.'));
  }
  // The mileage and the race numbers are each worked out once, here; a throw in either shows its own note.
  let mi = null; let miDown = false;
  if (cache) { try { mi = miles(cache); } catch (e) { console.error(e); miDown = true; } }
  let st = null; let stDown = !!(races && races.failed);
  // A first scan that has found nothing yet is still loading, not "No races yet".
  const racesLoading = !races || (races.scanning && !(races.rows && races.rows.length));
  if (!stDown && !racesLoading) { try { st = hubStats(races); } catch (e) { console.error(e); stDown = true; } }
  const side = h('div', { class: 'hub-side' },
    miDown ? down(MILES_DOWN) : part(() => mileage(mi), MILES_DOWN),
    h('div', { class: 'hub-rows' },
      mi ? part(() => weeks(mi, weeksOpen), null) : null,
      stDown ? down(RACES_DOWN) : part(() => raceRows(st, recsOpen), RACES_DOWN)));
  body.replaceChildren(h('h2', { class: 'vh' }, 'Hub'), next, side);
  stage(box, miDown ? false : mi, stDown ? false : st, up, !!cache);
  const el = key && box.querySelector(`[data-focus="${key}"]`);
  if (el) el.focus({ preventScroll: true });
}
