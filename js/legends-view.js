// Local Legends: drawing the headline cards, tables and map.
import { S, REACH_GAP, dayLabel, fmt1, fmt0, plural } from './core.js';
import { $, h, table } from './dom.js';
import { compute, decodePolyline, kind, statusText, riskSummary } from './legends-model.js';

function setCard(prefix, num, sub) { $(`${prefix}N`).textContent = num; $(`${prefix}S`).textContent = sub; }

function renderHeadlines(model, mi) {
  const rs = riskSummary(model);
  const loading = rs.loading;
  const stillLoading = model.pending ? ` · ${plural(model.pending, 'segment')} still loading` : '';
  const riskCard = $('riskCard');
  riskCard.classList.toggle('danger', model.risk.length > 0);
  riskCard.classList.toggle('ok', !loading && model.risk.length === 0);

  if (loading) {
    setCard('risk', '…', rs.sub);
    setCard('reach', '…', 'Loading');
    setCard('held', '…', 'Loading');
  } else if (!model.rows.length) {
    setCard('risk', '0', rs.sub);
    setCard('reach', '0', 'Nothing to chase yet');
    setCard('held', '0', 'No titles yet');
  } else {
    setCard('risk', String(rs.count), rs.sub + stillLoading);
    const best = model.reach[0];
    setCard('reach', String(model.reach.length),
      best ? `Closest: ${best.name}, ${plural(best.need, 'more run')} to win` : `No titles within ${REACH_GAP} efforts right now`);
    setCard('held', String(model.held.length), `Out of ${plural(model.rows.length, 'segment')} you ran in the last 90 days`);
  }
  setCard('week', `${fmt1(mi.week)} ${mi.unit}`, `12-week average ${fmt1(mi.weekAvg)} ${mi.unit}`);
  const diff = mi.ytd - mi.lytd;
  setCard('ytd', `${fmt0(mi.ytd)} ${mi.unit}`,
    mi.hasLastYear ? `${diff >= 0 ? '+' : '−'}${fmt0(Math.abs(diff))} vs this date in ${mi.Y - 1}` : 'No runs last year to compare with');
}

function segCell(r) {
  const name = h('button', { type: 'button', class: 'linkish', title: 'Show on map', onclick: () => focusSegment(r.id) }, r.name);
  const link = S.demo ? null : h('a', { href: `https://www.strava.com/segments/${encodeURIComponent(r.id)}`, target: '_blank', rel: 'noopener noreferrer', class: 'ext', 'aria-label': `Open ${r.name} on Strava` }, '↗');
  return h('td', { class: 'seg' }, name, ' ', link);
}

function renderDefend(model) {
  const box = $('defend'); box.replaceChildren();
  if (!model.held.length) { box.append(h('p', { class: 'empty' }, "You don't hold any Local Legend titles on segments you ran in the last 90 days.")); return; }
  const rows = [...model.held].sort((a, b) => b.e7 - a.e7 || b.e14 - a.e14 || a.name.localeCompare(b.name)).map((r) => h('tr', { class: r.risk ? 'risk' : null },
    segCell(r),
    h('td', { class: 'n' }, String(r.mine), r.stravaCount != null && r.stravaCount !== r.mine ? h('span', { class: 'note', title: 'Strava\'s own count for you' }, ` (Strava: ${r.stravaCount})`) : null),
    h('td', { class: 'n' }, r.e7 ? `−${r.e7}` : '0'),
    h('td', { class: 'n' }, r.e14 ? `−${r.e14}` : '0'),
    h('td', null, r.next != null ? dayLabel(r.next) : '–')));
  box.append(
    h('p', { class: 'hint' }, 'Your public efforts in the last 90 days, and how many drop out of the window soon. Strava doesn\'t share the runner-up\'s count, so “at risk” means you\'re about to lose efforts.'),
    table(['Segment', 'Efforts', 'Next 7d', 'Next 14d', 'Next drop'], rows));
}

function renderAttack(model) {
  const box = $('attack'); box.replaceChildren();
  if (!model.chase.length) { box.append(h('p', { class: 'empty' }, 'No segments to chase yet. Leader counts may still be loading.')); return; }
  const rows = model.chase.map((r) => h('tr', { class: r.status === 'reach' ? 'reach' : null },
    segCell(r),
    h('td', { class: 'n' }, String(r.mine)),
    h('td', { class: 'n' }, r.gap > 0 ? `${r.gap} behind` : r.gap === 0 ? 'tied' : 'ahead*'),
    h('td', { class: 'n' }, String(r.need))));
  box.append(
    h('p', { class: 'hint' }, `Segments you ran in the last 90 days where someone else holds the title, closest first. Highlighted rows are within ${REACH_GAP} efforts. Only the gap is shown, never the leader.`),
    table(['Segment', 'Efforts', 'Gap', 'To win'], rows));
  if (model.chase.some((r) => r.gap < 0)) box.append(h('p', { class: 'note' }, '* Strava\'s leader count hasn\'t caught up with your latest runs yet.'));
}

function renderMiles(mi) {
  const box = $('miles'); box.replaceChildren();
  const u = mi.unit;
  const line = (label, value, cmp) => h('div', { class: 'mline' }, h('span', null, label), h('strong', null, value), h('span', { class: 'cmp' }, cmp));
  const max = Math.max(...mi.weeks, mi.weekAvg, 1);
  const bars = mi.weeks.map((v, i) => h('div', { class: `bar${i === 12 ? ' cur' : ''}`, style: `height:${Math.max(2, (v / max) * 100)}%`, title: `Week of ${dayLabel(mi.ws - (12 - i) * 7)}: ${fmt1(v)} ${u}` }));
  box.append(
    line('Today', `${fmt1(mi.today)} ${u}`, plural(mi.runsToday, 'run')),
    line('This week', `${fmt1(mi.week)} ${u}`, `12-week average ${fmt1(mi.weekAvg)}`),
    line('This month', `${fmt1(mi.month)} ${u}`, `6-month average ${fmt1(mi.monthAvg)}`),
    line('Year to date', `${fmt0(mi.ytd)} ${u}`, mi.hasLastYear ? `Same date last year ${fmt0(mi.lytd)}` : '–'),
    h('p', { class: 'chart-title' }, `Last 13 weeks (${u}), current week highlighted`),
    h('div', { class: 'bars', role: 'img', 'aria-label': `Weekly distance for the last 13 weeks. This week ${fmt1(mi.week)} ${u}, 12-week average ${fmt1(mi.weekAvg)} ${u}.` },
      h('div', { class: 'avg', style: `bottom:${(mi.weekAvg / max) * 100}%`, title: `12-week average ${fmt1(mi.weekAvg)} ${u}` }),
      bars),
    h('div', { class: 'bar-axis' }, h('span', null, dayLabel(mi.ws - 12 * 7)), h('span', null, 'This week')));
}

const STYLE = { risk: { color: '#FF7373', weight: 6 }, reach: { color: '#FFB52E', weight: 5 }, held: { color: '#35D69B', weight: 5 }, other: { color: '#8D9EC0', weight: 3 } };

export function renderMap(model) {
  if (!window.L) { $('map').textContent = 'The map library didn\'t load. Check your connection and reload.'; return; }
  if (!S.map) {
    S.map = L.map('map', { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, className: 'map-navy', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(S.map);
    S.group = L.featureGroup().addTo(S.map);
  }
  S.group.clearLayers(); S.layers = {};
  const c = S.cache; const order = { other: 0, held: 1, reach: 2, risk: 3 };
  const rows = [...model.rows].sort((a, b) => order[kind(a)] - order[kind(b)]);
  const focus = [];
  for (const r of rows) {
    const seg = c.seg[r.id];
    const pts = seg.pts || (seg.p ? decodePolyline(seg.p) : null);
    if (!pts || pts.length < 2) continue;
    const k = kind(r);
    const line = L.polyline(pts, { ...STYLE[k], opacity: 0.9 });
    line.bindPopup(() => h('div', null, h('strong', null, r.name), h('br'), statusText(r)));
    line.addTo(S.group); S.layers[r.id] = line;
    if (k !== 'other') focus.push(line);
  }
  S.map.invalidateSize();
  const fitTo = focus.length ? L.featureGroup(focus) : S.group;
  if (fitTo.getLayers().length) S.map.fitBounds(fitTo.getBounds(), { padding: [20, 20], maxZoom: 15 });
  else S.map.setView([20, 0], 2);
}

export function focusSegment(id) {
  const d = $('dMap');
  if (!d.open) d.open = true;   // the toggle handler draws the map
  setTimeout(() => {
    if (!S.map) renderMap(compute(S.cache));
    const line = S.layers[id];
    d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (line) { S.map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 }); line.openPopup(); }
  }, 50);
}

export function renderLegends(model, mi) {
  renderHeadlines(model, mi);
  renderDefend(model);
  renderAttack(model);
  renderMiles(mi);
}
