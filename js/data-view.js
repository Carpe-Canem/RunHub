// Data: sync and storage status, the field check (counts only, never values) and the setup link.
import { S, K, bus, store, units, setUnits, RUN_TYPES, WINDOW, LIMIT_15, LIMIT_DAY, UserError, RateLimited, dayOf, todayIdx, timeLabel, ago } from './core.js';
import { $, h, table } from './dom.js';
import { api, token, creds, redirectUri, rateState } from './strava.js';
import { encodeSetup } from './setup-link.js';
import { probeFields } from './probe.js';
import { buildRaces } from './races-model.js';
import { upcomingRows } from './upcoming-sync.js';
import { rescan, saveRaces } from './races-sync.js';
import { RACES_DOWN } from './races-view.js';
import { sync } from './legends-sync.js';
import { enrich, placesOn, setPlaces } from './enrich-sync.js';
import { PLACE_LOOKUPS, pointKey } from './places.js';
import { dropCourseMap } from './race-map.js';
import { standalone, renderUpcomingPanel } from './upcoming-panel.js';
import { currentSource, setMapPref } from './map-tiles.js';

// races: the race model main.js built ({failed: true} if that threw), or null before the race cache is loaded.
export function renderData(model, c, races) {
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
  try { items.push(...raceItems(races)); } catch (e) { console.error(e); items.push(['Race history', RACES_DOWN]); }
  try { items.push(...upcomingItems()); } catch (e) { console.error(e); items.push(['Upcoming races', 'Not available']); }
  if (!S.demo) items.push(['Strava API calls used', `${r.wn} of ${LIMIT_15} this 15 minutes · ${r.dn} of ${LIMIT_DAY} today`]);
  box.append(h('dl', { class: 'kv' }, items.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
  if (!S.demo && token()) box.append(rescanRow());
  if (!S.demo && token()) box.append(...probePanel());
  box.append(unitsRow(), ...placesRow(), ...mapRow());
  const lp = $('linkPanel');
  lp.hidden = S.demo || !token() || !creds();
  lp.replaceChildren(...(lp.hidden ? [] : linkPanel()));
  renderUpcomingPanel();
}

// Upcoming races: counts only, never names or bio text.
function upcomingItems() {
  const up = S.upcoming;
  if (!up) return [['Upcoming races', 'Not loaded yet'], ['Bio last read', '–']];
  const rows = upcomingRows();
  const bio = rows.filter((r) => r.src === 'bio').length, hand = rows.filter((r) => r.src === 'hand').length;
  const b = up.bio;
  const bad = b && b.bad > 0 ? `, ${b.bad} bio ${b.bad === 1 ? 'line' : 'lines'} not read` : '';
  return [['Upcoming races', `${bio} from your Strava bio · ${hand} added here${bad}`],
    ['Bio last read', !b ? 'Not yet' : b.none ? 'Strava did not return a bio' : ago(b.at)]];
}

// Race history status: counts only, never names, so the owner can check the class rules against their own history.
function raceItems(races) {
  const rc = S.races;
  if (!rc) return [['Race history', 'Not loaded yet'], ['Race details', '–'], ['Races by class', '–']];
  if (races && races.failed) return [['Race history', RACES_DOWN]];
  const env = S.raceEnv || { wx: {}, pl: {} };
  const m = races || buildRaces(rc.races, S.raceDet || {}, units(), { wx: env.wx, pl: placesOn() ? env.pl : {} });
  const when = (ms, o) => new Date(ms).toLocaleDateString(undefined, o);
  const sc = rc.scan || {};
  const history = sc.done
    ? `Complete: ${m.rows.length} races, last full scan ${when(rc.lastScan, {})}`
    : (sc.cursor ? `Scanning: back to ${when(sc.cursor * 1000, { month: 'long', year: 'numeric' })}` : 'Scanning: starting');
  const read = m.rows.filter((r) => S.raceDet && S.raceDet[r.id]).length;
  const gps = m.rows.filter((r) => r.from === 'gps').length;
  const byClass = m.classes.length
    ? `${m.classes.map((x) => `${x.cls} ${x.count}`).join(' · ')} · ${gps} classed by GPS distance`
    : 'None yet';
  const withLl = m.rows.filter((r) => r.ll);
  const wxRows = withLl.filter((r) => env.wx[r.id] && !env.wx[r.id].none);
  const prov = wxRows.filter((r) => env.wx[r.id].prov).length;
  const weather = `${wxRows.length} of ${withLl.length} races with a start point${prov > 0 ? `, ${prov} provisional` : ''}`;
  const points = new Set(withLl.map((r) => pointKey(r.ll)));
  const named = [...points].filter((k) => env.pl[k] && env.pl[k].n).length;
  const places = placesOn() ? `${named} of ${points.size} start points named` : 'Lookups off';
  return [['Race history', history], ['Race details', `${read} of ${m.rows.length} read`], ['Races by class', byClass],
    ['Race weather', weather], ['Place names', places]];
}

function rescanRow() {
  const go = async () => {
    if (S.syncing || !S.races) return;
    rescan(S.races); saveRaces();
    bus.emit('data');
    await sync(true);
  };
  return h('div', { class: 'row' },
    h('button', { type: 'button', class: 'btn small', disabled: !!S.syncing || !S.races, onclick: go }, 'Rescan all history'));
}

// The redraw replaces the radios, so focus goes back to the one now checked (arrow keys keep working).
function unitsRow() {
  const now = units();
  const choose = (u) => {
    setUnits(u); bus.emit('data');
    const el = document.querySelector(`#dataStatus [data-focus="units-${u}"]`);
    if (el) el.focus();
  };
  const pick = (u, label) => h('label', { class: 'radio' },
    h('input', { type: 'radio', name: 'units', value: u, checked: now === u, 'data-focus': `units-${u}`, onchange: () => choose(u) }), ` ${label}`);
  return h('div', { class: 'units', role: 'radiogroup', 'aria-label': 'Units' }, h('strong', null, 'Units '), pick('mi', 'Miles'), ' ', pick('km', 'Kilometres'));
}

// The redraw replaces the checkbox, so focus goes back to it.
function placesRow() {
  const toggle = (ev) => {
    const on = ev.currentTarget.checked;
    setPlaces(on); bus.emit('data');
    if (on) enrich();
    const el = document.querySelector('#dataStatus [data-focus="places"]');
    if (el) el.focus();
  };
  return [h('div', { class: 'units' },
    h('label', { class: 'radio' },
      h('input', { type: 'checkbox', checked: placesOn(), disabled: !PLACE_LOOKUPS, 'data-focus': 'places', onchange: toggle }), ' Place lookups')),
    h('p', { class: 'note' }, PLACE_LOOKUPS
      ? "Looks up the town for each race start, once per place, through OpenStreetMap's Nominatim. It sends only a point rounded to about 1 km."
      : 'Place lookups are turned off for this site.')];
}

// The redraw replaces the radios, so focus goes back to the one now checked. A new source needs new tiles, so the
// Legends map is removed and drawn again when next shown.
function mapRow() {
  const now = currentSource();
  const choose = (p) => {
    setMapPref(p);
    if (S.map) { S.map.remove(); S.map = null; }
    dropCourseMap();   // a shown race map is rebuilt on the new source too
    bus.emit('data');
    const el = document.querySelector(`#dataStatus [data-focus="map-${p}"]`);
    if (el) el.focus();
  };
  const pick = (p, label) => h('label', { class: 'radio' },
    h('input', { type: 'radio', name: 'map', value: p, checked: now === p, 'data-focus': `map-${p}`, onchange: () => choose(p) }), ` ${label}`);
  return [h('div', { class: 'units', role: 'radiogroup', 'aria-label': 'Map' }, h('strong', null, 'Map '), pick('carto', 'CARTO'), ' ', pick('osm', 'OpenStreetMap')),
    h('p', { class: 'note' }, "CARTO's map works only on this site's own address. Switch to OpenStreetMap if the map shows 'API key required' or stays blank.")];
}

// The setup link is built when asked for and kept nowhere: not in storage, not in state, not in the log.
let linkShown = false;

export function hideSetupLink() { linkShown = false; }

function linkPanel() {
  const t = token(); const c = creds();
  const link = linkShown
    ? redirectUri() + '#setup=' + encodeSetup({ clientId: c.clientId, clientSecret: c.clientSecret, refreshToken: t.refresh_token, athleteId: t.athleteId, scope: t.scope })
    : null;
  const show = (on) => () => { linkShown = on; bus.emit('data'); };
  const copy = async (ev) => {
    const b = ev.currentTarget;
    try { await navigator.clipboard.writeText(link); b.textContent = 'Copied'; }
    catch { b.textContent = 'Select the link below and copy'; }
  };
  return [
    h('h3', { class: 'sub-title' }, 'Set up another device'),
    h('p', { class: 'note' }, 'Each browser, and the home-screen app, keeps its own storage. A setup link connects another one of yours without typing the keys again: open it there, or paste it into the setup screen of the home-screen app.'),
    h('p', { class: 'warn', role: 'note' }, 'Anyone holding the link can read all of your Strava activities, private ones included, until “Disconnect everywhere” is used. Send it only to yourself.'),
    h('div', { class: 'row' },
      link ? h('button', { type: 'button', class: 'btn small', onclick: copy }, 'Copy') : h('button', { type: 'button', class: 'btn small', onclick: show(true) }, 'Create setup link'),
      link ? h('button', { type: 'button', class: 'btn small', onclick: show(false) }, 'Hide') : null),
    link ? h('textarea', { class: 'probe-text link-text', readonly: true, 'aria-label': 'Setup link' }, link) : null,
  ].filter(Boolean);
}

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
