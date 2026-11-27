// Pure race model: turns cached Strava summaries and details into rows, records and series.
import { UNIT_M, RUN_TYPES } from './core.js';
import { STANDARDS, classColour, classify, seriesKey, agePlace, isVirtual } from './race-rules.js';
import { decodePolyline } from './legends-model.js';

export const isRace = (a) => RUN_TYPES.includes(a.sport_type || a.type) && a.workout_type === 1;

export function summaryFrom(a) {
  const ll = Array.isArray(a.start_latlng) && a.start_latlng.length === 2 ? a.start_latlng : null;
  const has = (v) => (v == null ? null : v);
  const hr = a.average_heartrate != null || a.max_heartrate != null ? [has(a.average_heartrate), has(a.max_heartrate)] : null;
  return {
    id: String(a.id), n: a.name || '', d: a.start_date_local || '', s: a.start_date ? Date.parse(a.start_date) / 1000 || 0 : 0,
    t: a.elapsed_time || 0, m: a.distance || 0, el: a.total_elevation_gain || 0, ll,
    p: (a.map && a.map.summary_polyline) || null, st: a.sport_type || a.type || 'Run',
    se: has(a.suffer_score), pr: has(a.pr_count), ach: has(a.achievement_count), hr,
  };
}

const splits = (list) => (Array.isArray(list) ? list.map((x) => [x.distance || 0, x.elapsed_time || 0, x.elevation_difference || 0]) : []);

export function detailFrom(a) {
  return {
    at: Date.now(), ag: agePlace(a.description), virt: isVirtual(a.sport_type || a.type, a.description),
    cal: a.calories != null ? a.calories : null,
    sp: { mi: splits(a.splits_standard), km: splits(a.splits_metric) },
  };
}

export function reduceProfile(distance, altitude, max) {
  const n = Math.min(distance.length, altitude.length);
  const pts = (i) => [distance[i], altitude[i]];
  if (n <= max || max < 2) return n <= max ? Array.from({ length: n }, (_, i) => pts(i)) : [pts(0), pts(n - 1)].slice(0, Math.max(max, 1));
  return Array.from({ length: max }, (_, i) => pts(Math.round((i * (n - 1)) / (max - 1))));
}

const clsOrder = (cls) => { const i = STANDARDS.findIndex((s) => s.cls === cls); return i < 0 ? STANDARDS.length : i; };

export function buildRaces(summaries, details, unit) {
  const per = UNIT_M[unit] || UNIT_M.mi;
  const rows = Object.values(summaries || {}).map((s) => {
    const dt = details && details[s.id];
    const det = dt && !dt.missing ? dt : null;
    const c = classify(s.n, s.m);
    const official = c.official || 0;
    return {
      ...s, date: s.d.slice(0, 10), year: s.d.slice(0, 4), time: s.d.slice(11, 16),
      cls: c.cls, colour: classColour(c.cls), official, from: c.from,
      pace: official > 0 && s.t > 0 ? s.t / (official / per) : null,
      short: s.m > 0 && s.m < 0.97 * official,
      virtual: isVirtual(s.st, null) || !!(det && det.virt),
      record: false, gap: null, ag: det ? det.ag : null, key: seriesKey(s.n), others: [],
      pts: s.p ? decodePolyline(s.p) : (s.pts || null), det,
    };
  });
  rows.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  const byId = {}, records = {};
  for (const r of rows) {
    byId[r.id] = r;
    if (r.short || r.virtual || r.cls === 'Other' || !(r.t > 0)) continue;   // no time: never a record
    const cur = records[r.cls];
    // rows run newest first, so "<=" lets an earlier race win a tie
    if (!cur || r.t <= byId[cur].t) records[r.cls] = r.id;
  }
  for (const r of rows) {
    r.record = records[r.cls] === r.id;
    if (r.cls !== 'Other' && records[r.cls] && !r.record && r.t > 0) r.gap = r.t - byId[records[r.cls]].t;
    r.others = rows.filter((o) => o !== r && o.cls === r.cls && o.key === r.key).map((o) => o.id);
  }
  const counts = {};
  for (const r of rows) counts[r.cls] = (counts[r.cls] || 0) + 1;
  const classes = Object.keys(counts).map((cls) => ({ cls, count: counts[cls] })).sort((a, b) =>
    (a.cls === 'Other') - (b.cls === 'Other') || b.count - a.count || clsOrder(a.cls) - clsOrder(b.cls) || (a.cls < b.cls ? -1 : 1));
  return { rows, byId, records, classes };
}

export function fmtTime(sec) {
  const t = Math.round(sec), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p2 = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
}
export const fmtPace = (secPerUnit, unit) => (secPerUnit == null || !isFinite(secPerUnit) ? '–' : `${fmtTime(secPerUnit)} /${unit}`);
export const fmtDist = (m, unit) => `${(m / (UNIT_M[unit] || UNIT_M.mi)).toFixed(2)} ${unit}`;

export function contextLine(race, model) {
  if (race.record) return 'Personal record';
  if (race.short) return 'Course ran short';
  if (race.virtual) return 'Virtual race, not counted for records';
  if (race.cls === 'Other' || race.gap == null || !model.records[race.cls]) return '';
  return `+${fmtTime(race.gap)} off your ${race.cls} record`;
}

export function chips(model) {
  const top = model.classes.filter((c) => c.cls !== 'Other').slice(0, 4);
  const out = [{ key: 'all', label: 'All', count: model.rows.length }, ...top.map((c) => ({ key: c.cls, label: c.cls, count: c.count }))];
  const shown = new Set(top.map((c) => c.cls));
  const rest = model.rows.filter((r) => !shown.has(r.cls)).length;
  if (rest > 0) out.push({ key: 'other', label: 'Other', count: rest });
  return out;
}

export function paceTrend(model, cls) {
  return model.rows.filter((r) => r.cls === cls && !r.virtual && !r.short && r.pace != null)
    .reverse().map((r) => ({ id: r.id, date: r.date, pace: r.pace, record: r.record }));
}
