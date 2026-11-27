// One race (#race/<id>): clock, stats, tags, course and elevation, splits, other years, Strava figures.
import { S, bus, units, RateLimited } from './core.js';
import { $, h, led } from './dom.js';
import { contextLine, fmtTime, fmtPace, fmtDist } from './races-model.js';
import { fetchProfile, saveRaceDet } from './races-sync.js';
import { fmtTemp, weatherLines } from './weather.js';
import { courseMap, canMap } from './race-map.js';
import { routeTile, elevationChart, splitsTable, fmtHeight } from './race-draw.js';

// Elevation fetches, by race id: 'loading' while in flight, 'failed' until the page is opened again, or the
// fetched profile itself, kept until the page is reloaded so a save lost to full storage never asks again.
const prof = {};
let shownId = null;

// Called by the router when a race page is opened (not on every redraw): a failed fetch may try again.
export function raceOpened(id) { if (prof[id] === 'failed') delete prof[id]; }

const ordinal = (n) => {
  const t = n % 100, o = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'}`;
};

// Date and start time come straight from start_date_local, read as UTC so no time zone shifts them.
function when(r) {
  const day = new Date(`${r.date}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  const date = day.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (!/^\d{2}:\d{2}$/.test(r.time)) return date;
  const time = new Date(`${r.date}T${r.time}:00Z`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  return `${date} · ${time}`;
}

// What the course section shows: a profile to draw, or 'none' / 'loading' / 'unavailable'; fetch: ask Strava.
// det: the race's detail (or null), gps: the race has a route, state: prof[id] above.
export function elevationPlan(det, gps, demo, state) {
  const has = det && !det.missing;
  const p = has && Array.isArray(det.prof) ? det.prof : has && Array.isArray(state) ? state : null;
  if (p) return p.length >= 2 ? { draw: p } : { show: 'none' };   // [] = Strava has no altitude for this run
  if (!gps) return { show: 'none' };
  if (!has || demo || state === 'failed') return { show: 'unavailable' };
  if (state === 'loading') return { show: 'loading' };
  return { show: 'loading', fetch: true };
}

async function loadProfile(id) {
  prof[id] = 'loading';
  try {
    const p = await fetchProfile(id);
    const d = S.raceDet && S.raceDet[id];   // the details may have been wiped while the request ran
    if (d) {
      d.prof = p || [];   // [] = Strava has no altitude for this run: not asked again, nothing drawn
      prof[id] = d.prof;   // full storage makes saveRaceDet drop every prof; this copy keeps it drawn
      saveRaceDet();
    } else prof[id] = 'failed';
  } catch (e) {
    prof[id] = 'failed';   // a rate-limit pause or any other error: "not available yet" until opened again
    if (!(e instanceof RateLimited)) console.warn('Elevation request failed', e);
  }
  bus.emit('data');
}

// 'none': no start point, so no weather is possible; 'pending': a start point and nothing cached yet; 'ok'.
export function weatherState(r) { return !r.ll ? 'none' : r.wx ? 'ok' : 'pending'; }

function weather(r, unit) {
  const st = weatherState(r);
  return h('section', { class: 'race-sec', 'aria-label': 'Race-day weather' },
    h('h3', { class: 'sub-title' }, 'Race-day weather'),
    st === 'none' ? h('p', { class: 'empty' }, 'No weather')
      : st === 'pending' ? h('p', { class: 'empty' }, 'Weather not available yet')
        : [h('dl', { class: 'kv race-kv' }, weatherLines(r.wx, unit).flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
          r.wx.prov ? h('p', { class: 'empty' }, 'Provisional: final figures arrive about a week after the race.') : null,
          h('p', { class: 'credit' }, 'Weather data by Open-Meteo.com')]);
}

function course(r) {
  const plan = elevationPlan(S.raceDet && S.raceDet[r.id], !!r.pts, S.demo, prof[r.id]);
  if (plan.fetch) loadProfile(r.id);
  const elev = plan.draw ? elevationChart(plan.draw, units())
    : plan.show === 'loading' ? h('p', { class: 'empty' }, 'Loading elevation…')
      : plan.show === 'unavailable' ? h('p', { class: 'empty' }, 'Elevation not available yet') : null;
  return h('section', { class: 'race-sec race-course', 'aria-label': 'Course' },
    h('h3', { class: 'sub-title' }, 'Course'),
    canMap(window.L, r.pts) ? courseMap(r) : h('div', { class: 'course-tile' }, routeTile(r.pts, r.colour, 240)),
    r.pts ? h('p', { class: 'course-key' }, h('span', { class: 'key-start' }), 'Start ', h('span', { class: 'key-finish' }), 'Finish') : h('p', { class: 'course-key' }, 'No GPS for this race'),
    elev);
}

function splits(r, unit) {
  const sp = r.det && r.det.sp ? r.det.sp[unit] : null;
  return h('section', { class: 'race-sec', 'aria-label': 'Splits' },
    h('h3', { class: 'sub-title' }, unit === 'km' ? 'Splits per kilometre' : 'Splits per mile'),
    !r.det ? h('p', { class: 'empty' }, 'Splits not available yet')
      : !sp || !sp.length ? h('p', { class: 'empty' }, 'No splits for this race')
        : splitsTable(sp, unit));
}

function others(r, model, unit) {
  const list = r.others.map((id) => model.byId[id]).filter(Boolean);
  if (!list.length) return null;
  return h('section', { class: 'race-sec', 'aria-label': 'Same race, other years' },
    h('h3', { class: 'sub-title' }, 'Same race, other years'),
    h('ul', { class: 'race-list' }, list.map((o) => h('li', null,
      h('a', { class: 'race-row other-row', href: `#race/${o.id}` },
        h('strong', { class: 'or-year' }, o.year),
        h('span', { class: 'rr-main' },
          h('span', { class: 'rr-name' }, o.n || 'Race'),
          h('span', { class: 'rr-meta' }, fmtPace(o.pace, unit), o.wx ? ` · ${fmtTemp(o.wx.t, unit)}` : null, o.record ? h('span', { class: 'rr-pr' }, ' · Record') : null)),
        h('span', { class: 'rr-time' }, led(fmtTime(o.t))))))));
}

function fromStrava(r, unit) {
  const rows = [];
  const add = (k, v) => { if (v != null && v !== '') rows.push(h('dt', null, k), h('dd', null, String(v))); };
  add('Relative effort', r.se);
  if (r.pr > 0) add('Strava PRs', r.pr);
  else if (r.ach != null) add('Achievements', r.ach);
  else add('Strava PRs', r.pr);
  add('GPS distance', r.m > 0 ? fmtDist(r.m, unit) : null);
  add('Average heart rate', r.hr && r.hr[0] != null ? `${Math.round(r.hr[0])} bpm` : null);
  add('Maximum heart rate', r.hr && r.hr[1] != null ? `${Math.round(r.hr[1])} bpm` : null);
  add('Calories', r.det && r.det.cal != null ? `${Math.round(r.det.cal).toLocaleString()} kcal` : null);
  return h('section', { class: 'race-sec', 'aria-label': 'From Strava' },
    h('h3', { class: 'sub-title' }, 'From Strava'),
    rows.length ? h('dl', { class: 'kv race-kv' }, rows) : null,
    h('p', null, h('a', { class: 'textlink', href: `https://www.strava.com/activities/${r.id}`, target: '_blank', rel: 'noopener' }, 'View on Strava')));
}

function back(cameFrom) {
  return h('a', {
    class: 'backlink', href: '#races',
    onclick: (ev) => { if (cameFrom) { ev.preventDefault(); history.back(); } },
  }, h('span', { 'aria-hidden': 'true' }, '‹ '), 'Back');
}

// model: from buildRaces plus `scanning`, or null before the race cache is loaded. id null: nothing chosen yet.
// cameFrom: the view this race was opened from in this session ('hub' or 'races'), else null.
export function renderRace(model, id, cameFrom) {
  const box = $('view-race');
  if (id !== shownId) { box.scrollTop = 0; shownId = id; }
  if (id == null) return box.replaceChildren(h('p', { class: 'empty choose' }, 'Choose a race'));
  const r = model && model.byId[id];
  if (!r) {
    const loading = !model || model.scanning;
    return box.replaceChildren(back(cameFrom), h('div', { class: 'race-missing' },
      h('p', null, loading ? 'Still loading your race history.' : 'This race isn\'t in your race history.'),
      h('p', null, h('a', { class: 'textlink', href: '#races' }, 'Races'))));
  }
  const unit = units();
  const ctx = contextLine(r, model);
  const tags = [
    r.record ? h('span', { class: 'tag go' }, 'Record') : null,
    r.ag ? h('span', { class: 'tag' }, `${ordinal(r.ag)} in age group`) : null,
    r.virtual ? h('span', { class: 'tag' }, 'Virtual') : null,
    r.short ? h('span', { class: 'tag' }, 'Short course') : null,
  ].filter(Boolean);
  const stat = (label, value) => h('div', { class: 'stat' }, h('span', { class: 'label' }, label), h('strong', null, value));
  box.replaceChildren(...[
    back(cameFrom),
    h('div', { class: 'card race-clock' },
      h('p', { class: 'rc-when' }, h('span', { class: 'badge', style: `--c: ${r.colour}` }, r.cls), ' ', when(r), r.place ? ` · ${r.place}` : null),
      h('h2', { class: 'view-title race-name' }, r.n || 'Race'),
      h('p', { class: 'race-led' }, led(fmtTime(r.t), { ghost: true })),
      ctx ? h('p', { class: `race-ctx${r.record ? ' go' : r.gap != null && !r.short && !r.virtual ? ' slow' : ''}` }, ctx) : null),
    h('div', { class: 'race-stats' },
      stat('Pace', fmtPace(r.pace, unit)),
      stat('Distance', r.official > 0 ? fmtDist(r.official, unit) : '–'),
      stat('Climb', fmtHeight(r.el || 0, unit)),
      stat('Temperature', r.wx ? fmtTemp(r.wx.t, unit) : '–')),
    tags.length ? h('p', { class: 'tags' }, tags) : null,
    course(r),
    splits(r, unit),
    weather(r, unit),
    others(r, model, unit),
    fromStrava(r, unit),
  ].filter(Boolean));
  return undefined;
}
