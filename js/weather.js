// Pure weather rules: the archive URL, the start-hour row, the refetch rule and unit formatting. No DOM, no fetch.
const DAY = 86400;
const r1 = (n) => Math.round(n * 10) / 10;

export function weatherUrl(ll, date) {
  const lat = String(Number(ll[0].toFixed(2))), lon = String(Number(ll[1].toFixed(2)));
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}`
    + '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto';
}

// The row for the hour of the start time ('08:47' reads 08:00); null when the answer has no usable figures there.
export function pickHour(json, date, time) {
  const hr = json && json.hourly;
  if (!hr || !Array.isArray(hr.time)) return null;
  const i = hr.time.indexOf(`${date}T${String(time).slice(0, 2)}:00`);
  if (i < 0) return null;
  const v = (k) => (Array.isArray(hr[k]) ? hr[k][i] : null);
  const t = v('temperature_2m');
  if (typeof t !== 'number' || !Number.isFinite(t)) return null;
  const num = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? r1(x) : d);
  const c = v('weather_code');
  return {
    t: r1(t),
    f: num(v('apparent_temperature'), r1(t)),
    h: num(v('relative_humidity_2m'), 0),
    w: num(v('wind_speed_10m'), 0),
    p: num(v('precipitation'), 0),
    c: typeof c === 'number' && Number.isFinite(c) ? Math.round(c) : -1,
  };
}

export const isProvisional = (raceS, nowSec) => nowSec - raceS < 7 * DAY;

export function needsWeather(race, entry, nowSec) {
  if (!race || !race.ll) return false;
  if (!entry) return true;
  if (entry.none) return nowSec - entry.at >= 7 * DAY;
  if (entry.prov) return !isProvisional(race.s, nowSec);
  return false;
}

const SKY = [[0, 0, 'Clear'], [1, 1, 'Mainly clear'], [2, 2, 'Partly cloudy'], [3, 3, 'Overcast'], [45, 45, 'Fog'], [48, 48, 'Fog'],
  [51, 57, 'Drizzle'], [61, 67, 'Rain'], [71, 77, 'Snow'], [80, 82, 'Showers'], [85, 86, 'Snow showers'], [95, 99, 'Thunderstorm']];
export function skyText(code) {
  if (typeof code !== 'number') return '';
  const g = SKY.find(([a, b]) => code >= a && code <= b);
  return g ? g[2] : '';
}

const imp = (unit) => unit === 'mi';
export const fmtTemp = (c, unit) => (imp(unit) ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`);
export const fmtWind = (kmh, unit) => (imp(unit) ? `${Math.round(kmh / 1.609344)} mph` : `${Math.round(kmh)} km/h`);
export const fmtPrecip = (mm, unit) => (imp(unit) ? `${(mm / 25.4).toFixed(2)} in` : `${r1(mm)} mm`);

export function weatherLines(wx, unit) {
  const sky = skyText(wx.c);
  return [
    ['Temperature', fmtTemp(wx.t, unit)],
    ['Feels like', fmtTemp(wx.f, unit)],
    ...(sky ? [['Sky', sky]] : []),
    ['Wind', fmtWind(wx.w, unit)],
    ['Humidity', `${Math.round(wx.h)}%`],
    ['Precipitation', fmtPrecip(wx.p, unit)],
  ];
}
