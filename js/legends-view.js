// Local Legends: drawing the headline cards, tables, map and Data status.
import { S, K, bus, store, RUN_TYPES, WINDOW, REACH_GAP, LIMIT_15, LIMIT_DAY, UserError, RateLimited, dayOf, todayIdx, dayLabel, timeLabel, ago, fmt1, fmt0, plural } from './core.js';
import { $, h } from './dom.js';
import { api, token, rateState } from './strava.js';
import { compute, decodePolyline, kind, statusText, riskSummary } from './legends-model.js';
import { probeFields } from './probe.js';

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

function table(head, rows) {
  return h('div', { class: 'tablewrap' }, h('table', null,
    h('thead', null, h('tr', null, head.map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', null, rows)));
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

export function renderDataStatus(model, c) {
  const box = $('dataStatus'); box.replaceChildren();
  const r = rateState();
  const fetched = model.rows.length - model.pending;
  const withLL = model.rows.filter((x) => x.status !== 'pending' && x.status !== 'unknown').length;
  const checked = model.held.filter((x) => x.stravaCount != null);
  const matches = checked.filter((x) => x.stravaCount === x.mine).length;
  const runs90 = Object.values(c.acts).filter((a) => dayOf(a.d) >= todayIdx() - (WINDOW - 1)).length;
  const vis = { everyone: 0, followers_only: 0, only_me: 0 };
  for (const a of Object.values(c.acts)) vis[a.v] = (vis[a.v] || 0) + 1;
  const items = [
    ['Last synced', c.lastSync ? ago(c.lastSync) : 'Not yet'],
    ['Runs cached', `${Object.keys(c.acts).length} since Jan 1 last year · ${runs90} in the last 90 days`],
    ['Runs by visibility', `${vis.everyone} everyone · ${vis.followers_only} followers · ${vis.only_me} only you (only “everyone” counts toward Local Legends)`],
    ['Segments tracked', `${model.rows.length} (leader count checked on ${fetched})`],
    ['Local Legend field returned', fetched ? `${withLL} of ${fetched} segments${withLL === 0 && fetched > 3 ? '. Strava may have removed this field' : ''}` : '–'],
    ['Your count vs Strava\'s, on titles you hold', checked.length ? `${matches} of ${checked.length} match` : '–'],
  ];
  if (!S.demo) items.push(['Strava API calls used', `${r.wn} of ${LIMIT_15} this 15 minutes · ${r.dn} of ${LIMIT_DAY} today`]);
  box.append(h('dl', { class: 'kv' }, items.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
  if (!S.demo && token()) box.append(...probePanel());
}

const standalone = () => navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

const probeContext = () => [
  `Strava permissions granted: ${(token() || {}).scope || 'unknown'}`,
  `Home-screen app: ${standalone() ? 'yes' : 'no'}`,
];

function probeResult(r) {
  if (!r.of) return 'not checked';
  if (!r.returned) return 'not returned';
  if (!r.filled) return 'returned but empty';
  return `filled on ${r.filled} of ${r.of}`;
}

const probeText = (p) => [
  ...p.rows.map((r) => `${r.source}.${r.field}: returned ${r.returned}, filled ${r.filled} of ${r.of}`),
  ...probeContext(),
].join('\n');

export async function runProbe() {
  if (S.probeBusy) return;
  S.probeBusy = true; S.probeError = null;
  bus.emit('data');
  try {
    const athlete = await api('/athlete');
    const list = (await api('/athlete/activities?per_page=30&page=1')) || [];
    const runs = list.filter((a) => RUN_TYPES.includes(a.sport_type || a.type));
    const pick = runs.find((a) => a.workout_type === 1) || runs[0];
    const detail = pick ? await api(`/activities/${pick.id}`) : null;
    S.probe = { at: Date.now(), rows: probeFields(athlete, runs, detail) };
    store.set(K.probe, S.probe);   // shown below whether or not this browser lets it be saved
  } catch (e) {
    if (e instanceof RateLimited) S.probeError = `Paused for Strava's rate limit. Try again at ${timeLabel(e.until)}.`;
    else if (e instanceof UserError) S.probeError = e.message;
    else { S.probeError = 'The field check failed. Try again.'; console.error(e); }
  } finally {
    S.probeBusy = false;
    bus.emit('data');
  }
}

function probePanel() {
  const p = S.probe || store.get(K.probe);
  const copy = async (ev) => {
    const b = ev.currentTarget;
    try { await navigator.clipboard.writeText(probeText(p)); b.textContent = 'Copied'; }
    catch { b.textContent = 'Select the text below and copy'; }
  };
  return [
    h('p', { class: 'chart-title' }, 'Field check: which Strava fields your connection receives. It records counts only, never the values.'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', disabled: S.probeBusy, onclick: runProbe }, S.probeBusy ? 'Checking…' : 'Run field check (3 Strava requests)'),
      p ? h('button', { type: 'button', class: 'btn small', onclick: copy }, 'Copy results') : null),
    S.probeError ? h('p', { class: 'error', role: 'alert' }, S.probeError) : null,
    ...probeContext().map((t) => h('p', { class: 'note' }, t)),
    p ? h('p', { class: 'note' }, `Checked ${ago(p.at)}`) : null,
    p ? h('div', { class: 'probe' }, table(['Field', 'From', 'Result'], p.rows.map((r) => h('tr', null,
      h('td', null, r.field), h('td', { class: 'n' }, r.source), h('td', { class: 'n' }, probeResult(r)))))) : null,
    p ? h('textarea', { class: 'probe-text', readonly: true, 'aria-label': 'Field check results as text' }, probeText(p)) : null,
  ].filter(Boolean);
}

const STYLE = { risk: { color: '#d03b3b', weight: 6 }, reach: { color: '#d98a00', weight: 5 }, held: { color: '#3f8f2f', weight: 5 }, other: { color: '#8a8984', weight: 3 } };

export function renderMap(model) {
  if (!window.L) { $('map').textContent = 'The map library didn\'t load. Check your connection and reload.'; return; }
  if (!S.map) {
    S.map = L.map('map', { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
