// Hub: the first view. The countdown to the next start, then a few sentences (the week, the year, the last race,
// the totals), the 13-week bars folded away, the latest results and the records.
import { bus, fmt1, dayLabel } from './core.js';
import { $, h, led } from './dom.js';
import { miles } from './runs-model.js';
import { RACES_DOWN } from './races-view.js';
import { hubStats, fmtTime } from './races-model.js';
import { routeTile } from './race-draw.js';
import { countdown, countdownLabel, tickAction } from './upcoming.js';
import { openAddSheet } from './add-race.js';
import { mileLines, raceLines, nextParts, startText, NOTHING_ON } from './hub-lines.js';
import { withZiggy } from './ziggy.js';

// What Next start last drew: {id, kind}, id null for "Nothing on the calendar.", or null when it could not draw.
let shown = null;

const p2 = (n) => String(n).padStart(2, '0');
// With the year: the strip and the records can reach back years.
const dateText = (r) => new Date(`${r.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const badge = (r) => h('span', { class: 'badge', style: `--c: ${r.colour}` }, r.cls);

// A part of a sentence from hub-lines.js: clock digits, a toned phrase or plain text.
const partNode = (p) => (p.led != null ? led(p.led) : p.tone ? h('span', { class: p.tone }, p.text) : p.text);
// Lines with a link are one link from first word to last, so the whole sentence is the target.
function sentence(line, dim) {
  const kids = line.parts.map(partNode);
  return h('p', { class: dim ? 'say dim' : 'say' }, line.href ? h('a', { href: line.href, 'data-focus': `hub-${line.key}` }, kids) : kids);
}
// Shown in place of a section whose code threw: Ziggy naps beside it.
const down = (note) => withZiggy('nap', h('p', { class: 'empty races-down' }, note));

// The countdown digits. Only these are replaced by the one-second tick.
function clockParts(cd) {
  const grp = (n, unit) => h('span', { class: 'cd-grp' }, led(p2(n), { ghost: true }), h('span', { class: 'cd-unit' }, unit));
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

// up: the upcoming rows, or null when reading them threw.
function nextStart(up) {
  if (!Array.isArray(up)) throw new Error('upcoming races not available');
  if (!up.length) {
    shown = { id: null, kind: null };
    return h('section', { id: 'nextStart', class: 'next-start', 'aria-label': 'Next start' },
      withZiggy('sit', h('p', { class: 'say dim' }, NOTHING_ON), 3),
      h('button', { type: 'button', class: 'btn small', 'data-focus': 'hub-add', onclick: (e) => openAddSheet(e.currentTarget) }, 'Add race'));
  }
  const r = up[0];
  const cd = countdown(r, new Date());
  const clock = h('div', { id: 'nextClock', class: 'next-clock' });
  setClock(clock, cd);
  shown = { id: r.id, kind: cd.kind };
  return h('section', { id: 'nextStart', class: 'next-start', 'aria-label': 'Next start' },
    clock,
    h('p', { class: 'say next-name' }, nextParts(r, cd.kind).map(partNode)),
    h('p', { class: 'say-close' }, startText(r)));
}

// The one-second tick: only the digits change, so focus on the hub's links and buttons stays where it is.
export function tickHub(up) {
  const el = $('nextClock');
  const act = tickAction(shown, up, new Date(), !!el);
  if (act.do === 'redraw') bus.emit('data');
  else if (act.do === 'clock') setClock(el, act.cd);
}

// mi: from miles(), or null until the first sync has loaded the runs.
function mileage(mi) {
  return h('section', { class: 'hub-say', 'aria-label': 'Mileage' }, mileLines(mi).map((l) => sentence(l, !mi)));
}

// rm: the race model, null until it is loaded. st: its hub numbers. Ziggy sits by "No races yet." unless he is
// already sitting by an empty calendar just above.
function racesSay(rm, st, dogFree) {
  const loading = !rm || (rm.scanning && !rm.rows.length);
  const lines = raceLines(loading ? null : st);
  const quiet = loading || !st.count;
  const nodes = lines.map((l) => (l.key === 'none' && dogFree ? withZiggy('sit', sentence(l, true), 3) : sentence(l, quiet)));
  return h('section', { class: 'hub-say', 'aria-label': 'Races' }, nodes,
    quiet && !loading ? h('p', { class: 'say-close' }, 'Runs you mark as Race in Strava appear here.') : null);
}

function weeks(mi, open) {
  const u = mi.unit;
  const max = Math.max(...mi.weeks, mi.weekAvg, 1);
  const bars = mi.weeks.map((v, i) => h('div', { class: `bar${i === 12 ? ' cur' : ''}`, style: `height:${Math.max(2, (v / max) * 100)}%`, title: `Week of ${dayLabel(mi.ws - (12 - i) * 7)}: ${fmt1(v)} ${u}` }));
  return h('details', { class: 'weeks', open },
    h('summary', { 'data-focus': 'hub-weeks' }, 'Last 13 weeks'),
    h('div', { class: 'bars', role: 'img', 'aria-label': `Weekly distance for the last 13 weeks. This week ${fmt1(mi.week)} ${u}, 12-week average ${fmt1(mi.weekAvg)} ${u}.` },
      h('div', { class: 'avg', style: `bottom:${(mi.weekAvg / max) * 100}%`, title: `12-week average ${fmt1(mi.weekAvg)} ${u}` }),
      bars),
    h('div', { class: 'bar-axis' }, h('span', null, dayLabel(mi.ws - 12 * 7)), h('span', null, 'This week')),
    h('p', { class: 'weeks-more' }, `The dashed line is your 12-week average, ${fmt1(mi.weekAvg)} ${u}. Today ${fmt1(mi.today)} ${u}. This month ${fmt1(mi.month)} ${u}; your usual month is ${fmt1(mi.monthAvg)}.`));
}

function latest(st) {
  if (!st || !st.latest.length) return null;
  const list = st.latest;
  return h('section', { class: 'hub-sec', 'aria-label': 'Latest results' },
    h('h3', { class: 'sub-title' }, 'Latest results'),
    h('ul', { class: 'strip' }, list.map((r) => h('li', null,
      h('a', { class: 'strip-card', href: `#race/${r.id}`, 'data-focus': `latest-${r.id}`, 'aria-label': `${r.n || 'Race'}, ${fmtTime(r.t)}, ${dateText(r)}` },
        routeTile(r.pts, r.colour, 72),
        h('span', { class: 'sc-time' }, led(fmtTime(r.t))),
        h('span', { class: 'sc-meta' }, badge(r), ' ', dateText(r)))))));
}

function records(st) {
  if (!st || !st.records.length) return null;
  const list = st.records;
  return h('section', { class: 'hub-sec', 'aria-label': 'Personal records' },
    h('h3', { class: 'sub-title' }, 'Personal records'),
    h('ul', { class: 'rec-grid' }, list.map((r) => h('li', null,
      h('a', { class: 'rec-tile', href: `#race/${r.id}`, 'data-focus': `rec-${r.id}`, 'aria-label': `${r.cls} record, ${fmtTime(r.t)}, ${dateText(r)}` },
        badge(r),
        h('span', { class: 'rec-time' }, led(fmtTime(r.t))),
        h('span', { class: 'rec-date' }, dateText(r)))))));
}

// Each section draws on its own: a throw shows that section's note and the rest of the hub still draws.
function part(draw, note) {
  try { return draw(); } catch (e) { console.error(e); return note ? down(note) : null; }
}

// cache: the cache of runs, null until the first sync has loaded the athlete. races: null until the race cache
// is loaded, or {failed: true}. up: the upcoming rows, or null when reading them threw.
export function renderHub(cache, races, up) {
  const box = $('view-hub');
  const a = document.activeElement;
  const key = a && a.closest && a.closest('#view-hub') ? a.dataset.focus : null;
  const oldStrip = box.querySelector('.strip');
  const left = oldStrip ? oldStrip.scrollLeft : 0;
  const oldWeeks = box.querySelector('details.weeks');
  const weeksOpen = !!(oldWeeks && oldWeeks.open);
  let next;
  try { next = nextStart(up); } catch (e) {
    if (Array.isArray(up)) console.error(e);   // null: main.js has already logged why
    shown = null;
    next = h('section', { id: 'nextStart', class: 'next-start', 'aria-label': 'Next start' }, down('Upcoming races are not available right now.'));
  }
  // The mileage and the race numbers are each worked out once, here; a throw in either shows its own note.
  let mi = null; let miDown = false;
  if (cache) { try { mi = miles(cache); } catch (e) { console.error(e); miDown = true; } }
  let st = null; let stDown = !!(races && races.failed);
  if (races && !races.failed) { try { st = hubStats(races); } catch (e) { console.error(e); stDown = true; } }
  const dogFree = !(shown && shown.id === null);
  box.replaceChildren(...[
    h('h2', { class: 'vh' }, 'Hub'),
    next,
    miDown ? down('Mileage is not available right now.') : part(() => mileage(mi), 'Mileage is not available right now.'),
    stDown ? down(RACES_DOWN) : part(() => racesSay(races, st, dogFree), RACES_DOWN),
    mi ? part(() => weeks(mi, weeksOpen), null) : null,
    part(() => latest(st), 'Latest results are not available right now.'),
    part(() => records(st), 'Personal records are not available right now.'),
    h('p', null, h('a', { class: 'textlink', href: '#data', 'data-focus': 'hub-data' }, 'Data and connection')),
  ].filter(Boolean));
  const el = key && box.querySelector(`[data-focus="${key}"]`);
  if (el) el.focus({ preventScroll: true });
  const strip = box.querySelector('.strip');
  if (strip && left) strip.scrollLeft = left;
}
