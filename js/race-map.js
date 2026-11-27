// The course on a map: the route in the class colour over navy tiles, kept across the race page's redraws,
// with an Expand button that opens an interactive full-screen map.
import { h } from './dom.js';
import { addTiles } from './map-tiles.js';

// Pure: what to draw, in order (the start goes last so it sits on top).
export function courseLayers(pts, colour) {
  return [
    { kind: 'line', weight: 9, opacity: 0.22, colour },
    { kind: 'line', weight: 3.5, opacity: 1, colour },
    { kind: 'dot', at: pts[pts.length - 1], radius: 5, fill: '#FF7373' },
    { kind: 'ring', at: pts[0], radius: 6, stroke: '#35D69B', fill: '#04070D' },
  ];
}

// Leaflet options for the race page's map: it shows the course and does not move.
export const STATIC = { zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false };

export function canMap(L, pts) { return !!L && Array.isArray(pts) && pts.length >= 2; }

// Module state: the race whose map is shown, its element and its Leaflet map.
const st = { id: null, el: null, map: null };
let dlg = null;   // { el, map, onKey, opener, scroll }

function draw(map, r) {
  map.createPane('route').style.zIndex = 450;
  for (const s of courseLayers(r.pts, r.colour)) {
    const o = { pane: 'route', interactive: false };
    if (s.kind === 'line') L.polyline(r.pts, { ...o, color: s.colour, weight: s.weight, opacity: s.opacity, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    else if (s.kind === 'dot') L.circleMarker(s.at, { ...o, radius: s.radius, color: s.fill, fillColor: s.fill, fillOpacity: 1, weight: 1 }).addTo(map);
    else L.circleMarker(s.at, { ...o, radius: s.radius, color: s.stroke, fillColor: s.fill, fillOpacity: 1, weight: 3 }).addTo(map);
  }
}

function build(el, opts, r) {
  const map = L.map(el, opts);
  addTiles(map);
  draw(map, r);
  map.fitBounds(L.latLngBounds(r.pts), { padding: [16, 16] });
  return map;
}

// Waits until el is in the page (the caller attaches it after this returns), then builds; gives up after a second.
function whenAttached(el, go, tries = 0) {
  requestAnimationFrame(() => {
    if (el.isConnected) go();
    else if (tries < 60) whenAttached(el, go, tries + 1);
  });
}

export function dropCourseMap() {
  closeDialog(false);
  if (st.map) st.map.remove();
  st.id = null; st.el = null; st.map = null;
}

export function courseMap(r) {
  if (st.id === r.id && st.el) {
    const { map } = st;
    requestAnimationFrame(() => { if (st.map === map && map) map.invalidateSize(); });
    return st.el;
  }
  dropCourseMap();
  const mapEl = h('div', { class: 'course-map' });
  const expand = h('button', { type: 'button', class: 'btn course-expand', onclick: () => openDialog(r, expand) }, 'Expand');
  const el = h('div', { class: 'course-map-wrap' }, mapEl, expand);
  st.id = r.id; st.el = el;
  whenAttached(mapEl, () => {
    if (st.el !== el || st.map) return;
    st.map = build(mapEl, STATIC, r);
  });
  return el;
}

function closeDialog(refocus) {
  if (!dlg) return;
  const d = dlg;
  dlg = null;
  document.removeEventListener('keydown', d.onKey, true);
  if (d.map) d.map.remove();
  d.el.remove();
  document.body.style.overflow = d.scroll;
  if (refocus && d.opener.isConnected) d.opener.focus();
}

function openDialog(r, opener) {
  if (dlg) return;
  const mapEl = h('div', { class: 'course-full-map' });
  const close = h('button', { type: 'button', class: 'btn course-close', onclick: () => closeDialog(true) }, 'Close');
  const el = h('div', { class: 'course-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Course map' }, mapEl, close);
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeDialog(true); } };
  dlg = { el, map: null, onKey, opener, scroll: document.body.style.overflow };
  document.body.style.overflow = 'hidden';
  document.body.append(el);
  document.addEventListener('keydown', onKey, true);
  close.focus();
  const d = dlg;
  whenAttached(mapEl, () => { if (dlg === d) d.map = build(mapEl, { zoomControl: true }, r); });
}
