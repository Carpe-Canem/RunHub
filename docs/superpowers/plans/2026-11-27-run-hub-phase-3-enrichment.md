# Run Hub Phase 3 (Enrichment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every race with a start point shows its race-day weather and town, and the race page and the Legends map use the CARTO navy map, without spending any Strava requests.

**Architecture:** A new enrichment pass, separate from `sync()` and from Strava's request counter, fills a new cache `lw.raceEnv.<athleteId>` with weather from Open-Meteo's archive (per race) and town names from Nominatim (per distinct rounded start point). The race model joins that cache to its rows; views show it. A small map module picks CARTO or the keyless OpenStreetMap recipe and is shared by the Legends map and a new static race-course map.

**Tech Stack:** HTML, CSS, browser ES modules, Leaflet 1.9.4 (pinned, unchanged), Open-Meteo archive API, Nominatim reverse API, CARTO raster tiles, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-26-hub-and-races-design.md`: "Phasing" item 3, "Weather", "Place names (decision 3)", "Map", "Outside hosts and the privacy promise", "Failure behaviour", and the race page's weather items under "Views". Earlier plans: `docs/superpowers/plans/2026-11-26-run-board-phase-1-shell.md`, `docs/superpowers/plans/2026-11-26-run-hub-phase-2-races.md`.

## Scope

**In:** weather (fetch, cache, provisional re-fetch, display in the list, race page and other years), place names through Nominatim (the field probe found Strava's empty), the "Place lookups" switch and kill constant, the CARTO navy map on the race page (static, with Expand) and on Legends, the "Map" switch, the CSP, README, footer and code-header changes for the three hosts, and one carry-over from phase 2 (a failure cap on the race-details pass).

**Out (phase 4):** hub content, Up next, the bio reader, Add race, export and import, countdown. **Out (parked, not planned):** duplicate "Races are not available" note in both wide panes; the elevation line dropped silently for a profile under 2 points.

## Rulings made while planning (accepted by the owner 2026-11-27; Task 8 kept)

1. **Storage.** Weather and places go in a new key `lw.raceEnv.<athleteId>` = `{v: 1, wx: {<raceId>: Weather}, pl: {<pointKey>: Place}}`, not inside `lw.raceDet`, because the details pass treats any `lw.raceDet` entry as "detail read" and the spec makes each enrichment independent. Two new settings: `lw.map` (`'carto'` or `'osm'`; absent = automatic) and `lw.places` (`false` = lookups off; absent = on). Both leave paths remove all three.
2. **Enrichment runs outside `sync()`.** `enrich()` uses `fetch` directly, never `api()`, so it neither spends nor waits on the Strava budget, and a Strava rate-limit pause does not hold back weather. One pass in flight at a time; a call during a pass queues exactly one more pass. It starts after the race cache loads and after each race scan. The demo never fetches.
3. **Weather is stored metric** (°C, km/h, mm) and converted when shown, so the Units setting never refetches. Units follow the Units setting: miles → °F, mph, in; kilometres → °C, km/h, mm.
4. **The start hour** is the hour of `start_date_local` (an 08:47 start reads the 08:00 row). The request uses `timezone=auto`, so Open-Meteo's hourly times are local to the start point and match `start_date_local` directly. Amended 2026-11-27 during execution: Open-Meteo's `timezone=auto` applies today's UTC offset to every date, so the request uses `timezone=GMT` and reads the UTC hour of the race's UTC start; `lw.raceEnv` moved to `v: 2`.
5. **Failure caps.** The weather pass stops after 3 request failures in a row (an HTTP error or a thrown fetch; retried next pass). An answer that arrives but has no usable start hour is not a failure: it stores `{at, none: true}`, which `needsWeather` asks again only once `at` is 7 days old, so a few empty races at the head of the list never block older ones. Nominatim: a `429` or `403` stops lookups for the rest of the page session; a network error ends that pass. The spec's 1.5 s spacing applies between every two Nominatim requests.
6. **Map source.** CARTO when the page's host is `carpe-canem.github.io` and `CARTO_KEY` is not empty; OpenStreetMap otherwise. `lw.map` overrides in that browser.
7. **Race map lifecycle.** One Leaflet map per shown race, kept across the page's redraws (the same element is re-attached) and removed when another race is shown, on wipe, on leaving the demo, or when the Map switch changes.

## Global Constraints

- **Public repository.** No real race names, places, coordinates, activity IDs, personal names, e-mail addresses or local paths in any committed file, tests and demo data included. Invented places reuse the demo's words (Riverbend, Frostbite, Canyon, Library Hill, Creekside, Orchard, Old Mill, Water Tower, Rail Trail). The CARTO key is the one exception, committed in Task 6 only. Do not use the Strava connector tools in Claude for any of this work.
- **No `innerHTML` with data.** Build DOM with `h()` and `svg()` from `js/dom.js`. Text from Open-Meteo or Nominatim is data.
- **ES modules, no build step, no new runtime dependency.** Only `js/main.js` touches `document`, `window` or `localStorage` while loading; other modules do so only inside functions.
- **Module versions.** Every task that changes a file under `js/` or `styles.css`, or adds a `js/` file, runs `node scripts/stamp-version.mjs <N>` with the task's number: Task 1 → 22, Task 2 → 23 … Task 8 → 29. `tests/versions.test.js` enforces the map and the hash.
- **CSP, final form after Task 6** (each task adds only its own host): `default-src 'none'; script-src 'self' 'sha256-<hash>' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://tile.openstreetmap.org https://basemaps.cartocdn.com https://cdnjs.cloudflare.com; connect-src https://www.strava.com https://archive-api.open-meteo.com https://nominatim.openstreetmap.org; font-src 'self'; base-uri 'none'; form-action 'none'; manifest-src 'self'`.
- **Every outside host is named** in the README's Privacy section, the footer and the header comment of `js/main.js`, in the same task that adds it (spec, "Outside hosts").
- **What leaves the browser.** Open-Meteo gets a start point rounded to two decimals and a date. Nominatim gets a start point rounded to two decimals. CARTO gets tile requests. None gets names, times, tokens or the athlete's ID.
- **Storage.** Unchanged keys stay as they are. New: `lw.raceEnv.<athleteId>`, `lw.map`, `lw.places`. Every access through `store` in `js/core.js`. If a save fails, set `S.warn` to the existing storage-full sentence (export it from `js/races-sync.js` as `FULL`).
- **Legends unchanged** in what it counts and stores. Only its map tiles change (Task 6).
- **Look.** Phase 1 tokens and class colours as before. Route on the map in the class colour; start `--go` (`#35D69B`) ring with `--board` (`#04070D`) centre; finish `--slow` (`#FF7373`) dot.
- **Owner stop points.** Never push, merge to `main` or deploy without the owner's say. Task 6 needs the CARTO key: stop and ask the owner to paste it; never take it from memory or an earlier conversation.
- **Local harness.** `mock.html` and `mock-fetch.js` are gitignored and live only in the owner's main checkout. Regenerate `mock.html` from `index.html` whenever `index.html` changes (`<script src="mock-fetch.js?n=N"></script>` right before the import map; bump `n`). Tasks 2 and 3 extend `mock-fetch.js` to answer Open-Meteo and Nominatim with invented data, so local checks send nothing to them. `.claude/launch.json` has `dashboard-8082`.
- **Run tests with** `node --test` from the repository root.

## Review Focus

1. **CARTO refusing the key on the live site** (for example a key restricted to a path while the page's referrer policy sends only the origin) → placeholder tiles that say a key is required, which nothing can detect. Task 8's owner check on the live site; the Map switch to OpenStreetMap is the escape.
2. **A start hour the archive cannot answer** (values `null` for recent hours, or a local time that falls in a daylight-saving gap such as 02:30 on the change night) → "Weather not available yet", never "NaN°F" or `undefined`. Task 1, `pickHour` tests.
3. **A start point Nominatim has no town for** (a trail head with only a county, a point in a lake, an empty `{error}` answer) → the fallback label or no place line, cached so that point is never asked again. Task 1 `placeLabel` tests, Task 3 `fetchPlaces` test.
4. **Switching Units after weather is cached** → the new units at once, with no request. Task 1 formatting tests, Task 4 `buildRaces` test.
5. **The race page redrawing while its map is shown** (the details pass redraws every 5 races) → the same map stays, no flicker, no Leaflet "Map container is already initialized" error; the Expand overlay keeps working. Task 7, browser check during a mock sync.

---

### Task 1: Weather and place rules

**Files:**
- Create: `js/weather.js`, `js/places.js`, `tests/weather.test.js`, `tests/places.test.js`
- Modify: `index.html` (stamp 22)

**Interfaces:**
- Produces, `js/weather.js` (pure):
  - `weatherUrl(ll: [lat, lng], date: 'YYYY-MM-DD'): string`
  - `pickHour(json, date, time: 'HH:MM'): Weather | null`, where `Weather = {t, f, h, w, p, c}`: temperature °C, feels-like °C, relative humidity %, wind km/h, precipitation mm, WMO weather code; numbers rounded to 1 decimal, `c` an integer.
  - `needsWeather(race: {ll, s}, entry: Weather & {at, prov} | undefined, nowSec: number): boolean`
  - `isProvisional(raceS: number, nowSec: number): boolean`
  - `skyText(code): string`, `fmtTemp(c, unit)`, `fmtWind(kmh, unit)`, `fmtPrecip(mm, unit)`
  - `weatherLines(wx: Weather, unit): [label, value][]`
- Produces, `js/places.js` (pure, plus one constant):
  - `PLACE_LOOKUPS = true` (the "off for everyone" switch, spec "Place names")
  - `pointKey(ll): string` (`'40.02,-105.27'`), `placeUrl(ll): string`, `placeLabel(json): string | null`

- [ ] **Step 1: Write the failing tests** (`tests/weather.test.js`, `tests/places.test.js`; all fixtures invented):
  - `weatherUrl rounds the point to two decimals and asks for the start-hour fields in local time`: `weatherUrl([40.01549, -105.27051], '2026-03-14')` equals `https://archive-api.open-meteo.com/v1/archive?latitude=40.02&longitude=-105.27&start_date=2026-03-14&end_date=2026-03-14&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`.
  - `pickHour reads the start hour's row`: a 24-row `hourly` fixture; time `'08:47'` returns the `2026-03-14T08:00` row as `{t: 4.2, f: 1.1, h: 71, w: 12.6, p: 0, c: 3}`.
  - `pickHour returns null for a missing hour, a missing hourly block, or a null temperature` (the DST-gap and not-yet-available cases).
  - `needsWeather`: no `ll` → false; no entry → true; provisional entry and the race 7 days or more ago → true; provisional entry and race 6 days ago → false; final entry → false; `{none: true}` entry → true only when its `at` is 7 days or more old.
  - `isProvisional`: true when `nowSec - raceS < 7 * 86400`.
  - `skyText` covers the WMO groups exactly: 0 Clear, 1 Mainly clear, 2 Partly cloudy, 3 Overcast, 45 and 48 Fog, 51–57 Drizzle, 61–67 Rain, 71–77 Snow, 80–82 Showers, 85–86 Snow showers, 95–99 Thunderstorm, anything else `''`.
  - `formatting follows the Units setting`: `fmtTemp(10, 'mi')` `'50°F'`, `fmtTemp(10, 'km')` `'10°C'`, `fmtWind(16.0934, 'mi')` `'10 mph'`, `fmtWind(16, 'km')` `'16 km/h'`, `fmtPrecip(2.54, 'mi')` `'0.10 in'`, `fmtPrecip(2.5, 'km')` `'2.5 mm'`.
  - `weatherLines lists the spec's six rows in order`: labels `Temperature, Feels like, Sky, Wind, Humidity, Precipitation`; the Sky row is left out when `skyText` is `''`.
  - `pointKey rounds to two decimals` and `placeUrl` equals `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=40.02&lon=-105.27&zoom=10&addressdetails=1`.
  - `placeLabel`: town from the first of `city, town, village, hamlet, municipality, county`; region from the part after `-` in `address['ISO3166-2-lvl4']` when it is 1–3 letters, else `address.state`, else `address.country`. `{address: {town: 'Riverbend', 'ISO3166-2-lvl4': 'US-CO', state: 'Colorado'}}` → `'Riverbend, CO'`; only `county` and `state` → `'<county>, <state>'`; region only → the region; `{error: 'Unable to geocode'}` or `{}` → `null`.

- [ ] **Step 2: Run** `node --test tests/weather.test.js tests/places.test.js`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement both modules** with the signatures above. Rounding for URLs and keys: `toFixed(2)` on each coordinate, then `Number` → `String` so `-105.270` is `-105.27`.
- [ ] **Step 4: Run** `node scripts/stamp-version.mjs 22`, then `node --test`. Expected: all pass, `versions.test.js` included.
- [ ] **Step 5: Commit** `js/weather.js js/places.js tests/weather.test.js tests/places.test.js index.html`: "Weather and place rules".

### Task 2: Weather pass and its cache

**Files:**
- Create: `js/enrich-sync.js`, `tests/enrich-sync.test.js`
- Modify: `js/races-sync.js` (export `FULL`), `js/core.js` (`K.map`, `K.places`; `S.raceEnv: null`), `js/legends-sync.js` (start `enrich()` after `scanHistory`), `js/main.js` (load, start, wipe, demo exit, header comment), `index.html` (CSP `connect-src`, footer, stamp 23), `tests/versions.test.js`, `README.md`, `mock-fetch.js` (local only)

**Interfaces:**
- Consumes: Task 1's `weatherUrl`, `pickHour`, `needsWeather`, `isProvisional`.
- Produces, `js/enrich-sync.js`:
  - `emptyEnv(): {v: 1, wx: {}, pl: {}}`, `loadEnv(athleteId)`, `saveEnv()` (writes `S.raceEnv` to `lw.raceEnv.<S.athleteId>`; no-op in demo; on failure sets `S.warn = FULL`)
  - `fetchWeather(rc, env, get = fetch, nowSec = Date.now() / 1000): Promise<void>`
  - `enrich(get = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<void>` (Task 3 adds the places step inside it)
  - `K.map = 'lw.map'`, `K.places = 'lw.places'`

- [ ] **Step 1: Write the failing tests** in `tests/enrich-sync.test.js` (same `localStorage` stub pattern as `tests/races-sync.test.js`; invented races at an invented point; a fake `get` returning `{ok, status, json: async () => …}` and recording URLs):
  - `fetchWeather asks once per race with a start point, newest first, and stores the start hour`: 3 races with `ll`, 1 without → 3 URLs, newest first; each `env.wx[id]` has `t…c`, `at`, and `prov` from `isProvisional`.
  - `fetchWeather skips races it already has final weather for, and asks again for provisional weather once the race is a week old`.
  - `three request failures in a row end the pass`: answers `500, throw, 500, ok` → the 4th race is not asked this pass, nothing is stored for the first three.
  - `an answer with no usable hour stores a dated marker and does not count toward the cap`: answers `null-hour, null-hour, null-hour, ok` → all 4 asked, the first three hold `{at, none: true}` (rows show "Weather not available yet"), the 4th holds weather.
  - `fetchWeather drops weather for races no longer in the cache`.
  - `saveEnv sets the storage-full warning when the write fails` (stub `setItem` to throw).
  - `enrich does nothing in the demo, and a call during a pass runs exactly one more pass afterwards`.
- [ ] **Step 2: Run** `node --test tests/enrich-sync.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `js/enrich-sync.js`.** `fetchWeather` saves every 5 stored races and at the end, and calls `bus.emit('data')` at the end. A thrown `get` counts as a failure. `enrich()` returns at once when `S.demo`, or `S.races`/`S.raceEnv` is null, catches and logs anything thrown, and never rejects.
- [ ] **Step 4: Wire it.** `main.js`: `S.raceEnv = loadEnv(id)` wherever `loadRaceDet` is called, then `enrich()` after the first render when connected; `wipe()` also removes `lw.raceEnv.<id>`, `K.map`, `K.places` and nulls `S.raceEnv`; `exitDemo` nulls `S.raceEnv`. `legends-sync.js` `syncRaces`: call `enrich()` (not awaited) right after `scanHistory`. Add `https://archive-api.open-meteo.com` to `connect-src`; update the expected CSP in `tests/versions.test.js` (rename its test to `the CSP is the expected policy plus the hash`). Footer gains "Weather data by Open-Meteo.com." with a link to `https://open-meteo.com/`. README Privacy and the `main.js` header name `archive-api.open-meteo.com` and what it receives (a start point rounded to about 1 km and a date, per race).
- [ ] **Step 5: Local harness.** `mock-fetch.js` answers `archive-api.open-meteo.com` with a fixed invented 24-hour block for any point and date. Regenerate `mock.html`.
- [ ] **Step 6: Run** `node scripts/stamp-version.mjs 23`, `node --test` (all pass). Browser, `mock.html` on `dashboard-8082`, storage cleared: after sync, `lw.raceEnv.42` has weather for every mock race with a start point; the network log shows no request to Open-Meteo's real host; "Forget this browser" leaves no `lw.raceEnv.*`, `lw.map` or `lw.places`; no console errors. Then one real request through the page's CSP: on `index.html` at localhost, in the console, `await (await fetch(weatherUrl([40.02, -105.27], '<a date last week>'))).json()` (import `weatherUrl` with `await import('./js/weather.js')`) returns an `hourly` block and `pickHour` reads it. Checked by the planner on 2026-11-27 with curl: fields, units (°C, km/h, mm), local `YYYY-MM-DDTHH:00` times and `access-control-allow-origin: *` as this plan assumes.
- [ ] **Step 7: Commit** (not `mock-fetch.js`/`mock.html`): "Race-day weather from Open-Meteo, cached per race".

### Task 3: Place lookups

**Files:**
- Modify: `js/enrich-sync.js`, `js/data-view.js` (switch), `index.html` (CSP, footer, stamp 24), `tests/enrich-sync.test.js`, `tests/versions.test.js`, `README.md`, `js/main.js` (header), `mock-fetch.js` (local only)

**Interfaces:**
- Consumes: Task 1's `PLACE_LOOKUPS`, `pointKey`, `placeUrl`, `placeLabel`; Task 2's `enrich`, `saveEnv`.
- Produces: `placesOn(): boolean` (`PLACE_LOOKUPS && store.get(K.places) !== false`); `setPlaces(on: boolean)`; `fetchPlaces(rc, env, get = fetch, sleep): Promise<void>`. Place entries are `{n: string | null, at}`; `null` means "asked, no town", never asked again.

- [ ] **Step 1: Write the failing tests:**
  - `fetchPlaces asks once per distinct rounded start point, newest race first, 1.5 s apart`: 4 races at 2 rounded points → 2 URLs; the fake `sleep` is called once with `1500`, between them.
  - `a point Nominatim cannot name is cached as no town and never asked again`.
  - `a 429 or 403 stops lookups for the rest of the session; a network error ends only this pass` (a second `fetchPlaces` call after a 429 sends nothing; after a thrown `get` it asks again).
  - `fetchPlaces sends nothing when lookups are off` (`lw.places` false) and `enrich` skips the step.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** `fetchPlaces`, `placesOn`, `setPlaces`, and the places step at the end of `enrich()` (after weather). The session block is a module-level flag.
- [ ] **Step 4: Data switch.** On Data, below Units: a checkbox "Place lookups", checked when `placesOn()`, with the note "Looks up the town for each race start, once per place, through OpenStreetMap's Nominatim. It sends only a point rounded to about 1 km." Turning it on calls `enrich()`. When `PLACE_LOOKUPS` is false the checkbox is disabled and the note reads "Place lookups are turned off for this site."
- [ ] **Step 5: Hosts.** `connect-src` gains `https://nominatim.openstreetmap.org`; update the expected CSP. Footer: "Place names from OpenStreetMap Nominatim." README Privacy and the `main.js` header name `nominatim.openstreetmap.org`, what it receives, the switch, and a link to its usage policy (https://operations.osmfoundation.org/policies/nominatim/). `mock-fetch.js` answers Nominatim with invented towns; regenerate `mock.html`.
- [ ] **Step 6: Run** `node scripts/stamp-version.mjs 24`, `node --test`. Browser on the mock: places cached per point; the switch off sends nothing on the next sync; no real Nominatim request in the network log. Then exactly one real request from the console of `index.html` at localhost: `placeLabel(await (await fetch(placeUrl([40.02, -105.27]))).json())` gives a town and a two-letter state. (Checked by the planner on 2026-11-27 with curl: `address` carries `city`, `county`, `state`, `ISO3166-2-lvl4` and CORS `*`.)
- [ ] **Step 7: Commit**: "Town names from Nominatim, once per start point, with a switch".

### Task 4: Weather and places in the race model and the demo

**Files:**
- Modify: `js/races-model.js`, `js/races-demo.js`, `js/main.js` (`raceModel`, `setDemoRaces`), `js/data-view.js` (counts), `tests/races-model.test.js`, `tests/races-demo.test.js`, `index.html` (stamp 25)

**Interfaces:**
- Consumes: Task 1's `pointKey`; Task 3's `placesOn`.
- Produces: `buildRaces(summaries, details, unit, env?)` where `env = {wx, pl}`; each row gains `wx: Weather & {at, prov} | null` and `place: string | null`. `main.js` passes `{wx: S.raceEnv.wx, pl: placesOn() ? S.raceEnv.pl : {}}`. `demoRaces()` returns `{races, det, env}`.

- [ ] **Step 1: Write the failing tests:**
  - `buildRaces joins weather by race id and the place by rounded start point`, and leaves both `null` without `env`, without `ll`, or for a point whose place is `{n: null}`.
  - `weather stays metric in the model whatever the unit` (`buildRaces(…, 'km', env).rows[0].wx.t` equals `…'mi'…` value).
  - `demo weather and places`: every demo race with a start point has weather with `prov: false`; none without one has weather; every demo place is `'<word>, CO'` with `<word>` from the invented-word list.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Demo weather comes from the demo's seeded random numbers (plausible ranges, no requests); demo places are one invented town per demo start point.
- [ ] **Step 4: Data counts** (counts only, never names): "Race weather: W of N races with a start point" plus ", P provisional" when P > 0; "Place names: K of V start points named", or "Lookups off".
- [ ] **Step 5: Run** `node scripts/stamp-version.mjs 25`, `node --test`. Expected: all pass.
- [ ] **Step 6: Commit**: "Join weather and places to races; demo weather".

### Task 5: Weather and places on the pages

**Files:**
- Modify: `js/races-view.js` (rows), `js/race-view.js` (clock line, stats, weather section, other years), `styles.css`, `index.html` (stamp 26), `tests/race-view.test.js`

**Interfaces:**
- Consumes: Task 4's `row.wx`, `row.place`; Task 1's `fmtTemp`, `skyText`, `weatherLines`.
- Produces: `weatherState(r): 'none' | 'pending' | 'ok'` exported from `js/race-view.js` (`'none'` without `ll`, `'pending'` with `ll` and no `wx`).

- [ ] **Step 1: Write the failing test** `weatherState follows the start point and the cache`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**, as the spec's "Views" lists:
  - Rows mode: the meta line gains ` · 50°F Clear` (temperature and sky word) when `wx` is there. Routes mode unchanged.
  - Race clock: `when(r)` then ` · <place>` when `place` is there.
  - Stats: a fourth stat "Temperature" (`fmtTemp` or `–`); `.race-stats` becomes 2 × 2 under 480 px, 4 across above.
  - "Race-day weather" section after splits: `weatherLines` as a `dl.kv`; `'pending'` → "Weather not available yet"; `'none'` → "No weather"; when `wx.prov`, a note "Provisional: final figures arrive about a week after the race." Credit line "Weather data by Open-Meteo.com".
  - Same race, other years: each row's meta adds ` · <temp>` when that year has weather.
- [ ] **Step 4: Run** `node scripts/stamp-version.mjs 26`, `node --test`. Browser, `?demo` at 375, 768 and 1280: rows show temperatures, a race page shows place, four stats, the weather section, other years with temperatures; switching Units to kilometres shows °C and km/h without a reload or request; a no-GPS demo race shows "No weather". Screenshots of 375 and 1280 race pages in the workspace.
- [ ] **Step 5: Commit**: "Show race-day weather and place".

### Task 6: Map tiles, the Legends map and the Map switch

**Stop first:** ask the owner to paste the CARTO key (restricted to the site address). Do not continue without it. Before committing it, fetch one tile twice with curl, once with `Referer: https://carpe-canem.github.io/` (what the page's referrer policy sends) and once with no Referer, plus one with no key: the first must be a real tile and differ in size and hash from the keyless placeholder. If it matches the placeholder, the restriction does not accept the origin-only referrer: stop and tell the owner (Review Focus 1).

**Files:**
- Create: `js/map-tiles.js`, `tests/map-tiles.test.js`
- Modify: `js/legends-view.js` (`renderMap`), `js/data-view.js` (Map switch), `js/main.js` (header, wipe already removes `K.map`), `styles.css`, `index.html` (CSP `img-src`, footer, stamp 27), `tests/versions.test.js`, `README.md`

**Interfaces:**
- Produces, `js/map-tiles.js`:
  - `CARTO_KEY: string` (the owner's key), `CARTO_HOST = 'carpe-canem.github.io'`
  - `mapSource(host: string, pref: 'carto'|'osm'|null, key: string): 'carto'|'osm'` (pure, ruling 6)
  - `tileSpec(source, key): {base: {url, className}, labels: {url, className} | null, attribution: string}` (pure)
  - `currentSource(): 'carto'|'osm'` (reads `location.hostname`, `lw.map`, `CARTO_KEY`), `setMapPref(p)`
  - `addTiles(map): void` (Leaflet: creates pane `labels` at z-index 460 with `pointer-events: none` when the spec has labels, adds both layers)

- [ ] **Step 1: Write the failing tests:**
  - `mapSource picks CARTO only on the site's host with a key, and the browser's choice wins`: `('carpe-canem.github.io', null, 'k')` → carto; `('localhost', null, 'k')` → osm; `(CARTO_HOST, null, '')` → osm; `('localhost', 'carto', 'k')` → carto; `(CARTO_HOST, 'osm', 'k')` → osm; `(…, 'carto', '')` → osm.
  - `tileSpec for CARTO is the navy recipe`: base `https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png?key=k` class `map-carto`; labels `…/dark_only_labels/{z}/{x}/{y}{r}.png?key=k` class `map-labels`; attribution contains `OpenStreetMap` and `CARTO`. `tileSpec('osm')`: base `https://tile.openstreetmap.org/{z}/{x}/{y}.png` class `map-navy`, labels `null`.
  - The key is URL-encoded in the tile address.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `js/map-tiles.js`.** CSS: `.map-carto { filter: sepia(.85) hue-rotate(183deg) saturate(1.25) brightness(.9); }` and `.map-labels { filter: brightness(1.25); }`; keep `.map-navy` as it is.
- [ ] **Step 4: Legends.** `renderMap` builds its tiles with `addTiles(S.map)`; segment lines stay in the overlay pane, under the labels.
- [ ] **Step 5: Map switch on Data**, below Place lookups: radios "CARTO" and "OpenStreetMap", the current source checked, focus kept on the chosen radio after the redraw as Units does. Note: "CARTO's map works only on this site's own address. Switch to OpenStreetMap if the map shows 'API key required'." Changing it calls `setMapPref`, removes `S.map` (`S.map.remove(); S.map = null`) and any race map (Task 7 adds that call), then redraws.
- [ ] **Step 6: Hosts.** `img-src` gains `https://basemaps.cartocdn.com`; update the expected CSP. Footer: "Map tiles © CARTO." next to the OpenStreetMap credit. README Privacy and the `main.js` header name `basemaps.cartocdn.com`: tile requests for the area shown, the site's address and the public key; README also says the key is public by design and restricted to the site's address.
- [ ] **Step 7: Run** `node scripts/stamp-version.mjs 27`, `node --test`. Browser at `localhost` (OpenStreetMap by default): Legends map draws; the Map switch to CARTO on localhost shows CARTO's placeholder tiles (expected off the site's host) and back to OpenStreetMap redraws cleanly. Confirm the diff holds no secret other than the CARTO key.
- [ ] **Step 8: Commit**: "CARTO navy map tiles for Legends, with a Map switch".

### Task 7: The course map on the race page

**Files:**
- Create: `js/race-map.js`, `tests/race-map.test.js`
- Modify: `js/race-view.js` (`course()`), `js/main.js` (`wipe`, `exitDemo` call `dropCourseMap()`), `js/data-view.js` (Map switch calls `dropCourseMap()`), `styles.css`, `index.html` (stamp 28)

**Interfaces:**
- Consumes: Task 6's `addTiles`; `routeTile` from `js/race-draw.js`.
- Produces, `js/race-map.js`:
  - `courseLayers(pts, colour): LayerSpec[]` (pure; drawn in this order): glow line `{kind: 'line', weight: 9, opacity: 0.22, colour}`, line `{kind: 'line', weight: 3.5, opacity: 1, colour}`, finish `{kind: 'dot', at: last, radius: 5, fill: '#FF7373'}`, start `{kind: 'ring', at: first, radius: 6, stroke: '#35D69B', fill: '#04070D'}`.
  - `STATIC: object` (Leaflet options: `zoomControl, dragging, touchZoom, scrollWheelZoom, doubleClickZoom, boxZoom, keyboard` all false, `tap: false`)
  - `canMap(L, pts): boolean` (pure: Leaflet loaded and at least 2 points; otherwise the page keeps the SVG route tile)
  - `courseMap(r): Element` (DOM + Leaflet), `dropCourseMap(): void`

- [ ] **Step 1: Write the failing tests:** `courseLayers draws the glow, the line, the finish, then the start last, in the class colour`; `STATIC turns off every way to pan or zoom`; `canMap needs Leaflet and two points` (`canMap(undefined, pts)`, `canMap({}, [])`, `canMap({}, [[1, 2]])` false; `canMap({}, [[1, 2], [3, 4]])` true).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `courseMap`.** Module state `{id, el, map}`. Same `r.id` as last time → return the same element and `invalidateSize()` on the next frame. Otherwise drop the old map, make `div.course-map`, and create the Leaflet map on the next frame once the element is attached: `STATIC`, `addTiles`, pane `route` at z-index 450, layers from `courseLayers` into that pane, `fitBounds` with 16 px padding. An "Expand" button under the map opens a full-screen dialog, appended to `document.body` so the race page's redraws cannot remove it, (`role="dialog"`, `aria-modal="true"`, label "Course map") holding an interactive map with the same tiles and layers and zoom buttons; "Close" and Escape remove it and return focus to Expand; the page behind does not scroll while it is open.
- [ ] **Step 4: Race page.** `course()` shows `courseMap(r)` in place of the 240 px tile when `canMap(window.L, r.pts)`, else the tile as now. The start and finish key, "No GPS for this race" and the elevation chart stay as they are. Thumbnails in lists stay SVG and load no tiles. CSS: `.course-map { height: 260px; }` (320 px at 860 px and up), border radius and board background as `#map`; the dialog fills the safe area.
- [ ] **Step 5: Run** `node scripts/stamp-version.mjs 28`, `node --test`. Browser, `?demo` and a `mock.html` sync at 375, 768 and 1280: the map fits the course and does not move under a swipe or wheel; Expand opens, pans and zooms, closes with Escape and Close; during a mock sync's details pass (redraws every 5 races) the open race's map is not rebuilt (no flicker, no console error); another race replaces the map; Back to the list and in again works; no-GPS demo race shows the dashed tile. Screenshots at 375 and 1280.
- [ ] **Step 6: Commit**: "Race course on the navy map, with Expand".

### Task 8: Details-pass failure cap and hand-back

Carry-over parked in phase 2: during a Strava OAuth outage, each remaining race costs a token request.

**Files:**
- Modify: `js/races-sync.js` (`fetchRaceDetails`), `tests/races-sync.test.js`, `index.html` (stamp 29)

- [ ] **Step 1: Write the failing test** `fetchRaceDetails ends the pass after three skipped races in a row and leaves the note`: a fake call answering three `UserError`s, then success → the 4th race is not asked this pass; `S.warn` is the skipped-details sentence; a race read between failures resets the count.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**: count consecutive skips; at 3, stop the loop (saving as now).
- [ ] **Step 4: Run** `node scripts/stamp-version.mjs 29`, `node --test`. Expected: all pass.
- [ ] **Step 5: Commit**: "Stop the race-details pass after three failures in a row".
- [ ] **Step 6: Hand-back to the owner.** Report: test count, commits, the CSP line, and the hosts as the README now states them. Ask for the push, merge and deploy decision. After deploy, the owner checks on the live site: the race map shows CARTO navy tiles with street names (not "API key required"); Legends map the same; weather and town on a few races look right; Data's weather and place counts; the iPhone home-screen app shows the map and Expand.
