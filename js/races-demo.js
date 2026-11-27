// Invented races for the ?demo showcase. Every name, place and number here is made up.
import { DAY, todayIdx } from './core.js';
import { emptyRaces } from './races-sync.js';
import { pointKey } from './places.js';

const MI = 1609.344;
const p2 = (n) => String(n).padStart(2, '0');

// [name or (year) => name, days ago, GPS metres, seconds, options]
// o: ll=false for no GPS, st for sport type, ag for age-group place, virt for a detail-only virtual flag
const TOWNS = ['Riverbend', 'Frostbite', 'Canyon', 'Library Hill', 'Creekside', 'Orchard', 'Old Mill', 'Water Tower', 'Rail Trail'];
const SPECS = [
  [(y) => `Riverbend 10K ${y}`, 1130, 10080, 2700, {}],
  [() => 'Riverbend 10K', 760, 10040, 2585, {}],
  [() => 'Riverbend 10K', 395, 10110, 2490, { ag: 3 }],
  [() => 'Frostbite 5 Miler', 640, 8060, 2210, {}],
  [() => 'Frostbite 5 Miler', 275, 8030, 2150, { ag: 2 }],
  [() => 'Library Hill 5K', 520, 5030, 1290, {}],
  [() => 'Library Hill 5K', 150, 5010, 1236, {}],
  [() => 'Orchard 5K', 21, 5020, 1262, {}],
  [() => 'Creekside Half Marathon', 330, 21210, 5520, {}],
  [() => 'Old Mill Half Marathon', 890, 21150, 5790, {}],
  [() => 'Creekside 10K', 205, 10060, 2640, {}],
  [() => 'Orchard 10K', 58, 10030, 2560, {}],
  [() => 'Canyon 25K', 110, 25140, 8760, {}],
  [() => 'Rail Trail Mile', 480, 1620, 372, {}],
  [() => 'Turkey Trot', 1000, 4990, 1410, {}],
  [() => 'Turkey Trot', 635, 5000, 1350, {}],
  [() => 'Water Tower 5K', 95, 4480, 1120, {}],
  [() => 'Rail Trail 5K', 250, 5000, 1330, { ll: false, st: 'VirtualRun' }],
  [() => 'Water Tower 10K', 12 + 365, 10020, 2700, { virt: true }],
  [() => 'Frostbite 5 Miler', 1250, 8100, 2290, { ll: false }],
];

export function demoRaces() {
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const t0 = todayIdx();
  const out = emptyRaces();
  const det = {}, env = { v: 1, wx: {}, pl: {} };
  SPECS.forEach(([name, ago, m, t, o], k) => {
    const id = String(8000 + k);
    const day = t0 - ago;
    const dt = new Date(day * DAY);
    const d = `${dt.toISOString().slice(0, 10)}T${p2(7 + (k % 3))}:${p2(15 * (k % 4))}:00`;
    const gps = o.ll !== false;
    let lat = 40.015 + ((k % 5) - 2) * 0.012 + (rnd() - 0.5) * 0.004;
    let lng = -105.27 + (Math.floor(k / 5) - 1.5) * 0.02 + (rnd() - 0.5) * 0.004;
    const ll = gps ? [+lat.toFixed(5), +lng.toFixed(5)] : null;
    let pts = null, prof = null;
    if (gps) {
      pts = []; const dir = rnd() * Math.PI * 2;
      for (let s = 0; s < 40; s++) { pts.push([+lat.toFixed(5), +lng.toFixed(5)]); lat += Math.sin(dir + s * 0.09) * 0.0006; lng += Math.cos(dir + s * 0.09) * 0.0008; }
      let alt = 1600 + rnd() * 40; const amp = 8 + rnd() * 25;
      prof = Array.from({ length: 80 }, (_, i) => [Math.round((i * m) / 79), Math.round((alt + Math.sin(i / 9 + k) * amp + i * 0.1) * 10) / 10]);
    }
    const mkSplits = (unitM) => {
      const n = Math.floor(m / unitM), list = [];
      const pace = t / (m / unitM);
      for (let i = 0; i < n; i++) list.push([Math.round(unitM * 10) / 10, Math.round(pace * (0.97 + rnd() * 0.06)), Math.round((rnd() - 0.5) * 16 * 10) / 10]);
      const rest = m - n * unitM;
      if (rest > 20) list.push([Math.round(rest * 10) / 10, Math.round(pace * (rest / unitM)), Math.round((rnd() - 0.5) * 6 * 10) / 10]);
      return list;
    };
    out.races[id] = {
      id, n: typeof name === 'function' ? name(d.slice(0, 4)) : name, d, s: Date.parse(`${d}Z`) / 1000, t, m,
      el: Math.round(m / 1000 * (6 + rnd() * 10)), ll, p: null, pts, st: o.st || 'Run',
      se: Math.round(40 + rnd() * 80), pr: rnd() < 0.3 ? 1 : 0, ach: rnd() < 0.5 ? 1 : 0,
      hr: [Math.round(150 + rnd() * 20), Math.round(172 + rnd() * 14)],
    };
    det[id] = { at: Date.now(), ag: o.ag || null, virt: !!o.virt, cal: Math.round(m / 1000 * 62), sp: { mi: mkSplits(MI), km: mkSplits(1000) } };
    if (prof) det[id].prof = prof;
    if (ll) {
      const t = Math.round((4 + rnd() * 18) * 10) / 10;
      env.wx[id] = { t, f: Math.round((t - 1 - rnd() * 3) * 10) / 10, h: Math.round(35 + rnd() * 50), w: Math.round((2 + rnd() * 16) * 10) / 10,
        p: rnd() < 0.2 ? Math.round(rnd() * 20) / 10 : 0, c: Math.round(rnd() * 100), at: Date.now(), prov: false };
      const pk = pointKey(ll);
      if (!env.pl[pk]) env.pl[pk] = { n: `${TOWNS[Object.keys(env.pl).length % TOWNS.length]}, CO`, at: Date.now() };
    }
  });
  out.scan = { done: true, started: Date.now(), cursor: 0, seen: [] };
  out.lastScan = Date.now();
  return { races: out, det, env };
}
