// Race drawings: route tiles, the pace trend and elevation charts, the splits table.
// fitPoints and markSplits are pure; the rest builds DOM with h() and svg().
import { UNIT_M } from './core.js';
import { h, svg, table } from './dom.js';
import { fmtPace, fmtTime } from './races-model.js';

// Equirectangular projection, longitude scaled by cos(mean latitude), north up, aspect kept, centred in the box.
export function fitPoints(pts, w, h, pad) {
  if (!Array.isArray(pts) || !pts.length) return [];
  const k = Math.cos((pts.reduce((s, p) => s + p[0], 0) / pts.length) * Math.PI / 180);
  const xy = pts.map(([lat, lng]) => [lng * k, -lat]);
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const dx = x1 - x0, dy = y1 - y0;
  if (!(dx > 0) && !(dy > 0)) return pts.map(() => [w / 2, h / 2]);
  const scale = Math.min(dx > 0 ? (w - 2 * pad) / dx : Infinity, dy > 0 ? (h - 2 * pad) / dy : Infinity);
  const ox = (w - dx * scale) / 2, oy = (h - dy * scale) / 2;
  return xy.map(([x, y]) => [ox + (x - x0) * scale, oy + (y - y0) * scale]);
}

const MAX_PTS = 160;
const thin = (pts, max = MAX_PTS) => (pts.length <= max ? pts : Array.from({ length: max }, (_, i) => pts[Math.round((i * (pts.length - 1)) / (max - 1))]));
const r1 = (n) => Math.round(n * 10) / 10;
let glowId = 0;

// The course in the class colour on a board tile: a start ring and a finish dot. No GPS: a dashed circle.
// opts.bleed: the Routes grid card. Square corners (the card clips them), the course fills more of the tile,
// a fine line over a soft glow of itself, and more points for detail.
export function routeTile(pts, colour, size, opts) {
  const s = size, bleed = !!(opts && opts.bleed);
  const kids = [svg('rect', { class: 'rt-bg', width: s, height: s, rx: bleed ? 0 : Math.max(4, s * 0.14) })];
  const xy = pts && pts.length ? fitPoints(thin(pts, bleed ? 400 : MAX_PTS), s, s, s * (bleed ? 0.11 : 0.16)) : null;
  if (xy) {
    const w = bleed ? s / 96 : Math.max(1.5, s / 22);
    const line = (attrs) => svg('polyline', { points: xy.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' '), fill: 'none', stroke: colour, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...attrs });
    if (bleed) {
      const id = `rt-glow-${++glowId}`;
      kids.push(svg('defs', null, svg('filter', { id, x: '-20%', y: '-20%', width: '140%', height: '140%' }, svg('feGaussianBlur', { stdDeviation: r1(s / 80) }))));
      kids.push(line({ class: 'rt-glow', 'stroke-width': r1(w * 1.6), filter: `url(#${id})`, opacity: 0.6 }));
    }
    kids.push(line({ 'stroke-width': r1(w) }));
    const [sx, sy] = xy[0], [fx, fy] = xy[xy.length - 1];
    kids.push(svg('circle', { class: 'rt-start', cx: r1(sx), cy: r1(sy), r: r1(bleed ? s / 48 : w * 1.7), 'stroke-width': r1(bleed ? s / 120 : w) }));
    kids.push(svg('circle', { class: 'rt-finish', cx: r1(fx), cy: r1(fy), r: r1(bleed ? s * 0.019 : w * 1.4) }));
  } else {
    kids.push(svg('circle', { class: 'rt-none', cx: s / 2, cy: s / 2, r: r1(s * 0.28), 'stroke-width': Math.max(1.5, s / 28), 'stroke-dasharray': `${r1(s / 14)} ${r1(s / 14)}` }));
  }
  return svg('svg', { class: 'rtile', viewBox: `0 0 ${s} ${s}`, width: s, height: s, 'aria-hidden': 'true', focusable: 'false' }, kids);
}

// Pace over time (oldest first), faster higher. Labels: the first and last year, and the record.
export function paceChart(points, unit, opts) {
  const W = 340, H = 140, L = 12, R = 12, T = 26, B = 24;
  const colour = (opts && opts.colour) || 'currentColor';
  const label = (opts && opts.label) || 'Pace trend';
  const day = (p) => Date.parse(`${p.date}T00:00:00Z`) || 0;
  const t0 = day(points[0]), t1 = day(points[points.length - 1]);
  const paces = points.map((p) => p.pace), lo = Math.min(...paces), hi = Math.max(...paces);
  const x = (p) => (t1 > t0 ? L + ((day(p) - t0) / (t1 - t0)) * (W - L - R) : W / 2);
  const y = (p) => (hi > lo ? T + ((p.pace - lo) / (hi - lo)) * (H - T - B) : (T + H - B) / 2);
  const rec = points.find((p) => p.record);
  const kids = [
    svg('line', { class: 'pc-axis', x1: L, x2: W - R, y1: H - B + 6, y2: H - B + 6 }),
    svg('polyline', { points: points.map((p) => `${r1(x(p))},${r1(y(p))}`).join(' '), fill: 'none', stroke: colour, 'stroke-width': 2, 'stroke-linejoin': 'round', opacity: 0.8 }),
    ...points.filter((p) => p !== rec).map((p) => svg('circle', { cx: r1(x(p)), cy: r1(y(p)), r: 3.5, fill: colour })),
  ];
  const y0 = points[0].date.slice(0, 4), y1 = points[points.length - 1].date.slice(0, 4);
  kids.push(svg('text', { class: 'pc-year', x: L, y: H - 4, 'text-anchor': 'start', text: y0 }));
  if (y1 !== y0) kids.push(svg('text', { class: 'pc-year', x: W - R, y: H - 4, 'text-anchor': 'end', text: y1 }));
  if (rec) {
    const rx = x(rec), ry = y(rec);
    const anchor = rx < W * 0.25 ? 'start' : rx > W * 0.75 ? 'end' : 'middle';
    kids.push(svg('circle', { class: 'pc-rec', cx: r1(rx), cy: r1(ry), r: 6 }));
    kids.push(svg('text', { class: 'pc-rec-t', x: r1(anchor === 'start' ? Math.max(rx - 6, 2) : anchor === 'end' ? Math.min(rx + 6, W - 2) : rx), y: r1(Math.max(ry - 11, 12)), 'text-anchor': anchor, text: `Record ${fmtPace(rec.pace, unit)}` }));
  }
  const desc = `${label}: ${points.length} races from ${y0} to ${y1}, pace ${fmtPace(points[0].pace, unit)} to ${fmtPace(points[points.length - 1].pace, unit)}${rec ? `, record ${fmtPace(rec.pace, unit)} on ${rec.date}` : ''}. Faster is higher.`;
  return svg('svg', { class: 'pchart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': desc }, svg('title', { text: desc }), kids);
}

// Splits are [metres, seconds, elevation change]. Only full splits (at least half a unit) can be marked,
// and only when there are two or more of them with different paces. Pace is t / m.
export function markSplits(splits, unitM) {
  const full = (Array.isArray(splits) ? splits : []).map((s, i) => ({ i, m: s[0], t: s[1] }))
    .filter((s) => s.m > 0 && s.t > 0 && s.m >= unitM / 2);
  if (full.length < 2) return { fastest: null, slowest: null };
  let fast = full[0], slow = full[0];
  for (const s of full) {
    if (s.t / s.m < fast.t / fast.m) fast = s;
    if (s.t / s.m > slow.t / slow.m) slow = s;
  }
  return fast.t / fast.m === slow.t / slow.m ? { fastest: null, slowest: null } : { fastest: fast.i, slowest: slow.i };
}

const FT = 3.28084;
// Heights follow the distance unit: feet with miles, metres with kilometres.
export const fmtHeight = (m, unit) => (unit === 'km' ? `${Math.round(m).toLocaleString()} m` : `${Math.round(m * FT).toLocaleString()} ft`);
const fmtLen = (m, unit) => `${(m / (UNIT_M[unit] || UNIT_M.mi)).toFixed(1)} ${unit}`;

// Altitude over distance from [metres, altitude][] with text labels at the low and high points.
// The viewBox is close to the drawn width (CSS caps it), so 11-unit labels stay near the page's text size.
export function elevationChart(profile, unit) {
  const W = 340, H = 136, L = 6, R = 6, T = 22, PB = 100, AX = 120;   // plot from T to PB, axis at AX
  const pts = (profile || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return null;   // nothing to draw a line through
  const d0 = pts[0][0], d1 = pts[pts.length - 1][0];
  const alts = pts.map((p) => p[1]), lo = Math.min(...alts), hi = Math.max(...alts);
  const x = (d) => (d1 > d0 ? L + ((d - d0) / (d1 - d0)) * (W - L - R) : W / 2);
  // at least 20 m of height range, so a flat course is drawn flat rather than as noise
  const span = Math.max(hi - lo, 20), base = lo - (span - (hi - lo)) / 2;
  const y = (a) => T + (1 - (a - base) / span) * (PB - T);
  const line = pts.map((p) => `${r1(x(p[0]))},${r1(y(p[1]))}`).join(' ');
  const iLo = alts.indexOf(lo), iHi = alts.indexOf(hi);
  const mark = (i, text, below) => {
    const px = x(pts[i][0]), py = y(pts[i][1]);
    const anchor = px < W * 0.2 ? 'start' : px > W * 0.8 ? 'end' : 'middle';
    return [
      svg('circle', { class: 'ec-dot', cx: r1(px), cy: r1(py), r: 3 }),
      svg('text', { class: 'ec-t', x: r1(px), y: r1(below ? py + 15 : Math.max(py - 7, 11)), 'text-anchor': anchor, text }),
    ];
  };
  const kids = [
    svg('polygon', { class: 'ec-area', points: `${r1(x(d0))},${AX} ${line} ${r1(x(d1))},${AX}` }),
    svg('polyline', { class: 'ec-line', points: line, fill: 'none' }),
    svg('line', { class: 'pc-axis', x1: L, x2: W - R, y1: AX, y2: AX }),
    svg('text', { class: 'pc-year', x: L, y: H - 4, 'text-anchor': 'start', text: `0 ${unit}` }),
    svg('text', { class: 'pc-year', x: W - R, y: H - 4, 'text-anchor': 'end', text: fmtLen(d1, unit) }),
  ];
  if (hi > lo) kids.push(...mark(iHi, `High ${fmtHeight(hi, unit)}`, false), ...mark(iLo, `Low ${fmtHeight(lo, unit)}`, true));
  const desc = hi > lo
    ? `Elevation over ${fmtLen(d1, unit)}: low ${fmtHeight(lo, unit)} at ${fmtLen(pts[iLo][0], unit)}, high ${fmtHeight(hi, unit)} at ${fmtLen(pts[iHi][0], unit)}.`
    : `Elevation over ${fmtLen(d1, unit)}: flat at ${fmtHeight(lo, unit)}.`;
  return svg('svg', { class: 'echart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': desc }, svg('title', { text: desc }), kids);
}

// One row per split. A last split shorter than a unit is labelled with its length ("0.2").
export function splitsTable(splits, unit) {
  const per = UNIT_M[unit] || UNIT_M.mi;
  const { fastest, slowest } = markSplits(splits, per);
  const head = [unit === 'km' ? 'Km' : 'Mile', 'Time', 'Pace', 'Climb'];
  const rows = splits.map(([m, t, el], i) => {
    const part = m > 0 && m < per * 0.95;
    const tag = i === fastest ? h('span', { class: 'tag go' }, 'Fastest') : i === slowest ? h('span', { class: 'tag slow' }, 'Slowest') : null;
    const shown = Math.round(unit === 'km' ? el : el * FT);   // the sign of what is shown, so never "−0"
    const elText = `${shown > 0 ? '+' : shown < 0 ? '−' : ''}${fmtHeight(Math.abs(el), unit)}`;
    return h('tr', { class: i === fastest ? 'fast' : i === slowest ? 'slow' : null },
      h('td', null, part ? (m / per).toFixed(2) : String(i + 1), tag ? ' ' : null, tag),
      h('td', { class: 'n' }, t > 0 ? fmtTime(t) : '–'),
      h('td', { class: 'n' }, fmtPace(m > 0 && t > 0 ? t / (m / per) : null, unit)),
      h('td', { class: 'n' }, elText));
  });
  return h('div', { class: 'splits' }, table(head, rows));
}
