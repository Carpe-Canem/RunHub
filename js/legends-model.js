// Local Legends: the cache and everything computed from it.
import { store, S, DAY, WINDOW, REACH_GAP, dayOf, todayIdx, weekStart, plural } from './core.js';

export function emptyCache() { return { v: 1, athlete: null, acts: {}, det: {}, eff: {}, seg: {}, lastStart: 0, lastSync: 0, lastFull: 0 }; }

export function loadCache(id) { const c = store.get(`lw.cache.${id}`); return c && c.v === 1 ? c : emptyCache(); }

export function saveCache() {
  if (S.demo || !S.athleteId) return;
  if (!store.set(`lw.cache.${S.athleteId}`, S.cache)) S.warn = 'This browser\'s storage is full, so some data will be fetched again next time.';
}

export function legendCount(L) {
  const cands = [L.effort_counts && L.effort_counts.overall, L.effort_count, L.effort_description];
  for (const v of cands) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const m = v.replace(/,/g, '').match(/\d+/); if (m) return +m[0]; }
  }
  return null;
}

export function compute(c) {
  const t0 = todayIdx(); const from = t0 - (WINDOW - 1);
  const me = String(c.athlete ? c.athlete.id : '');
  const rows = [];
  for (const [id, list] of Object.entries(c.eff)) {
    let all = 0; let mine = 0; let e7 = 0; let e14 = 0; let next = null;
    for (const [d, a] of list) {
      const act = c.acts[a]; if (!act) continue;
      const di = dayOf(d); if (!(di >= from) || di > t0) continue;
      all++;
      if (act.v !== 'everyone') continue;   // only public activities count toward Local Legends
      mine++;
      const drop = di + WINDOW;             // first day this effort no longer counts
      if (drop <= t0 + 7) e7++;
      if (drop <= t0 + 14) e14++;
      if (next === null || drop < next) next = drop;
    }
    if (!all) continue;
    const seg = c.seg[id] || {}; const ll = seg.ll;
    let status; let gap = null; let need = null;
    if (!seg.at) status = 'pending';
    else if (!ll) status = 'unknown';
    else if (String(ll.id) === me) status = 'held';
    else if (ll.n == null) status = 'unknown';
    else { gap = ll.n - mine; need = Math.max(1, gap + 1); status = gap <= REACH_GAP ? 'reach' : 'behind'; }
    rows.push({
      id, name: seg.n || `Segment ${id}`, m: seg.m, mine, all, e7, e14, next, status, gap, need,
      risk: status === 'held' && e7 > 0,
      stravaCount: status === 'held' ? ll.n : null,
    });
  }
  const held = rows.filter((r) => r.status === 'held');
  return {
    rows, held,
    risk: held.filter((r) => r.risk).sort((a, b) => b.e7 - a.e7 || b.e14 - a.e14),
    reach: rows.filter((r) => r.status === 'reach').sort((a, b) => a.need - b.need),
    chase: rows.filter((r) => r.status === 'reach' || r.status === 'behind').sort((a, b) => a.gap - b.gap),
    pending: rows.filter((r) => r.status === 'pending').length,
    unknown: rows.filter((r) => r.status === 'unknown').length,
  };
}

export function miles(c) {
  const t0 = todayIdx(); const unit = c.athlete ? c.athlete.units : 'mi';
  const f = unit === 'km' ? 1 / 1000 : 1 / 1609.344;
  const td = new Date(t0 * DAY); const Y = td.getUTCFullYear(); const M = td.getUTCMonth(); const D = td.getUTCDate();
  const ws = weekStart(t0);
  const lySame = Date.UTC(Y - 1, M, D) / DAY; const ly0 = Date.UTC(Y - 1, 0, 1) / DAY;
  const y0 = Date.UTC(Y, 0, 1) / DAY; const m0 = Date.UTC(Y, M, 1) / DAY;
  const weeks = new Array(13).fill(0); const months = new Map();
  let today = 0; let runsToday = 0; let week = 0; let runsWeek = 0; let month = 0; let ytd = 0; let lytd = 0; let hasLastYear = false;
  for (const a of Object.values(c.acts)) {
    const di = dayOf(a.d); if (!(di <= t0)) continue;
    const x = a.m * f;
    if (di === t0) { today += x; runsToday++; }
    if (di >= ws) { week += x; runsWeek++; }
    if (di >= m0) month += x;
    if (di >= y0) ytd += x;
    if (di < y0) hasLastYear = true;
    if (di >= ly0 && di <= lySame) lytd += x;
    const w = Math.floor((di - (ws - 12 * 7)) / 7); if (w >= 0 && w < 13) weeks[w] += x;
    const dd = new Date(di * DAY); const mk = dd.getUTCFullYear() * 12 + dd.getUTCMonth();
    months.set(mk, (months.get(mk) || 0) + x);
  }
  const weekAvg = weeks.slice(0, 12).reduce((s, v) => s + v, 0) / 12;
  let msum = 0; for (let k = 1; k <= 6; k++) msum += months.get(Y * 12 + M - k) || 0;
  return { unit, today, runsToday, week, runsWeek, weekAvg, month, monthAvg: msum / 6, ytd, lytd, hasLastYear, weeks, ws, Y };
}

export function decodePolyline(str) {
  let i = 0; let lat = 0; let lng = 0; const out = [];
  while (i < str.length) {
    for (let k = 0; k < 2; k++) {
      let b; let shift = 0; let result = 0;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

export const kind = (r) => (r.risk ? 'risk' : r.status === 'reach' ? 'reach' : r.status === 'held' ? 'held' : 'other');

export const statusText = (r) => (r.risk ? `Held, loses ${plural(r.e7, 'effort')} this week`
  : r.status === 'held' ? `Held with ${plural(r.mine, 'effort')}`
    : r.status === 'reach' || r.status === 'behind' ? `${r.gap > 0 ? `${r.gap} behind` : 'Level'} · ${plural(r.need, 'run')} to win`
      : 'Leader count not available');

export function demoCache() {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const t0 = todayIdx(); const c = emptyCache();
  c.athlete = { id: 1, units: 'mi' }; c.lastSync = Date.now();
  const iso = (di) => `${new Date(di * DAY).toISOString().slice(0, 10)}T07:00:00Z`;
  const start = Date.UTC(new Date().getFullYear() - 1, 0, 1) / DAY;
  let n = 0;
  for (let di = start; di <= t0; di++) {
    const wd = new Date(di * DAY).getUTCDay();
    if (rnd() < [0.85, 0.35, 0.8, 0.55, 0.8, 0.3, 0.7][wd]) {
      c.acts[`d${++n}`] = { s: di * 86400, d: iso(di), m: (2.5 + rnd() * 4.5 + (wd === 0 ? 3 : 0)) * 1609.344, v: rnd() < 0.92 ? 'everyone' : 'only_me' };
    }
  }
  const pub = Object.entries(c.acts).filter(([, a]) => a.v === 'everyone').map(([id]) => id);
  const specs = [
    ['Creekside Path North', 24, 'me', 3], ['Library Hill', 17, 'me', 1], ['Bridge to Bridge', 31, 'me', 0],
    ['Water Tower Climb', 12, 'me', 0], ['Park Loop East', 9, 'me', 0], ['Rail Trail Mile', 40, 'me', 0],
    ['Orchard Lane', 14, 'me', 0], ['Riverbend Sprint', 10, 11, 0], ['Cemetery Hill', 6, 8, 0],
    ['Old Mill Straight', 15, 18, 0], ['Ridge Road Kicker', 3, 22, 0], ['Stadium Stairs Road', 2, 9, 0],
  ];
  specs.forEach(([name, mine, leader, exp7], k) => {
    const id = String(9000 + k); const effs = [];
    for (let j = 0; j < mine; j++) {
      const di = j < exp7 ? t0 - 89 + Math.floor(rnd() * 7) : t0 - 82 + Math.floor(rnd() * 83);
      effs.push([iso(di), pub[Math.floor(rnd() * pub.length)]]);
    }
    let lat = 40.015 + ((k % 4) - 1.5) * 0.016 + (rnd() - 0.5) * 0.004;
    let lng = -105.27 + (Math.floor(k / 4) - 1) * 0.022 + (rnd() - 0.5) * 0.004;
    const dir = rnd() * Math.PI * 2; const pts = [];
    for (let s = 0; s < 14; s++) { pts.push([lat, lng]); lat += Math.sin(dir + s * 0.12) * 0.0008; lng += Math.cos(dir + s * 0.12) * 0.0011; }
    c.eff[id] = effs;
    c.seg[id] = { n: name, m: 400 + Math.floor(rnd() * 1600), at: Date.now(), ll: { id: leader === 'me' ? 1 : 2, n: leader === 'me' ? mine : leader }, pts };
  });
  return c;
}

// The "Titles at risk this week" headline: a count and one line of explanation.
export function riskSummary(model) {
  const known = model.rows.length - model.pending;
  const loading = model.rows.length > 0 && known === 0;
  if (loading) return { count: 0, sub: `Loading Local Legend counts for ${plural(model.rows.length, 'segment')}`, loading };
  if (!model.rows.length) return { count: 0, sub: 'No public runs on segments in the last 90 days yet', loading };
  const r = model.risk;
  let sub;
  if (!model.held.length) sub = "You don't hold any titles yet";
  else if (!r.length) sub = 'None of your titles lose efforts in the next 7 days';
  else {
    const parts = r.slice(0, 2).map((x, i) => `${x.name} loses ${i === 0 ? plural(x.e7, 'effort') : x.e7}`);
    sub = `${parts.join(' and ')} this week${r.length > 2 ? `, plus ${r.length - 2} more` : ''}`;
  }
  return { count: r.length, sub, loading };
}
