// Hub: the first view. Next start, races and Legends cards, the latest results and the records.
import { bus, units, fmt0, plural, UNIT_M } from './core.js';
import { $, h, led } from './dom.js';
import { riskSummary } from './legends-model.js';
import { racesDown } from './races-view.js';
import { hubStats, fmtTime } from './races-model.js';
import { routeTile } from './race-draw.js';
import { when } from './race-view.js';
import { countdown, countdownLabel, tickAction } from './upcoming.js';
import { openAddSheet } from './add-race.js';

// What Next start last drew: {id, kind}, id null for "Nothing coming up.", or null when it could not draw.
let shown = null;

const p2 = (n) => String(n).padStart(2, '0');
// With the year: the strip and the records can reach back years.
const dateText = (r) => new Date(`${r.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const badge = (r) => h('span', { class: 'badge', style: `--c: ${r.colour}` }, r.cls);

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
  const label = h('span', { class: 'label' }, 'Next start');
  if (!up.length) {
    shown = { id: null, kind: null };
    return h('section', { id: 'nextStart', class: 'card next-start', 'aria-label': 'Next start' }, label,
      h('p', { class: 'empty' }, 'Nothing coming up.'),
      h('button', { type: 'button', class: 'btn small', 'data-focus': 'hub-add', onclick: (e) => openAddSheet(e.currentTarget) }, 'Add race'));
  }
  const r = up[0];
  const cd = countdown(r, new Date());
  const clock = h('div', { id: 'nextClock', class: 'next-clock' });
  setClock(clock, cd);
  shown = { id: r.id, kind: cd.kind };
  return h('section', { id: 'nextStart', class: 'card next-start', 'aria-label': 'Next start' }, label,
    h('strong', { class: 'next-name' }, r.n),
    h('p', { class: 'next-when' }, badge(r), ' ', when(r), r.place ? ` · ${r.place}` : null),
    clock);
}

// The one-second tick: only the digits change, so focus on the hub's links and buttons stays where it is.
export function tickHub(up) {
  const el = $('nextClock');
  const act = tickAction(shown, up, new Date(), !!el);
  if (act.do === 'redraw') bus.emit('data');
  else if (act.do === 'clock') setClock(el, act.cd);
}

// rm.failed: building the race model threw. Any throw here shows the note, and the other cards still draw.
function racesCard(rm) {
  try { if (!(rm && rm.failed)) return racesCardFor(rm); } catch (e) { console.error(e); }
  return h('a', { class: 'rowlink', href: '#races' },
    h('span', { class: 'rowlink-text' }, h('strong', null, 'Races'), racesDown()));
}

function racesCardFor(rm) {
  const loading = !rm || (rm.scanning && !rm.rows.length);
  const st = loading ? null : hubStats(rm);
  const unit = units();
  const sub = loading ? 'Loading your race history'
    : st.count ? `${plural(st.podiums, 'age-group podium')} · ${fmt0(st.metres / UNIT_M[unit])} ${unit} raced` : 'No races yet';
  return h('a', { class: 'rowlink', href: '#races', 'data-focus': 'hub-races' },
    h('span', { class: 'rowlink-text' },
      h('strong', null, 'Races'),
      h('span', { class: 'label' }, 'Races finished'),
      h('span', { class: 'sub' }, sub)),
    h('span', { class: 'rowlink-num' }, led(loading ? '--' : p2(st.count), { ghost: true })));
}

function legendsCard(model) {
  const rs = model ? riskSummary(model) : { count: 0, sub: 'Loading your runs from Strava', loading: true };
  const num = rs.loading ? '--' : p2(rs.count);
  return h('a', { class: 'rowlink', href: '#legends', 'data-focus': 'hub-legends' },
    h('span', { class: 'rowlink-text' },
      h('strong', null, 'Local Legends'),
      h('span', { class: 'label' }, 'Titles at risk this week'),
      h('span', { class: 'sub' }, rs.sub)),
    h('span', { class: 'rowlink-num' }, led(num, { ghost: true })));
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
  try { return draw(); } catch (e) { console.error(e); return note ? h('p', { class: 'empty races-down' }, note) : null; }
}

// legends: null until the first sync has loaded the athlete. races: null until the race cache is loaded, or
// {failed: true}. up: the upcoming rows, or null when reading them threw.
export function renderHub(legends, races, up) {
  const box = $('view-hub');
  const a = document.activeElement;
  const key = a && a.closest && a.closest('#view-hub') ? a.dataset.focus : null;
  const oldStrip = box.querySelector('.strip');
  const left = oldStrip ? oldStrip.scrollLeft : 0;
  let next;
  try { next = nextStart(up); } catch (e) {
    if (Array.isArray(up)) console.error(e);   // null: main.js has already logged why
    shown = null;
    next = h('section', { id: 'nextStart', class: 'card next-start', 'aria-label': 'Next start' },
      h('span', { class: 'label' }, 'Next start'), h('p', { class: 'empty' }, 'Upcoming races are not available right now.'));
  }
  const st = part(() => (races && !races.failed && races.rows ? hubStats(races) : null), null);
  box.replaceChildren(...[
    h('h2', { class: 'hub-title' }, 'Run Hub'),
    next,
    h('div', { class: 'hub-rows' },
      racesCard(races),
      part(() => legendsCard(legends), 'Local Legends are not available right now.')),
    part(() => latest(st), 'Latest results are not available right now.'),
    part(() => records(st), 'Personal records are not available right now.'),
    h('p', null, h('a', { class: 'textlink', href: '#data', 'data-focus': 'hub-data' }, 'Data and connection')),
  ].filter(Boolean));
  const el = key && box.querySelector(`[data-focus="${key}"]`);
  if (el) el.focus({ preventScroll: true });
  const strip = box.querySelector('.strip');
  if (strip && left) strip.scrollLeft = left;
}
