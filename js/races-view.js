// Races: filter chips, pace trend and the finished list (rows or route tiles).
import { K, store, units, dayLabel, DAY, bus } from './core.js';
import { $, h, led } from './dom.js';
import { chips, paceTrend, fmtTime, fmtPace } from './races-model.js';
import { classColour } from './race-rules.js';
import { fmtTemp, skyText } from './weather.js';
import { routeTile, paceChart } from './race-draw.js';
import { current } from './router.js';
import { daysText, isoDay, dayChanged } from './upcoming.js';
import { removeHand, upcomingRows } from './upcoming-sync.js';
import { openAddSheet } from './add-race.js';

const FIRST = 10;
let expanded = false;   // "Show all" pressed; reset when the filter changes

function readUi() {
  const u = store.get(K.ui) || {};
  return { mode: u.mode === 'routes' ? 'routes' : 'rows', filter: typeof u.filter === 'string' ? u.filter : 'all' };
}
function saveUi(patch) { store.set(K.ui, { ...readUi(), ...patch }); }

// Shown in place of any race area whose code threw, so the rest of the page still works.
export const RACES_DOWN = 'Races are not available right now.';
export const racesDown = () => h('p', { class: 'empty races-down' }, RACES_DOWN);

// Redraw, then put focus back on the control that was used (the redraw replaces it).
function redraw(model, focusKey) {
  try { renderRaces(model, upcomingRows()); } catch (e) { console.error(e); $('view-races').replaceChildren(racesDown()); return; }
  const el = focusKey && document.querySelector(`#view-races [data-focus="${focusKey}"]`);
  if (el) el.focus();
}

const dateText = (r) => dayLabel(Date.parse(`${r.date}T00:00:00Z`) / DAY);
const badge = (r) => h('span', { class: 'badge', style: `--c: ${r.colour}` }, r.cls);

// The race open beside the list on wide screens is marked as the current one.
const open = (r) => { const c = current(); return c.view === 'race' && c.id === r.id ? 'page' : null; };
const shortTag = (r) => (r.short ? h('span', { class: 'tag' }, 'Short') : null);

const wxText = (r, unit) => (r.wx ? ` · ${[fmtTemp(r.wx.t, unit), skyText(r.wx.c)].filter(Boolean).join(' ')}` : null);

function row(r, unit) {
  return h('li', null, h('a', { class: 'race-row', href: `#race/${r.id}`, 'data-focus': `race-${r.id}`, 'aria-current': open(r) },
    routeTile(r.pts, r.colour, 44),
    h('span', { class: 'rr-main' },
      h('strong', { class: 'rr-name' }, r.n || 'Race'),
      h('span', { class: 'rr-meta' }, badge(r), ' ', dateText(r), wxText(r, unit), r.record ? h('span', { class: 'rr-pr' }, ' · Record') : null, r.short ? ' ' : null, shortTag(r))),
    h('span', { class: 'rr-time' }, led(fmtTime(r.t)), h('span', { class: 'rr-pace' }, fmtPace(r.pace, unit)))));
}

function routeCard(r) {
  return h('li', null, h('a', { class: 'route-card', href: `#race/${r.id}`, 'data-focus': `race-${r.id}`, 'aria-current': open(r) },
    routeTile(r.pts, r.colour, 120),
    h('strong', { class: 'rc-name' }, r.n || 'Race'),
    h('span', { class: 'rc-meta' }, badge(r), ' ', dateText(r), r.short ? ' ' : null, shortTag(r)),
    h('span', { class: 'rc-time' }, led(fmtTime(r.t)))));
}

function trend(model, filter, list, unit) {
  if (filter === 'other') return null;
  const cls = filter === 'all' ? (list[1] && list[1].key !== 'other' ? list[1].key : null) : filter;
  if (!cls) return null;
  const pts = paceTrend(model, cls);
  const label = `Pace trend · ${cls}`;
  return h('div', { class: 'card trend' },
    h('h3', { class: 'chart-title' }, label),
    pts.length < 2 ? h('p', { class: 'empty' }, 'Not enough races for a trend yet')
      : paceChart(pts, unit, { colour: classColour(cls), label }));
}

export const UP_EMPTY = 'Nothing coming up. Add a race here, or list races in your Strava bio, one per line, as MM/DD/YYYY and the name.';

function removeRace(r) {
  if (!window.confirm(`Remove “${r.n}” from Up next?`)) return;
  if (!removeHand(r.id)) window.alert("This browser couldn't save the change, so the race is still listed.");
  bus.emit('data');
  const add = document.querySelector('#view-races [data-focus="up-add"]');
  if (add) add.focus();
}

function upRow(r, today) {
  const meta = [dateText(r), r.time, r.place].filter(Boolean).join(' · ');
  return h('li', { class: 'up-row', tabindex: '-1', 'data-focus': `up-${r.id}` },
    h('span', { class: 'up-main' },
      h('strong', { class: 'up-name' }, r.n),
      h('span', { class: 'up-meta' }, badge(r), ' ', meta),
      r.src === 'bio' ? h('span', { class: 'up-src' }, 'From your Strava bio') : null),
    h('span', { class: 'up-side' },
      h('span', { class: 'up-days' }, daysText(r, today)),
      r.src === 'bio' ? null : h('button', {
        type: 'button', class: 'btn small', 'aria-label': `Remove ${r.n}`, 'data-focus': `up-remove-${r.id}`, onclick: () => removeRace(r),
      }, 'Remove')));
}

// Upcoming races: from the bio and added by hand. Not affected by the distance filter or the race model.
export function upNext(up) {
  const today = isoDay(new Date());
  return h('section', { class: 'up-next', 'aria-label': 'Up next', 'data-day': today },
    h('div', { class: 'finished-head' },
      h('h3', { class: 'sub-title' }, 'Up next'),
      h('button', { type: 'button', class: 'btn small', 'data-focus': 'up-add', onclick: (e) => openAddSheet(e.currentTarget) }, 'Add race')),
    up.length ? h('ul', { class: 'up-list' }, up.map((r) => upRow(r, today))) : h('p', { class: 'empty' }, UP_EMPTY));
}

// The 30-second tick on Races: after midnight the days text is old and a race may have dropped off. Only Up next
// is replaced, so the rest of the page, the open race and the scroll position stay as they are.
export function tickUpNext(rows) {
  const el = document.querySelector('#view-races .up-next');
  if (!el || !dayChanged(el.dataset.day, new Date())) return;
  const a = document.activeElement;
  const key = a && el.contains(a) ? a.dataset.focus : null;
  const next = upNext(rows);
  el.replaceWith(next);
  if (!key) return;
  const back = next.querySelector(`[data-focus="${key}"]`) || next.querySelector('[data-focus="up-add"]');
  if (back) back.focus({ preventScroll: true });
}

// model: from buildRaces, plus `scanning`; null while the race cache is not loaded yet.
export function renderRaces(model, up = []) {
  const box = $('view-races');
  const title = h('h2', { class: 'view-title' }, 'Races');
  const upEl = upNext(up);
  if (!model) return box.replaceChildren(title, upEl, h('p', { class: 'empty' }, 'Loading your race history…'));
  if (!model.rows.length) {
    return box.replaceChildren(title, upEl, h('p', { class: 'empty' },
      model.scanning ? 'Scanning your race history…' : 'No races yet. Runs you mark as Race in Strava appear here.'));
  }
  const unit = units();
  const ui = readUi();
  const list = chips(model);
  const filter = list.some((c) => c.key === ui.filter) ? ui.filter : 'all';
  const shown = new Set(list.map((c) => c.key).filter((k) => k !== 'all' && k !== 'other'));
  const rows = model.rows.filter((r) => (filter === 'all' ? true : filter === 'other' ? !shown.has(r.cls) : r.cls === filter));
  const visible = expanded ? rows : rows.slice(0, FIRST);

  const chipBar = h('div', { class: 'chips', role: 'group', 'aria-label': 'Distance' }, list.map((c) =>
    h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(c.key === filter), 'data-focus': `chip-${c.key}`,
      onclick: () => { if (c.key !== filter) expanded = false; saveUi({ filter: c.key }); redraw(model, `chip-${c.key}`); },
    }, c.label, h('span', { class: 'count' }, String(c.count)))));

  const modeBtn = (m, text) => h('button', {
    type: 'button', class: 'seg-btn', 'aria-pressed': String(ui.mode === m), 'data-focus': `mode-${m}`,
    onclick: () => { saveUi({ mode: m }); redraw(model, `mode-${m}`); },
  }, text);

  const years = [];
  for (const r of visible) {
    const last = years[years.length - 1];
    if (last && last.year === r.year) last.rows.push(r); else years.push({ year: r.year, rows: [r] });
  }
  const groups = years.map((g) => h('section', { class: 'year', 'aria-label': g.year },
    h('h4', { class: 'year-head' }, g.year),
    h('ul', { class: ui.mode === 'routes' ? 'route-grid' : 'race-list' },
      g.rows.map((r) => (ui.mode === 'routes' ? routeCard(r) : row(r, unit))))));

  // replaceChildren neither flattens arrays nor skips null, so the parts are flattened here
  box.replaceChildren(...[
    title,
    chipBar,
    trend(model, filter, list, unit),
    upEl,
    h('div', { class: 'finished-head' },
      h('h3', { class: 'sub-title' }, 'Finished'),
      h('div', { class: 'toggle', role: 'group', 'aria-label': 'List style' }, modeBtn('rows', 'Rows'), modeBtn('routes', 'Routes'))),
    groups,
    rows.length > visible.length
      ? h('button', { type: 'button', class: 'btn showall', onclick: () => { expanded = true; redraw(model, `race-${rows[FIRST].id}`); } }, `Show all (${rows.length})`)
      : null,
  ].flat().filter(Boolean));
  return undefined;
}
