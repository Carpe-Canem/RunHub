// Runs: the cache of the athlete's runs since January 1 last year, and the mileage worked out from it.
import { store, S, DAY, UNIT_M, units, dayOf, todayIdx, weekStart } from './core.js';

export function emptyCache() { return { v: 2, athlete: null, acts: {}, lastStart: 0, lastSync: 0, lastFull: 0 }; }

// Version 1 also held Local Legends data (det, eff, seg). Its runs are kept, so nothing is fetched again.
export function loadCache(id) {
  const c = store.get(`lw.cache.${id}`);
  if (!c || (c.v !== 1 && c.v !== 2)) return emptyCache();
  if (c.v === 2) return c;
  const e = emptyCache();
  return { ...e, athlete: c.athlete || null, acts: c.acts || {}, lastStart: c.lastStart || 0, lastSync: c.lastSync || 0, lastFull: c.lastFull || 0 };
}

export function saveCache() {
  if (S.demo || !S.athleteId) return;
  if (!store.set(`lw.cache.${S.athleteId}`, S.cache)) S.warn = 'This browser\'s storage is full, so some data will be fetched again next time.';
}

export function miles(c) {
  const t0 = todayIdx(); const unit = units();
  const f = 1 / UNIT_M[unit];
  const td = new Date(t0 * DAY); const Y = td.getUTCFullYear(); const M = td.getUTCMonth(); const D = td.getUTCDate();
  const ws = weekStart(t0);
  const lySame = Date.UTC(Y - 1, M, D) / DAY; const ly0 = Date.UTC(Y - 1, 0, 1) / DAY;
  const y0 = Date.UTC(Y, 0, 1) / DAY; const m0 = Date.UTC(Y, M, 1) / DAY;
  const weeks = new Array(13).fill(0); const days = new Array(7).fill(0); const months = new Map();
  let today = 0; let runsToday = 0; let week = 0; let runsWeek = 0; let month = 0; let ytd = 0; let lytd = 0; let hasLastYear = false;
  for (const a of Object.values(c.acts)) {
    const di = dayOf(a.d); if (!(di <= t0)) continue;
    const x = a.m * f;
    if (di === t0) { today += x; runsToday++; }
    if (di >= ws) { week += x; runsWeek++; days[di - ws] += x; }
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
  return { unit, today, runsToday, week, runsWeek, weekAvg, month, monthAvg: msum / 6, ytd, lytd, hasLastYear, weeks, ws, Y, days, dow: t0 - ws };
}

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
      c.acts[`d${++n}`] = { s: di * 86400, d: iso(di), m: (2.5 + rnd() * 4.5 + (wd === 0 ? 3 : 0)) * 1609.344 };
    }
  }
  return c;
}
