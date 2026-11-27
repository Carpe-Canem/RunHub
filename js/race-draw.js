// Race drawings: route tiles and the pace trend chart. fitPoints is pure; the rest builds SVG with svg().
import { svg } from './dom.js';
import { fmtPace } from './races-model.js';

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
const thin = (pts) => (pts.length <= MAX_PTS ? pts : Array.from({ length: MAX_PTS }, (_, i) => pts[Math.round((i * (pts.length - 1)) / (MAX_PTS - 1))]));
const r1 = (n) => Math.round(n * 10) / 10;

// The course in the class colour on a board tile: a start ring and a finish dot. No GPS: a dashed circle.
export function routeTile(pts, colour, size) {
  const s = size, kids = [svg('rect', { class: 'rt-bg', width: s, height: s, rx: Math.max(4, s * 0.14) })];
  const xy = pts && pts.length ? fitPoints(thin(pts), s, s, s * 0.16) : null;
  if (xy) {
    const w = Math.max(1.5, s / 22);
    kids.push(svg('polyline', { points: xy.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' '), fill: 'none', stroke: colour, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const [sx, sy] = xy[0], [fx, fy] = xy[xy.length - 1];
    kids.push(svg('circle', { class: 'rt-start', cx: r1(sx), cy: r1(sy), r: r1(w * 1.7), 'stroke-width': w }));
    kids.push(svg('circle', { class: 'rt-finish', cx: r1(fx), cy: r1(fy), r: r1(w * 1.4) }));
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
