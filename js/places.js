// Pure place rules: the rounded point key, the Nominatim URL and the short place label. No DOM, no fetch.
export const PLACE_LOOKUPS = true; // the "off for everyone" switch

const pt = (ll) => [String(Number(ll[0].toFixed(2))), String(Number(ll[1].toFixed(2)))];
export const pointKey = (ll) => pt(ll).join(',');
export function placeUrl(ll) {
  const [lat, lon] = pt(ll);
  return `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
}

const TOWN = ['city', 'town', 'village', 'hamlet', 'municipality', 'county'];
export function placeLabel(json) {
  const a = json && typeof json === 'object' ? json.address : null;
  if (!a || typeof a !== 'object') return null;
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  let town = '';
  for (const k of TOWN) { town = str(a[k]); if (town) break; }
  const iso = str(a['ISO3166-2-lvl4']);
  const code = iso.includes('-') ? iso.slice(iso.indexOf('-') + 1) : '';
  const region = /^[A-Za-z]{1,3}$/.test(code) ? code : str(a.state) || str(a.country);
  if (town && region) return `${town}, ${region}`;
  return town || region || null;
}
