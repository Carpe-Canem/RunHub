// Map tiles: CARTO's navy basemap on the site's own address, OpenStreetMap everywhere else.
import { K, store } from './core.js';

// The CARTO key is public by design: CARTO restricts it to the site's address (CARTO_HOST), so it is useless elsewhere.
// It is the one secret allowed in this repository.
export const CARTO_KEY = 'cb1_5gov_1_55151d29ac778071cbf351c0';
export const CARTO_HOST = 'carpe-canem.github.io';

const OSM_COPY = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_COPY = `${OSM_COPY} © <a href="https://carto.com/attributions">CARTO</a>`;

// CARTO on the site's host when there is a key; the browser's own choice (lw.map) wins, but CARTO needs a key.
export function mapSource(host, pref, key) {
  if (!key) return 'osm';
  if (pref === 'carto' || pref === 'osm') return pref;
  return host === CARTO_HOST ? 'carto' : 'osm';
}

export function tileSpec(source, key) {
  if (source === 'carto') {
    const k = `?key=${encodeURIComponent(key)}`;
    return {
      base: { url: `https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png${k}`, className: 'map-carto' },
      labels: { url: `https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png${k}`, className: 'map-labels' },
      attribution: CARTO_COPY,
    };
  }
  return { base: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', className: 'map-navy' }, labels: null, attribution: OSM_COPY };
}

export function currentSource() { return mapSource(location.hostname, store.get(K.map), CARTO_KEY); }

export function setMapPref(p) { if (p === 'carto' || p === 'osm') store.set(K.map, p); else store.del(K.map); }

// Adds the base layer and, for CARTO, the labels in their own pane above the route lines (overlay pane is z-index 400).
export function addTiles(map) {
  const spec = tileSpec(currentSource(), CARTO_KEY);
  L.tileLayer(spec.base.url, { maxZoom: 19, className: spec.base.className, attribution: spec.attribution }).addTo(map);
  if (spec.labels) {
    const pane = map.createPane('labels');
    pane.style.zIndex = 460; pane.style.pointerEvents = 'none';
    L.tileLayer(spec.labels.url, { maxZoom: 19, className: spec.labels.className, pane: 'labels' }).addTo(map);
  }
}
