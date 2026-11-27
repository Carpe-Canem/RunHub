import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherUrl, pickHour, needsWeather, isProvisional, skyText, fmtTemp, fmtWind, fmtPrecip, weatherLines } from '../js/weather.js';

const DAY = 86400;
const hours = Array.from({ length: 24 }, (_, i) => `2026-03-14T${String(i).padStart(2, '0')}:00`);
const col = (f) => hours.map((_, i) => f(i));
const json = {
  hourly: {
    time: hours,
    temperature_2m: col((i) => (i === 8 ? 4.24 : 1)),
    apparent_temperature: col((i) => (i === 8 ? 1.06 : 0)),
    relative_humidity_2m: col((i) => (i === 8 ? 71 : 50)),
    wind_speed_10m: col((i) => (i === 8 ? 12.64 : 5)),
    precipitation: col(() => 0),
    weather_code: col((i) => (i === 8 ? 3 : 0)),
  },
};

test('weatherUrl rounds the point to two decimals and asks for the start-hour fields in local time', () => {
  assert.equal(
    weatherUrl([40.01549, -105.27051], '2026-03-14'),
    'https://archive-api.open-meteo.com/v1/archive?latitude=40.02&longitude=-105.27&start_date=2026-03-14&end_date=2026-03-14&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto',
  );
});

test("pickHour reads the start hour's row", () => {
  assert.deepEqual(pickHour(json, '2026-03-14', '08:47'), { t: 4.2, f: 1.1, h: 71, w: 12.6, p: 0, c: 3 });
});

test('pickHour returns null for a missing hour, a missing hourly block, or a null temperature', () => {
  assert.equal(pickHour(json, '2026-03-15', '08:00'), null);
  assert.equal(pickHour({ hourly: { time: hours.slice(0, 2), temperature_2m: [1, 1] } }, '2026-03-14', '02:30'), null);
  assert.equal(pickHour({}, '2026-03-14', '08:00'), null);
  assert.equal(pickHour(null, '2026-03-14', '08:00'), null);
  const nul = { hourly: { ...json.hourly, temperature_2m: col((i) => (i === 8 ? null : 1)) } };
  assert.equal(pickHour(nul, '2026-03-14', '08:00'), null);
});

test('needsWeather follows the entry state and the 7-day window', () => {
  const now = 1_800_000_000;
  const ll = [40.02, -105.27];
  assert.equal(needsWeather({ ll: null, s: now - 30 * DAY }, undefined, now), false);
  assert.equal(needsWeather({ ll, s: now - 30 * DAY }, undefined, now), true);
  assert.equal(needsWeather({ ll, s: now - 7 * DAY }, { t: 1, prov: true, at: now - DAY }, now), true);
  assert.equal(needsWeather({ ll, s: now - 6 * DAY }, { t: 1, prov: true, at: now - DAY }, now), false);
  assert.equal(needsWeather({ ll, s: now - 30 * DAY }, { t: 1, prov: false, at: now - 20 * DAY }, now), false);
  assert.equal(needsWeather({ ll, s: now - 30 * DAY }, { none: true, at: now - 7 * DAY }, now), true);
  assert.equal(needsWeather({ ll, s: now - 30 * DAY }, { none: true, at: now - 6 * DAY }, now), false);
});

test('isProvisional is true when the race is under 7 days old', () => {
  const now = 1_800_000_000;
  assert.equal(isProvisional(now - 7 * DAY + 1, now), true);
  assert.equal(isProvisional(now - 7 * DAY, now), false);
});

test('skyText covers the WMO groups exactly', () => {
  const want = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog' };
  for (const [c, s] of Object.entries(want)) assert.equal(skyText(+c), s);
  const groups = [[51, 57, 'Drizzle'], [61, 67, 'Rain'], [71, 77, 'Snow'], [80, 82, 'Showers'], [85, 86, 'Snow showers'], [95, 99, 'Thunderstorm']];
  for (const [a, b, s] of groups) for (let c = a; c <= b; c++) assert.equal(skyText(c), s, String(c));
  for (const c of [4, 44, 46, 58, 60, 68, 78, 83, 84, 87, 94, 100, -1, null, undefined, 'x']) assert.equal(skyText(c), '', String(c));
});

test('formatting follows the Units setting', () => {
  assert.equal(fmtTemp(10, 'mi'), '50°F');
  assert.equal(fmtTemp(10, 'km'), '10°C');
  assert.equal(fmtWind(16.0934, 'mi'), '10 mph');
  assert.equal(fmtWind(16, 'km'), '16 km/h');
  assert.equal(fmtPrecip(2.54, 'mi'), '0.10 in');
  assert.equal(fmtPrecip(2.5, 'km'), '2.5 mm');
});

test("weatherLines lists the spec's six rows in order", () => {
  const wx = { t: 10, f: 8, h: 71, w: 16, p: 0, c: 3 };
  const lines = weatherLines(wx, 'km');
  assert.deepEqual(lines.map((l) => l[0]), ['Temperature', 'Feels like', 'Sky', 'Wind', 'Humidity', 'Precipitation']);
  assert.deepEqual(lines[0], ['Temperature', '10°C']);
  assert.deepEqual(lines[2], ['Sky', 'Overcast']);
  assert.deepEqual(lines[4], ['Humidity', '71%']);
  const noSky = weatherLines({ ...wx, c: 4 }, 'km');
  assert.deepEqual(noSky.map((l) => l[0]), ['Temperature', 'Feels like', 'Wind', 'Humidity', 'Precipitation']);
});

test('pickHour treats an hour with any missing figure as unusable, and a missing code as null', () => {
  for (const k of ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'wind_speed_10m', 'precipitation']) {
    const bad = { hourly: { ...json.hourly, [k]: col((i) => (i === 8 ? null : 1)) } };
    assert.equal(pickHour(bad, '2026-03-14', '08:00'), null, k);
    const nan = { hourly: { ...json.hourly, [k]: col((i) => (i === 8 ? NaN : 1)) } };
    assert.equal(pickHour(nan, '2026-03-14', '08:00'), null, k);
  }
  const noCode = { hourly: { ...json.hourly, weather_code: col(() => null) } };
  assert.deepEqual(pickHour(noCode, '2026-03-14', '08:00'), { t: 4.2, f: 1.1, h: 71, w: 12.6, p: 0, c: null });
  assert.equal(skyText(null), '');
});
