// Pure race rules: distance class, series key, age-group place, virtual flag. Imports nothing.
const MI = 1609.344;
export const STANDARDS = [
  { cls: '1 mi', m: MI }, { cls: '5K', m: 5000 }, { cls: '5 mi', m: 5 * MI }, { cls: '10K', m: 10000 },
  { cls: '15K', m: 15000 }, { cls: '10 mi', m: 10 * MI }, { cls: 'Half', m: 21097.5 }, { cls: 'Marathon', m: 42195 },
];
const COLOURS = { '1 mi': '#FF7EB6', '5K': '#5CB8FF', '5 mi': '#4FD1C5', '10K': '#35D69B', Half: '#FF9A5C', Marathon: '#FFD166' };
export const classColour = (cls) => COLOURS[cls] || '#B3A6FF';

const NUM = String.raw`(\d+(?:\.\d+)?)`;
// The number must not follow a letter, digit or dot ("2025", "12.5"). Written as a consumed prefix, not a
// lookbehind, which Safari before 16.4 cannot parse. The number stays capture group 1.
const BEFORE = String.raw`(?:^|[^\w.])`;
const KM_SRC = String.raw`${BEFORE}${NUM}\s?(?:kilometers?|kilometres?|km|k)\b`;
const MI_SRC = String.raw`${BEFORE}${NUM}[\s-]?(?:miler|miles?|mi)\b`;
const HALF_SRC = String.raw`half[\s-]*marathon`;

const fmt = (n) => String(+n.toFixed(2));
const near = (m) => STANDARDS.find((s) => Math.abs(m - s.m) / s.m <= 0.005);

function nameDistance(name) {
  let x = new RegExp(KM_SRC, 'i').exec(name);
  if (x && +x[1] > 0) { const m = +x[1] * 1000; const s = near(m); return s ? { cls: s.cls, official: s.m } : { cls: `${fmt(+x[1])}K`, official: m }; }
  x = new RegExp(MI_SRC, 'i').exec(name);
  if (x && +x[1] > 0) { const m = +x[1] * MI; const s = near(m); return s ? { cls: s.cls, official: s.m } : { cls: `${fmt(+x[1])} mi`, official: m }; }
  if (new RegExp(HALF_SRC, 'i').test(name)) return { cls: 'Half', official: 21097.5 };
  if (/marathon/i.test(name)) return { cls: 'Marathon', official: 42195 };
  return null;
}

export function classify(name, gpsM) {
  const gps = +gpsM > 0 ? +gpsM : 0;
  const n = nameDistance(String(name || ''));
  if (n && (!gps || Math.abs(n.official - gps) / n.official <= 0.15)) return { ...n, from: 'name' };
  let best = null, bestR = Infinity;
  if (gps) for (const s of STANDARDS) { const r = Math.abs(gps - s.m) / s.m; if (r < bestR) { bestR = r; best = s; } }
  if (best && bestR <= 0.045) return { cls: best.cls, official: best.m, from: 'gps' };
  return { cls: 'Other', official: gps, from: 'other' };
}

export function seriesKey(name) {
  const stripped = stripKey(name);
  return stripped || String(name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripKey(name) {
  return String(name || '').toLowerCase()
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b\d+(?:st|nd|rd|th)\b/g, ' ')
    .replace(/\bannual\b/g, ' ')
    .replace(new RegExp(KM_SRC, 'gi'), ' ')
    .replace(new RegExp(MI_SRC, 'gi'), ' ')
    .replace(new RegExp(HALF_SRC, 'gi'), ' ')
    .replace(/\bmarathon\b|\bhalf\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const AGE_RE = /(\d+)(?:st|nd|rd|th)\b(?:\W+(?!\d+(?:st|nd|rd|th)\b)\w+){0,3}?\W+(?:age[\s-]?group|ag)\b/i;
export function agePlace(description) {
  const x = AGE_RE.exec(description || '');
  return x ? +x[1] : null;
}

export const isVirtual = (sportType, description) =>
  sportType === 'VirtualRun' || /\bvirtual\b/i.test(description || '');

// Progress 0..1, slowing into the end.
export const easeOut = (progress) => 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;

// The finish clock's run-up: the seconds shown at progress 0..1, slowing into the finish time.
export const runUpAt = (totalSeconds, progress) => Math.round(totalSeconds * easeOut(progress));
