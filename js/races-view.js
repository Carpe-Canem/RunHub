// Races: filter chips, pace trend and the finished list (rows or route tiles).
import { K, store, units, dayLabel, DAY } from './core.js';
import { $, h, led } from './dom.js';
import { chips, paceTrend, fmtTime, fmtPace } from './races-model.js';
import { classColour } from './race-rules.js';
import { routeTile, paceChart } from './race-draw.js';

const FIRST = 10;
let expanded = false;   // "Show all" pressed; reset when the filter changes

function readUi() {
  const u = store.get(K.ui) || {};
  return { mode: u.mode === 'routes' ? 'routes' : 'rows', filter: typeof u.filter === 'string' ? u.filter : 'all' };
}
function saveUi(patch) { store.set(K.ui, { ...readUi(), ...patch }); }

// Redraw, then put focus back on the control that was used (the redraw replaces it).
function redraw(model, focusKey) {
  renderRaces(model);
  const el = focusKey && document.querySelector(`#view-races [data-focus="${focusKey}"]`);
  if (el) el.focus();
}

const dateText = (r) => dayLabel(Date.parse(`${r.date}T00:00:00Z`) / DAY);
const badge = (r) => h('span', { class: 'badge', style: `--c: ${r.colour}` }, r.cls);

function row(r, unit) {
  return h('li', null, h('a', { class: 'race-row', href: `#race/${r.id}`, 'data-focus': `race-${r.id}` },
    routeTile(r.pts, r.colour, 44),
    h('span', { class: 'rr-main' },
      h('strong', { class: 'rr-name' }, r.n || 'Race'),
      h('span', { class: 'rr-meta' }, badge(r), ' ', dateText(r), r.record ? h('span', { class: 'rr-pr' }, ' · Record') : null)),
    h('span', { class: 'rr-time' }, led(fmtTime(r.t)), h('span', { class: 'rr-pace' }, fmtPace(r.pace, unit)))));
}

function routeCard(r) {
  return h('li', null, h('a', { class: 'route-card', href: `#race/${r.id}`, 'data-focus': `race-${r.id}` },
    routeTile(r.pts, r.colour, 120),
    h('strong', { class: 'rc-name' }, r.n || 'Race'),
    h('span', { class: 'rc-meta' }, badge(r), ' ', dateText(r)),
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

// model: from buildRaces, plus `scanning`; null while the race cache is not loaded yet.
export function renderRaces(model) {
  const box = $('view-races');
  const title = h('h2', { class: 'view-title' }, 'Races');
  if (!model) return box.replaceChildren(title, h('p', { class: 'empty' }, 'Loading your race history…'));
  if (!model.rows.length) {
    return box.replaceChildren(title, h('p', { class: 'empty' },
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
