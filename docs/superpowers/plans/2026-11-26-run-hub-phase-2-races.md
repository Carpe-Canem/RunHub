# Run Hub Phase 2 (Races) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every run flagged as a race in Strava appears in a Races list and on its own race page, with distance class, official distance, time, pace, records, other years, splits, elevation and a bare route trace, using the athlete's whole history.

**Architecture:** Races get their own cache (`lw.races.<id>`, `lw.raceDet.<id>`), filled by a resumable full-history scan that runs after the Legends work in the existing `sync()`, then kept current from the activity lists Legends already fetches. Pure rules (distance class, series key, age-group place) and the race model live apart from DOM code and run under `node --test`. Two new hash views, `#races` and `#race/<id>`, join the existing shell.

**Tech Stack:** HTML, CSS, browser ES modules, SVG, Leaflet 1.9.4 (unchanged, Legends only), Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-26-hub-and-races-design.md`, phase 2 of "Phasing". Phase 1 plan: `docs/superpowers/plans/2026-11-26-run-board-phase-1-shell.md`.

## Scope

**In:** module versioning (from the phase 1 review), units setting, race rules, race model, race cache and scan, race details and elevation, demo races, Races list (chips, pace trend, finished by year, Rows/Routes), race page (clock, context line, stats, tags, route trace, elevation, splits, other years, From Strava), wide side-by-side layout, Races tab, a Races row on the hub, Data additions.

**Out:** weather, place names, the CARTO map and the Legends map change (phase 3); Up next, Add race, the bio reader, export and import, the hub's Races card with podiums, personal-record tiles, latest-results strip and countdown (phase 4). The race page shows no temperature in this phase; the "temperature" stat and weather tag arrive in phase 3.

**For the owner at plan review:** the pace trend chart and the Rows/Routes list modes are in the spec's Races view but not named in its phasing line. This plan includes both. Say if either should wait.

## Global Constraints

- **Public repository.** No real race names, places, coordinates, activity IDs, personal names, e-mail addresses or local paths in any committed file, tests and demo data included. Invented names reuse the spec's style ("Riverbend 10K", "Frostbite 5 Miler"). Do not use the Strava connector tools in Claude for any of this work.
- **No `innerHTML` with data.** Build DOM with `h()` and `svg()` from `js/dom.js`.
- **ES modules, no build step, no new runtime dependency.** Only `js/main.js` touches `document`, `window` or `localStorage` while loading; other modules do so only inside functions.
- **Module versions (replaces phase 1's "no `?v=` on imports").** Modules import each other as `./name.js` with no query. `index.html` carries an import map that maps every `./js/<file>.js` to `./js/<file>.js?v=<V>`, with one `<V>` shared by the map, the entry script tag and the stylesheet. Bump `<V>` in every task that changes a file under `js/` or `styles.css`. Task 1 adds a test that enforces this.
- **Content security policy:** phase 1's string with one addition, the import map's hash in `script-src`: `default-src 'none'; script-src 'self' 'sha256-<hash of the import map>' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://tile.openstreetmap.org https://cdnjs.cloudflare.com; connect-src https://www.strava.com; font-src 'self'; base-uri 'none'; form-action 'none'; manifest-src 'self'`. No new outside host. The hash changes with every version bump; the Task 1 test checks it.
- **Storage.** Unchanged: `lw.creds`, `lw.token`, `lw.oauthState`, `lw.rate.<clientId>`, `lw.cache.<athleteId>` (v 1), `lw.probe`. New: `lw.races.<athleteId>`, `lw.raceDet.<athleteId>`, `lw.ui`, `lw.units`. Both "Forget this browser" and "Disconnect everywhere" remove all of them.
- **Rate limit.** Every Strava call goes through `api()` in `js/strava.js`. Within a sync: Legends work first (`syncActivities`, `syncDetails`, `syncLeaders`), then the race scan, then race details. A `RateLimited` pause restarts `sync()` from the top on resume, so every race step must be safe to re-run.
- **Legends unchanged.** Its counts, prune (`a.s < floor` in `syncActivities`) and cache format do not change. Races never live in `lw.cache.*` and are never pruned by that rule.
- **Dates.** Race day, year and start time come from the `start_date_local` string (`slice(0, 10)`, `slice(0, 4)`, `slice(11, 16)`), never from a `Date` in the browser's time zone.
- **Look.** Phase 1 tokens. Class colours, exactly: `1 mi #FF7EB6`, `5K #5CB8FF`, `5 mi #4FD1C5`, `10K #35D69B`, `Half #FF9A5C`, `Marathon #FFD166`, any other class `#B3A6FF`. Clock digits through `led()`. Wide layout from `860px`; tap targets at least `44px`.
- **Owner stop points.** Never push, merge to `main` or deploy without the owner saying so. `main` is the live site.
- **Local harness.** `mock.html` and `mock-fetch.js` are gitignored and live only in the owner's main checkout; regenerate `mock.html` from `index.html` whenever `index.html` changes (add `<script src="mock-fetch.js?n=N"></script>` before the import map and bump `n` to beat the cache). Task 4 extends `mock-fetch.js` with races. Port 8080 may be held by another session; `.claude/launch.json` has `dashboard-8082`.
- **Run tests with** `node --test` from the repository root.

## Review Focus

1. **A race address that is not in the cache** (`#race/123` from an old link, a race un-flagged since, or opened before the scan finished) → a message and a link to Races, never a blank page; Back still works. Task 7, browser check.
2. **Zero or missing distance** (treadmill race with no distance, a name with no distance) → pace shows "–", never `Infinity` or `NaN`, and the race is not short. Task 3, `buildRaces` test.
3. **Name-parsing traps** ("10 Miler" vs "1 mile", "Half Marathon" vs "Marathon", "50K", "2025" in a name, a name that disagrees with GPS, "5 Kids Dash") → the class the spec's rules give. Task 2, `classify` tests.
4. **Storage full** → race details are dropped before race summaries, the existing warning shows, nothing throws. Task 4, `saveRaces` test.
5. **A race just after midnight or on 1 January in another time zone** → its year group and date are those of `start_date_local`. Task 3, `buildRaces` test.

---

### Task 1: Versioned modules and the units setting

**Files:**
- Create: `tests/versions.test.js`
- Modify: `index.html` (import map, CSP hash, `?v=11`), `js/core.js` (units), `js/legends-model.js` (`miles`), `js/data-view.js` (units control), `js/main.js` (`wipe`), `tests/core.test.js`, `tests/legends-model.test.js`

**Interfaces:**
- Produces: `UNIT_M: {mi: 1609.344, km: 1000}`; `units(): 'mi'|'km'` (reads `lw.units`, anything else is `'mi'`); `setUnits(u: 'mi'|'km'): boolean`; `K.units = 'lw.units'`, `K.ui = 'lw.ui'`. `miles(c)` reads `units()` and ignores `c.athlete.units`.

- [ ] **Step 1: Write the failing tests.** `tests/versions.test.js` reads `index.html` and `js/`:
  - `every module is in the import map at the entry script's version`: the `<script type="importmap">` JSON has `imports` with exactly one key per file in `js/`, `./js/<f>` → `./js/<f>?v=<V>`, where `<V>` is the `v` on `js/main.js?v=` and on `styles.css?v=`.
  - `the import map comes before the entry script`.
  - `the CSP allows the import map by hash`: `script-src` contains `'sha256-' + base64(sha256(the map's text content exactly))` (Node `crypto`).
  - `the CSP is phase 1's plus the hash`: removing that one token gives phase 1's string.
  - In `tests/core.test.js`: `units() is 'mi' by default and for junk, 'km' after setUnits('km')`; `setUnits('yards')` returns false and leaves `'mi'`.
  - In `tests/legends-model.test.js`: `miles() follows the units setting`: a 5000 m run today gives `today` 5 with `unit` `'km'` after `setUnits('km')`, about 3.107 with `'mi'`, whatever `c.athlete.units` says.
- [ ] **Step 2:** `node --test` → the new tests FAIL.
- [ ] **Step 3: Implement.** Add the import map and hash to `index.html`, set `<V>` to `11` everywhere. Add the units functions to `js/core.js`. Change `miles()`. On Data, a "Units" row with two radio buttons, "Miles" and "Kilometres", that calls `setUnits` and `bus.emit('data')`. `wipe()` also deletes `lw.units` and `lw.ui`.
- [ ] **Step 4:** `node --test` → all pass.
- [ ] **Step 5: Browser check** (`?demo` and `mock.html`): no console errors; DevTools network shows every `js/*.js` fetched with `?v=11` and none without; Legends mileage changes to km and back from Data.
- [ ] **Step 6: Commit** "Version module imports and add a units setting".

### Task 2: Race rules

**Files:**
- Create: `js/race-rules.js`, `tests/race-rules.test.js`

**Interfaces:**
- Produces:
  - `STANDARDS: {cls: string, m: number}[]`, in this order: `1 mi 1609.344`, `5K 5000`, `5 mi 8046.72`, `10K 10000`, `15K 15000`, `10 mi 16093.44`, `Half 21097.5`, `Marathon 42195`.
  - `classColour(cls: string): string`, from the Global Constraints colours.
  - `classify(name: string, gpsM: number): {cls: string, official: number, from: 'name'|'gps'|'other'}`.
  - `seriesKey(name: string): string`.
  - `agePlace(description: string|null): number|null`.
  - `isVirtual(sportType: string, description: string|null): boolean`.

`classify` follows the spec's five rules in order:
1. kilometres: a number, optional space, then `k`, `km`, `kilometer(s)` or `kilometre(s)` as a whole word;
2. miles: a number, optional space or hyphen, then `mile`, `miles`, `miler` or `mi` as a whole word;
3. `half marathon` → 21097.5 m, otherwise `marathon` → 42195 m.

If the name gives a distance and either `gpsM` is 0 or missing, or it is within 15 % of `gpsM`, use the name. Otherwise use the nearest standard when `gpsM` is within 4.5 % of it (`from: 'gps'`). Otherwise use class `Other` with `official = gpsM` (`from: 'other'`).

Labels:
- a name distance equal to a standard (within 0.5 %) takes that standard's label;
- other kilometre distances are `"<n>K"` (`8K`, `50K`, `21.1K` becomes `Half` by the 0.5 % rule);
- other mile distances are `"<n> mi"`.

- [ ] **Step 1: Write the failing tests**, one `test()` per line:
  - `classify('Riverbend 10K', 10150)` → `{cls: '10K', official: 10000, from: 'name'}`
  - `classify('Frostbite 5 Miler', 8100)` → `{cls: '5 mi', official: 8046.72, from: 'name'}`
  - `classify('Frostbite 10 Miler', 16200).cls` → `'10 mi'`; `classify('Library 1 mile', 1630).cls` → `'1 mi'`
  - `classify('Frostbite Half Marathon', 22530)` → `{cls: 'Half', official: 21097.5, from: 'name'}`; `classify('Riverbend Marathon', 42650).cls` → `'Marathon'`
  - `classify('Canyon 50K', 50800)` → `{cls: '50K', official: 50000, from: 'name'}`
  - `classify('2025 Riverbend 10k', 10050).cls` → `'10K'` (the year is not a distance)
  - `classify('Turkey Trot', 5020)` → `{cls: '5K', official: 5000, from: 'gps'}`
  - `classify('Riverbend 10K', 5010)` → `{cls: '5K', from: 'gps'}` (name off by more than 15 %, GPS near 5K)
  - `classify('Turkey Trot', 6400)` → `{cls: 'Other', official: 6400, from: 'other'}`
  - `classify('5 Kids Dash', 1600).cls` → `'1 mi'` ("Kids" is not a kilometre word)
  - `classify('Treadmill 5K', 0)` → `{cls: '5K', official: 5000, from: 'name'}`
  - `classify('', 0)` → `{cls: 'Other', official: 0, from: 'other'}`
  - `seriesKey('2025 Riverbend 10k') === seriesKey('Riverbend 10K 2024') === 'riverbend'`
  - `seriesKey('12th Annual Frostbite 5 Miler')` → `'frostbite'`; `seriesKey('Frostbite Half Marathon!')` → `'frostbite'`
  - `agePlace('3rd in age group')` → 3; `agePlace('1st AG, 12th overall')` → 1; `agePlace('2nd in my age group (M40-44)')` → 2; `agePlace('45th overall')` → `null`; `agePlace(null)` → `null`
  - `isVirtual('VirtualRun', null)` → true; `isVirtual('Run', 'Virtual edition this year')` → true; `isVirtual('Run', 'Virtually flat course')` → false
  - `classColour('10K')` → `'#35D69B'`; `classColour('50K')` → `'#B3A6FF'`
- [ ] **Step 2:** `node --test tests/race-rules.test.js` → FAIL (module not found).
- [ ] **Step 3: Implement** `js/race-rules.js`. Pure, imports nothing.
- [ ] **Step 4:** `node --test` → all pass.
- [ ] **Step 5: Commit** "Add race rules: distance class, series key, age-group place".

### Task 3: Race model

**Files:**
- Create: `js/races-model.js`, `tests/races-model.test.js`

**Interfaces:**
- Consumes: Task 2's functions; `UNIT_M`, `RUN_TYPES` from `js/core.js`; `decodePolyline` from `js/legends-model.js`.
- Produces:
  - `isRace(a): boolean`: `RUN_TYPES` includes `a.sport_type || a.type`, and `a.workout_type === 1`.
  - `summaryFrom(a): Summary`, where `Summary = {id: string, n: string, d: string, s: number, t: number, m: number, el: number, ll: [number, number]|null, p: string|null, st: string, se: number|null, pr: number|null, ach: number|null, hr: [number|null, number|null]|null}`. The fields are `start_date_local` → `d`, `elapsed_time` → `t`, `distance` → `m`, `total_elevation_gain` → `el`, `start_latlng` (empty → null) → `ll`, `map.summary_polyline` → `p`, `suffer_score` → `se`, `pr_count` → `pr`, `achievement_count` → `ach`, and `average_heartrate`/`max_heartrate` → `hr`.
  - `detailFrom(a): Detail`, where `Detail = {at: number, ag: number|null, virt: boolean, cal: number|null, sp: {mi: Split[], km: Split[]}}` and `Split = [m, t, elevDiff]`, from `splits_standard` and `splits_metric`. The description itself is not kept.
  - `reduceProfile(distance: number[], altitude: number[], max: number): [number, number][]`: at most `max` points, the first and last kept, evenly spaced by index.
  - `buildRaces(summaries: {[id]: Summary}, details: {[id]: Detail}, unit: 'mi'|'km'): RaceModel`, where `RaceModel = {rows: Race[], byId: {[id]: Race}, records: {[cls]: id}, classes: {cls, count}[]}`. Rows are sorted newest first, and `classes` most-run first, ties in `STANDARDS` order, `Other` last.
  - `Race = Summary & {date, year, time, cls, colour, official, from, pace: number|null, short, virtual, record, gap: number|null, ag, key, others: id[], pts: [lat, lng][]|null, det: Detail|null}`. Here `pace` is seconds per unit, `gap` is seconds slower than the class record, and `others` lists the same class and key, newest first, without itself.
  - `contextLine(race, model): string`.
  - `chips(model): {key: string, label: string, count: number}[]`.
  - `paceTrend(model, cls): {id, date, pace, record}[]`, oldest first, no virtual or short races, and no races with a null pace.
  - `fmtTime(sec): string` ("42:07", "1:02:33"), `fmtPace(secPerUnit, unit): string` ("6:47 /mi", "–" for null), `fmtDist(m, unit): string` ("6.21 mi", "10.00 km").

Rules the tests pin:
- **Short:** `m > 0` and `m < 0.97 * official`.
- **Virtual:** `isVirtual(st, …)` or `det.virt`.
- **Record:** the fastest `t` per class among races that are not short, not virtual and not class `Other`.
- **Context line:** "Personal record"; `"+0:42 off your 10K record"`; "Course ran short"; "Virtual race, not counted for records"; or `""` for `Other`.
- **Chips:** All, then up to four most-run classes other than `Other`, then "Other" covering every remaining race, shown only when its count is above 0.
- **`pts`:** `p ? decodePolyline(p) : (summary.pts || null)`. Demo summaries carry `pts` directly.

- [ ] **Step 1: Write the failing tests** with an invented fixture:
  - three "Riverbend 10K" races in three years (one of them the record);
  - a short "Frostbite 5 Miler" at 7400 m;
  - a `VirtualRun` 5K that is faster than every other 5K;
  - a treadmill "Turkey Trot" with `m: 0`, `p: null`, `ll: null`;
  - a race on `2025-01-01T00:20:00` local whose UTC `start_date` is in 2024.

  The tests:
  - `isRace` is true for `{type: 'Run', workout_type: 1}` and false for `workout_type` 0 or 3, and for a `Ride` with 1.
  - `summaryFrom` maps every field and turns `start_latlng: []` into `null`.
  - `detailFrom` keeps `ag` from a description saying "2nd in age group" and drops the description.
  - `reduceProfile` of 1000 points with max 80 gives 80 points that start and end with the input's first and last.
  - `buildRaces`, records: the Riverbend record row has `record: true` and `gap: null`, and the others have positive gaps; the virtual 5K is not `records['5K']`.
  - `buildRaces`, short: the 5 Miler has `short: true` and no record.
  - `buildRaces`, no distance: the treadmill race has `pace: null`, `short: false` and `pts: null`.
  - `buildRaces`, dates: the New Year race has `year: '2025'` and `date: '2025-01-01'`.
  - `buildRaces`, series: each Riverbend row's `others` lists the other two, newest first.
  - `contextLine` gives "Personal record", `"+0:42 off your 10K record"` (for a race 42 s slower), "Course ran short" and "Virtual race, not counted for records".
  - `chips` starts with All at the total count, and every count adds up.
  - `paceTrend('10K')` has 3 points, oldest first, exactly one with `record: true`.
  - `fmtTime(2527)` → `'42:07'`; `fmtTime(3753)` → `'1:02:33'`; `fmtPace(null, 'mi')` → `'–'`; `fmtPace(407, 'mi')` → `'6:47 /mi'`.
- [ ] **Step 2:** `node --test tests/races-model.test.js` → FAIL.
- [ ] **Step 3: Implement** `js/races-model.js`. Pure: no storage, no DOM.
- [ ] **Step 4:** `node --test` → all pass.
- [ ] **Step 5: Commit** "Add the race model: records, series, pace and context".

### Task 4: Race cache, scan and details

**Files:**
- Create: `js/races-sync.js`, `tests/races-sync.test.js`
- Modify: `js/legends-sync.js` (`sync`, `syncActivities`), `js/core.js` (`S.races`, `S.raceDet`), `js/main.js` (`enter`, `init`, `wipe`), `mock-fetch.js` (gitignored: add about eight invented races to its activity list, with `workout_type: 1`, details and streams)

**Interfaces:**
- Consumes: `isRace`, `summaryFrom`, `detailFrom`, `reduceProfile` (Task 3); `api`, `RateLimited`, `store`, `S`.
- Produces:
  - `emptyRaces(): RaceCache = {v: 1, races: {}, scan: {done: false, started: 0, cursor: 0, seen: []}, lastScan: 0}`.
  - `loadRaces(id): RaceCache` and `loadRaceDet(id): {[id]: Detail & {pr?: [number, number][]}}`. Each starts fresh if the stored value is missing or the wrong version.
  - `saveRaces(): void` and `saveRaceDet(): void`, which write `S.races` and `S.raceDet` and do nothing in demo.
  - `noteListed(rc, list: object[], after: number): void`.
  - `scanHistory(rc, call = api): Promise<void>`.
  - `fetchRaceDetails(rc, rd, call = api, onStep = () => {}): Promise<void>`.
  - `fetchProfile(id, call = api): Promise<[number, number][]|null>`.
  - `rescan(rc): void`.

Behaviour:
- **`noteListed`.** Upserts `summaryFrom(a)` for every `isRace(a)` in `list`. It deletes any cached race with `s > after` that is not a race in `list`: that race was un-flagged or deleted. The Legends floor never removes a race.
- **`scanHistory`.** Does nothing when `rc.scan.done`. Otherwise it sets `started` to now on first use. It then repeatedly calls `GET /athlete/activities?before=<cursor || started>&per_page=200`. It upserts races, adds their ids to `seen`, sets `cursor` to the oldest `s` in the page plus 1, and saves after every page. It stops when a page has fewer than 200 items or `cursor` did not move. At the end it deletes cached races with `s < started` that are not in `seen`, sets `done: true` and `lastScan`, and clears `seen`. A `RateLimited` thrown midway leaves `cursor` saved, so the next `sync()` continues from it.
- **`rescan`.** Resets `scan` to `{done: false, started: 0, cursor: 0, seen: []}`.
- **`fetchRaceDetails`.** Takes races with no entry in `rd`, newest first. It calls `GET /activities/<id>` and stores `detailFrom(a)`; a 404 (`null`) stores `{at, missing: true}`. It saves every 5 races.
- **`fetchProfile`.** Calls `GET /activities/<id>/streams?keys=altitude,distance&key_by_type=true` and returns `reduceProfile(…, 80)`, or `null` when there is no altitude.
- **`saveRaces` when storage is full.** It deletes `lw.raceDet.<id>`, empties `S.raceDet` and tries again. If that still fails, it sets `S.warn` to the existing storage-full sentence.
- **`saveRaceDet` when storage is full.** It drops every `pr` profile, tries again, then sets `S.warn`.
- **In `legends-sync.js`.** `syncActivities` calls `noteListed(S.races, list, after)` once, with every item it listed across all its pages. That is the raw list, before the run filter, so `Ride`s never become races. `sync()` then calls `scanHistory(S.races)` and `fetchRaceDetails(S.races, S.raceDet, api, …)` after `syncLeaders`. Progress labels are "Scanning your race history" and "Reading race details: N of M", with `bus.emit('data')` after each.
- **In `main.js`.** `enter()` and `init()` load `S.races` and `S.raceDet` next to `S.cache`. `wipe()` deletes `lw.races.<id>` and `lw.raceDet.<id>` and clears both.

- [ ] **Step 1: Write the failing tests.** Use a fake `call(path)` that serves pages from an invented list of 450 activities, 30 of them races, and records the paths it was asked for. Stub `localStorage` as `tests/strava.test.js` does.
  - `scanHistory reads every page with a moving before= cursor and finds all 30 races`: 3 calls, each `before` smaller than the last, `scan.done` true.
  - `scanHistory resumes from its cursor after a rate-limit pause`: the fake throws `RateLimited` on call 2. The second run makes calls 2 and 3 only, and ends with 30 races.
  - `a full rescan removes a race that is no longer flagged`: cache a race id that is not in the list, `rescan`, scan, and the race is gone.
  - `noteListed adds a new race, removes one un-flagged inside the window and keeps one older than after`.
  - `noteListed ignores a Ride with workout_type 1`.
  - `fetchRaceDetails fetches newest first and records a missing activity`.
  - `fetchProfile reduces 1000 stream points to 80`, and returns `null` for streams with no altitude.
  - `saveRaces drops details before summaries when storage is full`: `setItem` throws for any value over N bytes. Summaries are saved, `lw.raceDet.*` is gone, and `S.warn` is unset. Make it fail even then, and `S.warn` is set.
- [ ] **Step 2:** `node --test tests/races-sync.test.js` → FAIL.
- [ ] **Step 3: Implement** `js/races-sync.js`, then wire it into `legends-sync.js` and `main.js`. Keep `syncActivities`' own logic and prune exactly as they are.
- [ ] **Step 4:** `node --test` → all pass, `tests/legends-model.test.js` untouched and green.
- [ ] **Step 5: Browser check (`mock.html`).** Sync finishes. `lw.races.42` holds the mock's races and `lw.raceDet.42` their details. Legends' Held Hill is still 31 and Reachable Ridge 15. The status line shows the race steps after "Checking Local Legend counts". Forget this browser leaves no `lw.*` key.
- [ ] **Step 6: Commit** "Scan the whole race history into its own cache".

### Task 5: Demo races

**Files:**
- Create: `js/races-demo.js`, `tests/races-demo.test.js`
- Modify: `js/main.js` (`startDemo`, `exitDemo`, the `?demo` branch of `init`)

**Interfaces:**
- Consumes: `buildRaces` (Task 3), `todayIdx`, `DAY`.
- Produces: `demoRaces(): {races: RaceCache, det: {[id]: Detail}}`. These are 20 invented races dated relative to today, with `pts` instead of `p`, the start points near the existing demo's segments, splits for both units, and an 80-point `pr` profile on each race that has GPS. `startDemo` and the `?demo` start set `S.races`/`S.raceDet` from it, and `exitDemo` clears them.

- [ ] **Step 1: Write the failing test** `demo races cover every case the spec names`. `buildRaces(demo, 'mi')` has:
  - at least one `record` in each of 5K, 10K and Half;
  - one `short`;
  - one with `pts: null` and `ll: null`;
  - one `virtual`;
  - one series where `others.length === 2`;
  - one class not in `STANDARDS` (for example "Canyon 25K");
  - one `from: 'gps'`;
  - one with `ag` 1 to 3;
  - the newest race within the last 60 days.

  A second test, `demo race names are invented`, checks every name against the allowed words used in the file (Riverbend, Frostbite, Canyon, Library Hill, Turkey Trot, Creekside, Orchard, Old Mill, Water Tower, Rail Trail).
- [ ] **Step 2:** `node --test tests/races-demo.test.js` → FAIL.
- [ ] **Step 3: Implement**, with the same seeded random function style as `demoCache()`.
- [ ] **Step 4:** `node --test` → all pass.
- [ ] **Step 5: Commit** "Add invented demo races".

### Task 6: Races list

**Files:**
- Create: `js/race-draw.js`, `js/races-view.js`, `tests/race-draw.test.js`
- Modify: `index.html` (`<section id="view-races">`, nav item "Races" between Hub and Legends, `?v=` bump), `js/main.js` (`ENABLED` gains `races` and `race`; `render` draws the view), `js/hub.js` (a "Races" row), `styles.css`

**Interfaces:**
- Consumes: `buildRaces`, `chips`, `paceTrend`, `fmtTime`, `fmtPace`, `classColour` (Tasks 2–3); `units()`; `led`, `h`, `svg`.
- Produces:
  - `fitPoints(pts: [lat, lng][], w, h, pad): [x, y][]`. This is an equirectangular projection with longitude scaled by `cos(mean lat)`, keeping the aspect ratio and centred in the box.
  - `routeTile(pts|null, colour, size): SVGElement`. It draws the class-coloured line on a `--board` tile, a `--go` start ring and a `--slow` finish dot. With no points it shows a dashed circle.
  - `paceChart(points, unit): SVGElement`. It has a text label for the first and last year and for the record, and the record is marked.
  - `renderRaces(model): void`.
  - `lw.ui` holds `{mode: 'rows'|'routes', filter: string}`.
  - `renderHub(model, raceModel)`. Its new Races row shows the race count, or "Loading your race history" before the first scan finishes.

The view, top to bottom:
1. Filter chips, each with its count.
2. The pace trend for the selected class. "All" uses the most-run class and says which; "Other" shows no chart.
3. "Finished", grouped by `year` under sticky year headers, ten rows shown, then "Show all (N)".
4. A Rows/Routes toggle. Both the toggle and the filter are remembered in `lw.ui`.

A row shows the route tile, name, class badge, date and `led(fmtTime(t))` with the pace. Routes mode shows larger tiles and the time. Each row is a link to `#race/<id>`.

With no races, the list says "No races yet. Runs you mark as Race in Strava appear here." Before the first scan finishes it says "Scanning your race history…".

- [ ] **Step 1: Write the failing tests** (`tests/race-draw.test.js`, pure part only):
  - `fitPoints` keeps every point inside the box with its padding, and a north–south line stays taller than it is wide;
  - `fitPoints` of a single point puts it in the centre.
- [ ] **Step 2:** `node --test tests/race-draw.test.js` → FAIL.
- [ ] **Step 3: Implement** the draw module, the view, the nav item and the hub row. The race address and its page come in Task 7; until then `#race/<id>` shows the list.
- [ ] **Step 4:** `node --test` → all pass.
- [ ] **Step 5: Browser check (`?demo`, at 375, 768 and 1280).**
  - The nav reads Hub, Races, Legends, with `aria-current` on Races.
  - The chips' counts add up to 20.
  - Choosing 10K shows only 10K races and a chart with the record marked.
  - Rows/Routes switches, and survives a reload.
  - "Show all" reveals the rest.
  - Year headers stick while scrolling.
  - There is no horizontal page scroll and no console error.
  - The hub shows "Races" with 20.
- [ ] **Step 6: Commit** "Add the Races list".

### Task 7: Race page

**Files:**
- Create: `js/race-view.js`
- Modify: `index.html` (`<section id="view-race">`, `?v=` bump), `js/main.js` (draws the race view; on wide screens `#dash` gets class `split` while on `races` or `race`), `js/race-draw.js` (`elevationChart`, `splitsTable`), `styles.css`

**Interfaces:**
- Consumes: `buildRaces`, `contextLine`, `fmt*` (Task 3); `fetchProfile`, `saveRaceDet` (Task 4); `routeTile`, `fitPoints` (Task 6); `units()`, `led`; `current()` from `js/router.js`.
- Produces:
  - `renderRace(model, id, cameFrom: 'hub'|'races'|null): void`.
  - `elevationChart(profile: [m, alt][], unit): SVGElement`, with text labels for the low and high points.
  - `splitsTable(splits: Split[], unit): HTMLElement`, which marks the fastest and slowest full split. A final split shorter than half a unit is never marked.

The page, top to bottom:
1. **Back.** Goes back in history when this session came from `hub` or `races`, otherwise to `#races`.
2. **Clock.** Class badge, the date and start time from `d`, the name, `led(fmtTime(t), {ghost: true})` and `contextLine`.
3. **Stats.** Pace, official distance, climb.
4. **Tags.** Record, age-group place ("3rd in age group"), Virtual, Short course.
5. **Course.** A large `routeTile` with the start and finish, then the elevation chart. Its profile is read from `S.raceDet[id].pr`, or fetched with `fetchProfile` on first open (not in demo) and saved. While loading it reads "Loading elevation…". On `RateLimited` or an error it reads "Elevation not available yet", and the page opens again without it.
6. **Splits.** In the units setting's set (`det.sp.mi` or `det.sp.km`), or "Splits not available yet" before details arrive.
7. **Same race, other years.** Each `others` race with its year, time, pace, and a link.
8. **From Strava.** Relative effort, Strava PRs (or "achievements" from `ach`), GPS distance, average and maximum heart rate, calories, and "View on Strava" (`https://www.strava.com/activities/<id>`, `rel="noopener"`). Rows with no value are left out.

An id that is not in the model shows "This race isn't in your race history." with a link to Races. Before the first scan finishes it shows "Still loading your race history." instead. On wide screens the list stays on the left and the race on the right; `#races` alone shows "Choose a race" on the right.

- [ ] **Step 1: Write the failing tests** (pure part, in `tests/race-draw.test.js`):
  - `markSplits marks fastest and slowest full splits and never the short last one`: `markSplits([[1609, 400, 0], [1609, 380, 0], [1609, 420, 0], [300, 60, 0]], 1609.344)` → `{fastest: 1, slowest: 2}`. `markSplits(splits, unitM): {fastest: number|null, slowest: number|null}` is a pure export of `js/race-draw.js` that `splitsTable` uses; pace per split is `t / m`.
  - `markSplits` of one full split gives `{fastest: null, slowest: null}`.
- [ ] **Step 2:** `node --test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `node --test` → all pass.
- [ ] **Step 5: Browser check (`?demo` at 375 and 1280, and `mock.html`):**
  - The record race reads "Personal record" and a slower one in its series "+m:ss off your … record".
  - The short race reads "Course ran short", and the no-GPS race shows a dashed circle.
  - The series shows two other years that open each other.
  - Back returns to the list at the same scroll position, and to the hub when opened from the hub row.
  - `#race/999999` and `#race/abc` give the message, not a blank page.
  - At 1280 the list and race sit side by side.
  - In `mock.html` the first open fetches one streams request and the second open none.
  - There is no console error and no horizontal scroll.
- [ ] **Step 6: Commit** "Add the race page".

### Task 8: Data additions, final checks and hand-back

**Files:**
- Modify: `js/data-view.js`, `README.md`, `index.html` (`?v=` bump)

**Interfaces:**
- Consumes: `rescan`, `saveRaces` (Task 4); `buildRaces` (Task 3); `sync` (`js/legends-sync.js`).

Data gains three rows and a button:
- **Race history.** "Complete: N races, last full scan <date>", or "Scanning: back to <Month YYYY>" (from `cursor`).
- **Race details.** "N of M read".
- **Races by class.** For example "5K 12 · 10K 8 · Half 4 · Other 3 · 2 classed by GPS distance". This gives counts only, never names, so the owner can check the parser against their own history.
- **"Rescan all history".** Calls `rescan`, saves and `sync(true)`.

The README's description gains Races, and states that race data stays in the browser like the rest.

- [ ] **Step 1: Implement** the Data rows and button and the README lines.
- [ ] **Step 2:** `node --test` → all pass.
- [ ] **Step 3:** Repeat the browser checks of Tasks 4, 6 and 7 on the finished branch. Then the phase 1 regression set: `?demo` hub card "02", Legends 5 cards, a map with 12 lines, 7 defend / 5 attack, and `mock.html` with Held Hill 31 and Reachable Ridge 15.
- [ ] **Step 4: Scan the branch for real data** (as phase 1 Task 6 Step 3). Expected: only invented fixtures and RNG constants.
- [ ] **Step 5:** The CSP equals the Global Constraints string with the current map hash (the Task 1 test passes).
- [ ] **Step 6: Checkpoint C, owner.** Report what was built and verified, and ask whether to merge to `main` and deploy. After a deploy the owner:
  1. opens Data and reads out the "Races by class" line and whether the race history completed, then compares it with what they know of their history;
  2. opens two or three races, including one with a known record and one with other years, and checks the time, class and context line;
  3. checks the same on the iPhone home-screen app.

  Any class the parser got wrong becomes a fix (rule and test) before phase 3 is planned.
