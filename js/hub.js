// Hub: the first view, leading to every other page.
import { $, h, led } from './dom.js';
import { riskSummary } from './legends-model.js';

// model is null until the first sync has loaded the athlete.
export function renderHub(model) {
  const rs = model ? riskSummary(model) : { count: 0, sub: 'Loading your runs from Strava', loading: true };
  const num = rs.loading ? '--' : String(rs.count).padStart(2, '0');
  $('view-hub').replaceChildren(
    h('h2', { class: 'hub-title' }, 'Run Hub'),
    h('a', { class: 'rowlink', href: '#legends' },
      h('span', { class: 'rowlink-text' },
        h('strong', null, 'Local Legends'),
        h('span', { class: 'label' }, 'Titles at risk this week'),
        h('span', { class: 'sub' }, rs.sub)),
      h('span', { class: 'rowlink-num' }, led(num, { ghost: true }))),
    h('p', null, h('a', { class: 'textlink', href: '#data' }, 'Data and connection')),
  );
}
