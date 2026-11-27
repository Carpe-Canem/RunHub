// Hub: the first view, leading to every other page.
import { $, h, led } from './dom.js';
import { riskSummary } from './legends-model.js';
import { racesDown } from './races-view.js';

// rm.failed: building the race model threw. Any throw here shows the note, and the Legends row still draws.
function racesRow(rm) {
  try { if (!(rm && rm.failed)) return racesRowFor(rm); } catch (e) { console.error(e); }
  return h('a', { class: 'rowlink', href: '#races' },
    h('span', { class: 'rowlink-text' }, h('strong', null, 'Races'), racesDown()));
}

function racesRowFor(rm) {
  const loading = !rm || (rm.scanning && !rm.rows.length);
  const n = loading ? 0 : rm.rows.length;
  const sub = loading ? 'Loading your race history' : n ? `Latest: ${rm.rows[0].n || 'Race'}` : 'No races yet';
  return h('a', { class: 'rowlink', href: '#races' },
    h('span', { class: 'rowlink-text' },
      h('strong', null, 'Races'),
      h('span', { class: 'label' }, 'Races finished'),
      h('span', { class: 'sub' }, sub)),
    h('span', { class: 'rowlink-num' }, led(loading ? '--' : String(n).padStart(2, '0'), { ghost: true })));
}

// model is null until the first sync has loaded the athlete; raceModel is null until the race cache is loaded.
export function renderHub(model, raceModel) {
  const rs = model ? riskSummary(model) : { count: 0, sub: 'Loading your runs from Strava', loading: true };
  const num = rs.loading ? '--' : String(rs.count).padStart(2, '0');
  $('view-hub').replaceChildren(
    h('h2', { class: 'hub-title' }, 'Run Hub'),
    h('div', { class: 'hub-rows' },
      racesRow(raceModel),
      h('a', { class: 'rowlink', href: '#legends' },
        h('span', { class: 'rowlink-text' },
          h('strong', null, 'Local Legends'),
          h('span', { class: 'label' }, 'Titles at risk this week'),
          h('span', { class: 'sub' }, rs.sub)),
        h('span', { class: 'rowlink-num' }, led(num, { ghost: true })))),
    h('p', null, h('a', { class: 'textlink', href: '#data' }, 'Data and connection')),
  );
}
