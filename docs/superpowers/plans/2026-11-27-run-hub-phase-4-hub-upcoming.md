# Run Hub Phase 4 (Hub and Upcoming) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hub becomes the real front page (countdown to the next race, races summary, latest results, records), and upcoming races arrive from the Strava bio or by hand, show under "Up next", survive a reload and move between devices by export and import.

**Architecture:** Pure rules for bio lines, hand-added races, merging, countdown and export/import live in `js/upcoming.js`. A small store module, `js/upcoming-sync.js`, holds `lw.upcoming.<athleteId>` (hand-added races plus the parsed bio) and reads the bio with one `/athlete` request a day inside `sync()`. Views get merged rows from it and never depend on the race model. An Add race sheet and an export/import panel are new DOM modules.

**Tech Stack:** HTML, CSS, browser ES modules, Node's built-in test runner. No new host, no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-26-hub-and-races-design.md`: "Phasing" item 4, "Views" (Hub, Races' Up next, Data), "Upcoming races", "Storage", decision 5, "Done means". Earlier plans: `docs/superpowers/plans/2026-11-26-run-board-phase-1-shell.md`, `…/2026-11-26-run-hub-phase-2-races.md`, `…/2026-11-27-run-hub-phase-3-enrichment.md`.

## Scope

**In:** bio reader, hand-added races (Add race sheet, Remove), Up next on Races, hub content (Next start countdown, Races card, Legends card as now, Latest results strip, Personal records), export and import on Data, the export offer before leaving, demo upcoming races, README.

**Out:** forecasts for upcoming races (spec non-goal), a page for one upcoming race, weather or maps for upcoming races.

## Rulings made while planning (for the owner to accept)

1. **Storage.** `lw.upcoming.<athleteId>` = `{v: 1, hand: Hand[], bio: Bio | null}`. The spec's table says this key holds hand-added races; it also holds the parsed bio, so a bio race shows at once on load. `Hand = {id, n, date: 'YYYY-MM-DD', time: 'HH:MM' | null, cls, place: string | null, at}`. `Bio = {at, races: {date, n}[], bad: number, none?: true}`; the bio text itself is never stored, only the parsed lines and the count of unreadable ones.
2. **Hand-added races are irreplaceable**, unlike every other cache. A save that fails (storage full or blocked) undoes the change in memory and says so where it was made (the sheet stays open with its error; import and Remove report it). The storage-full sentence `FULL` ("will be fetched again") is never used for them. The bio is refetchable, so its failed save uses `FULL` as other caches do.
3. **Bio read.** One `/athlete` request, after the Legends work and before the race scan, when the stored bio is missing or a day old, and on every "Refresh now". The first sync reuses the `/athlete` answer it already fetches. A rate-limit pause stops the sync as today; any other failure is logged and skipped, keeps the stored bio races, and is retried on the next sync. Only an answer replaces the stored bio. A missing `bio` field stores `{none: true}` and Data says "Strava did not return a bio".
4. **Duplicates.** A bio race and a hand-added race are the same when the dates match and one series key (`seriesKey` from `js/race-rules.js`) equals or contains the other. The hand-added copy is shown, because it can carry a start time and place; removing it brings the bio copy back. So the sheet and import refuse a duplicate of another **hand-added** race only: adding a bio race by hand, to give it a start time and place, is allowed.
11. **Finished hand-added races are pruned** when the store loads (date before today). Data's count, the export and the offer before leaving use the hand rows of `upcomingRows()`, so a race that finishes during a session is not counted either.
5. **Start time** is the browser's local time. Someone who travels to a race in another zone sees the countdown off by the difference; days-only countdowns are unaffected.
6. **"Passed".** A race stays in Up next through its whole date (local), start time or not. With a start time, the countdown shows "Race day" once the start has passed.
7. **Hub sync status.** The top bar already shows sync status and "Refresh now" at every width, so the hub does not repeat them; it keeps its "Data and connection" link. (Spec "Hub" lists both; this is the deviation.)
8. **Hub numbers.** "Age-group podiums" counts finished races with an age-group place of 1, 2 or 3. "Total race distance" is the sum of each race's official distance (GPS distance for class "Other"), in the Units setting.
9. **Leaving.** Both "Forget this browser" and "Disconnect everywhere" offer an export first when hand-added races exist (decision 5). A setup link that replaces a different athlete's connection already asks before wiping; that question gains a sentence about hand-added races. The demo never offers.
10. **Export file.** JSON, `{"app": "Run Hub", "kind": "upcoming", "v": 1, "races": [{n, date, time, cls, place}]}`, pretty-printed. "Download file" appears only outside the home-screen app; copy and paste works everywhere. No CSP change: if Task 6's browser check shows the download blocked, ship copy and paste only and tell the owner, rather than widen the CSP.

## Global Constraints

- **Public repository.** No real race names, places, dates, coordinates, activity IDs, bio text, personal names, e-mail addresses or local paths in any committed file, tests and demo included. Invented names reuse the demo's words (Riverbend, Frostbite, Canyon, Library Hill, Creekside, Orchard, Old Mill, Water Tower, Rail Trail). Do not use the Strava connector tools in Claude, and do not look at the owner's real bio.
- **No `innerHTML` with data.** Build DOM with `h()` and `svg()` from `js/dom.js`. Bio lines, hand-entered names and places, and imported text are data.
- **ES modules, no build step, no new runtime dependency.** Only `js/main.js` touches `document`, `window` or `localStorage` while loading; other modules only inside functions.
- **Time in tests.** Every function that depends on the date or clock takes `today: 'YYYY-MM-DD'` or `now: Date` as a parameter, so tests pass in any time zone. Fixed test dates sit in June 2027, away from any daylight-saving change.
- **Module versions.** Every task that changes a file under `js/` or `styles.css`, or adds a `js/` file, runs `node scripts/stamp-version.mjs <N>`: Task 1 → 31, Task 2 → 32 … Task 6 → 36. `tests/versions.test.js` enforces the map and the hash.
- **CSP unchanged** (`EXPECTED_CSP` in `tests/versions.test.js` stays as it is). No new outside host, so the README's host list, the footer and the `main.js` header stay as they are.
- **Storage.** Every access through `store` in `js/core.js`. New key `lw.upcoming.<athleteId>` only. State `S.upcoming` (in `js/core.js`, initially `null`) is set or cleared at every site that sets `S.raceEnv`: `init`, `enter`, `setDemoRaces`, `exitDemo`, `wipe`.
- **Look.** Phase 1 tokens and class colours. Countdown digits use `led()` with ghosts, like the race clock. Tap targets at least 44 px. Phone tab bar below 860 px, top bar at 860 px and up.
- **Copy fixed by the spec:** "Finished races come in from Strava." for a past date, and "Add race" for every entry point.
- **Owner stop points.** Never push, merge to `main` or deploy without the owner's say. No key or secret is needed in this phase.
- **Local harness.** `mock.html` and `mock-fetch.js` are gitignored and live only in the owner's checkout. Regenerate `mock.html` from `index.html` whenever `index.html` changes (`<script src="mock-fetch.js?n=N"></script>` right before the import map; bump `n`). `.claude/launch.json` has `dashboard-8082`.
- **Console access in browser checks:** `const { S, bus } = await import('./js/core.js')` (the import map gives the page's own instance).
- **Run tests with** `node --test` from the repository root.

## Review Focus

1. **Bio lines that are not quite right**: Windows line breaks, one-digit month or day, an impossible date (`02/30/2027`), a date with no name, an ISO date, extra spaces, emoji, other bio text → good lines become races, date-like bad lines are counted on Data, everything else is ignored, nothing throws. Task 1, `parseBio` tests.
2. **The day of the race and the day after**: a race today with no start time says "Today" and "Race day", never "0 days" or "-1 days"; the next day it is gone from Up next and the hub moves on to the next race. Task 1, `countdown`, `daysText` and `mergeUpcoming` tests.
3. **A failed save of a hand-added race** (storage full or blocked, often in a private window) → the sheet stays open with "This browser couldn't save the race…", nothing half-added appears, and the race is not lost silently on reload. Task 2 `addHand` test, Task 3 browser check.
4. **A bad import**: not JSON, a Strava or other app's export, a huge paste, a race with a 5,000-character name or markup in it, past dates, races already listed → refused or counted with a plain message, shown as text only, nothing stored on refusal. Task 6, `importUpcoming` tests.
5. **Redraws during a sync** (the details pass redraws every 5 races) and the countdown tick → the hub's Latest results strip keeps its sideways scroll, focus stays where it was, an open Add race sheet stays open with what was typed. Task 3 and Task 5 browser checks during a `mock.html` sync.

---

### Task 1: Upcoming race rules

**Files:**
- Create: `js/upcoming.js`, `tests/upcoming.test.js`
- Modify: `index.html` (stamp 31)

**Interfaces:**
- Consumes: `classify`, `classColour`, `seriesKey`, `STANDARDS` from `js/race-rules.js`.
- Produces, `js/upcoming.js` (pure):
  - `CLASS_OPTIONS: string[]` = the `STANDARDS` classes in order, then `'Other'`.
  - `isoDay(d: Date): 'YYYY-MM-DD'` (local date).
  - `parseBio(text): {races: {date, n}[], bad: number}`.
  - `sameRace(a: {n, date}, b: {n, date}): boolean` (ruling 4).
  - `PAST = 'Finished races come in from Strava.'`, `DUP = 'That race is already in Up next.'`
  - `checkHand(f: {n, date, time, cls, place}, today, existing: {n, date}[]): {race: {n, date, time, cls, place}} | {error: string}` (callers pass the hand-added races only, ruling 4)
  - `mergeUpcoming(up: {hand, bio}, today): Row[]`, `Row = {id, n, date, time, cls, colour, place, src: 'bio' | 'hand'}`.
  - `daysText(row, today): string`; `countdown(row, now: Date): {kind: 'today'} | {kind: 'days', days} | {kind: 'clock', days, hours, mins}`.

- [ ] **Step 1: Write the failing tests** in `tests/upcoming.test.js` (`today = '2027-06-01'`):
  - `parseBio reads MM/DD/YYYY lines and counts date-like lines it cannot read`: the text `'Upcoming Races\r\n-----------------------\r\n06/14/2027 Riverbend 5k\r\n7/9/2027   Frostbite Half Marathon\r\n02/30/2027 Canyon 10K\r\n08/02/2027\r\n2027-08-10 Orchard 10K\r\n26.2 miles is next\r\nRunning since 2015 🏃'` → `races` deep-equals `[{date: '2027-06-14', n: 'Riverbend 5k'}, {date: '2027-07-09', n: 'Frostbite Half Marathon'}]`, `bad` is 3. `parseBio('')`, `parseBio(null)` → `{races: [], bad: 0}`. A line is date-like when it starts with `\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}` (so "26.2 miles is next" is ignored, not counted); names are trimmed, inner spaces collapsed, cut to 80 characters.
  - `sameRace matches the same date and an equal or contained series key`: `Riverbend 5k` vs `Riverbend 5K Fun Run` on one date → true; on different dates → false; `Riverbend 5k` vs `Orchard 5k` → false.
  - `checkHand accepts a future race and fills the class from the name`: `{n: '  Orchard   10K ', date: '2027-06-20', time: '', cls: '', place: ''}` → `{race: {n: 'Orchard 10K', date: '2027-06-20', time: null, cls: '10K', place: null}}`; an explicit `cls: 'Half'` is kept; a name with no distance and `cls: ''` → `'Other'`.
  - `checkHand refuses with the exact sentence`: empty name → `'Enter the race name.'`; name over 80 characters → `'Keep the name to 80 characters.'`; `date: ''` or `'2027-02-30'` → `'Enter the race date.'`; `'2027-05-31'` → `PAST`; today is accepted; `time: '25:00'` → `'Enter the start time as hours and minutes, or leave it empty.'`; `cls: 'Ultra'` → `'Choose a distance from the list.'`; place over 60 → `'Keep the place to 60 characters.'`; same as an `existing` race → `DUP`.
  - `mergeUpcoming drops past races, shows a duplicate once as the hand copy, and sorts by date then time`: bio `[{date: '2027-06-14', n: 'Riverbend 5k'}, {date: '2027-05-30', n: 'Old Mill 10K'}]`, hand `[{id: 'h1', n: 'Riverbend 5K', date: '2027-06-14', time: '08:00', cls: '5K', place: 'Riverbend, CO'}, {id: 'h2', n: 'Library Hill 5K', date: '2027-06-01', time: null, cls: '5K', place: null}]` → ids `['h2', 'h1']`, `h1.src` `'hand'`, `colour` from `classColour`. A bio-only race gets `src: 'bio'`, `time: null`, `place: null`, `cls` from `classify(n, 0)`, and an id starting `bio-` that is the same on every call. `bio: null` works.
  - `daysText`: today → `'Today'`, tomorrow → `'Tomorrow'`, 13 days → `'In 13 days'`.
  - `countdown with a start time counts days, hours and minutes to it`: `now = new Date(2027, 5, 1, 9, 0)`, row `{date: '2027-06-14', time: '08:00'}` → `{kind: 'clock', days: 12, hours: 23, mins: 0}`; the same row without a time → `{kind: 'days', days: 13}`; a row dated today with `'08:00'` (passed) or no time → `{kind: 'today'}`.
  - `isoDay(new Date(2027, 5, 1, 23, 30))` → `'2027-06-01'`.
- [ ] **Step 2: Run** `node --test tests/upcoming.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `js/upcoming.js`** with the signatures above. A calendar date is valid when `Date.UTC(y, m - 1, d)` gives back the same y, m, d. Day differences use `Date.UTC` of the two dates, never local midnights; `countdown` with a time builds the start with `new Date(y, m - 1, d, hh, mm)` and floors days, hours and minutes of the difference.
- [ ] **Step 4: Run** `node scripts/stamp-version.mjs 31`, then `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `js/upcoming.js tests/upcoming.test.js index.html`: "Upcoming race rules: bio lines, hand races, countdown".

### Task 2: Upcoming store, bio read and demo races

**Files:**
- Create: `js/upcoming-sync.js`, `tests/upcoming-sync.test.js`
- Modify: `js/core.js` (`S.upcoming: null`), `js/legends-sync.js` (bio read), `js/main.js` (load and clear sites), `js/races-demo.js` (`demoUpcoming`), `js/data-view.js` (counts), `tests/races-demo.test.js`, `index.html` (stamp 32), `README.md`, `mock-fetch.js` (local only)

**Interfaces:**
- Consumes: Task 1's `parseBio`, `mergeUpcoming`, `isoDay`; `api` from `js/strava.js`; `FULL` from `js/races-sync.js`.
- Produces, `js/upcoming-sync.js`:
  - `emptyUp(): {v: 1, hand: [], bio: null}`, `loadUp(athleteId, today = isoDay(new Date()))` (anything not `v: 1` with a `hand` array → `emptyUp()`; drops hand races dated before `today`, ruling 11), `saveUp(): boolean` (true without writing in the demo or with no athlete)
  - `readBio(athlete, nowMs = Date.now()): void` (ruling 1 and 3; saves; a failed save sets `S.warn = FULL`)
  - `syncBio(manual: boolean, call = api, nowMs = Date.now()): Promise<void>`
  - `addHand(race, nowMs = Date.now()): Hand | null` (null when the save failed; the race is then not in memory either)
  - `removeHand(id): boolean` (false when the save failed; the race is then put back)
  - `upcomingRows(today = isoDay(new Date())): Row[]` (`[]` while `S.upcoming` is null)
  - `NOT_SAVED = "This browser couldn't save the race (its storage is full or blocked), so nothing was added."`
- Produces, `js/races-demo.js`: `demoUpcoming(): {v: 1, hand: [Hand], bio: Bio}`.

- [ ] **Step 1: Write the failing tests** in `tests/upcoming-sync.test.js` (`localStorage` stub as in `tests/races-sync.test.js`, `S.athleteId = 42`, invented bio text):
  - `loadUp falls back to empty for a missing or malformed entry, drops finished hand races, and saveUp round-trips`.
  - `readBio stores the parsed races and the bad-line count, never the bio text`: after `readBio({bio: 'Upcoming Races\n06/14/2027 Riverbend 5k\n13/01/2027 Canyon 10K'}, T)`, `S.upcoming.bio` is `{at: T, races: [{date: '2027-06-14', n: 'Riverbend 5k'}], bad: 1}` and the stored string for `lw.upcoming.42` does not contain `'Upcoming Races'`; a second `readBio` whose bio no longer lists the race leaves `races` empty (the bio is the source of truth).
  - `readBio marks a missing bio field`: `readBio({}, T)` → `{at: T, races: [], bad: 0, none: true}`; `readBio(null, T)` the same.
  - `syncBio asks once a day, and again on Refresh now`: a fake `call` recording paths; stored bio 2 hours old → no call; 25 hours old → one `/athlete` call; 2 hours old with `manual` → one call; `S.upcoming` null or `S.demo` → no call.
  - `syncBio keeps the stored bio races when the request fails, and lets a rate limit through`: a fake call throwing `new UserError('x')` → resolves, `bio` unchanged; throwing `RateLimited` → rejects with it.
  - `addHand stores the race with an id and the time it was added`; `removeHand takes it out and saves`.
  - `a failed save undoes addHand and removeHand`: `setItem` throws → `addHand` returns null and `S.upcoming.hand` is unchanged; `removeHand` returns false and the race is still there; `S.warn` stays null for both.
  - `in the demo, adding and removing change memory only` (no `lw.upcoming.*` written).
  - In `tests/races-demo.test.js`: `demoUpcoming has one bio race and one hand race with a time and place, both ahead of today, named from the demo words`.
- [ ] **Step 2: Run** `node --test tests/upcoming-sync.test.js tests/races-demo.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `js/upcoming-sync.js` and `demoUpcoming`.** Hand ids: `'h' + nowMs.toString(36) + ` four random base-36 characters. Demo: bio race "Riverbend Half Marathon" 40 days ahead; hand race "Orchard 10K" 9 days ahead at `'08:00'`, place `'Orchard, CO'`; dates from `todayIdx()`.
- [ ] **Step 4: Wire it.**
  - `legends-sync.js` `sync()`: where the first sync fetches `/athlete`, also call `readBio(a)`; after `c.lastSync` is saved and before `syncRaces()`, `await syncBio(manual)`.
  - `main.js`: `S.upcoming = loadUp(id)` beside each `loadEnv`; `setDemoRaces` sets `S.upcoming = demoUpcoming()`; `exitDemo` and `wipe` null it; `wipe` deletes `lw.upcoming.<id>`.
  - `data-view.js` `renderData`: two rows outside `raceItems` (which returns early before the race cache loads or when the model failed), in their own `try`, "Upcoming races": `<B> from your Strava bio · <H> added here`, plus `, <bad> bio lines not read` when bad > 0; "Bio last read": `ago(bio.at)`, `'Not yet'` without a bio, `'Strava did not return a bio'` with `none`.
  - README "Refresh and rate limits": the bio is read once a day and on "Refresh now", one request, for upcoming races; only the races found in it are kept.
  - `mock-fetch.js`: `/athlete` answers with `bio` holding two invented races 20 and 50 days ahead (`MM/DD/YYYY` computed from today) and one unreadable line. Regenerate `mock.html`.
- [ ] **Step 5: Run** `node scripts/stamp-version.mjs 32`, `node --test` (all pass). Browser, `mock.html` on `dashboard-8082`, storage cleared: after the first sync `lw.upcoming.42` holds 2 bio races and `bad: 1`, and the network log shows one `/athlete` request; a reload and second sync within the day sends no `/athlete` request; "Refresh now" sends one; Data shows the two new rows; "Forget this browser" leaves no `lw.upcoming.*`. No console errors.
- [ ] **Step 6: Commit** (not `mock-fetch.js`/`mock.html`): "Read upcoming races from the Strava bio once a day; store hand-added races".

### Task 3: Add race sheet

**Files:**
- Create: `js/add-race.js`
- Modify: `index.html` (top-bar button, stamp 33), `js/main.js` (wire the button, close on route change and wipe), `styles.css`

**Interfaces:**
- Consumes: Task 1's `checkHand`, `CLASS_OPTIONS`, `isoDay`; Task 2's `addHand`, `upcomingRows`, `NOT_SAVED`.
- Produces, `js/add-race.js`: `openAddSheet(opener: Element): void`, `closeAddSheet(): void`.

- [ ] **Step 1: Build the sheet**, appended to `document.body` so redraws cannot remove it, with the course dialog's pattern from `js/race-map.js` (`role="dialog"`, `aria-modal="true"`, label "Add race", siblings made `inert`, body scroll locked, Escape and "Cancel" close it and return focus to the opener when it is still in the page). A `form` with: Name (required, `maxlength` 80), Date (`type="date"`, `min` today), Start time (`type="time"`, optional), Distance (`select`: "From the name" with value `''`, then `CLASS_OPTIONS`), Place (optional, `maxlength` 60), an error line (`role="alert"`), and "Add race" (submit) and "Cancel". Focus starts on Name.
- [ ] **Step 2: Submit.** `checkHand(fields, isoDay(new Date()), S.upcoming.hand)`; an error shows in the error line and focus stays in the form. Otherwise `addHand(race)`: null → show `NOT_SAVED` and keep the sheet open with what was typed; a race → close, `bus.emit('data')`, then focus `[data-focus="up-<id>"]` if the page shows it, else the opener if still in the page. The submit button is disabled while a submit runs.
- [ ] **Step 3: Entry point and lifecycle.** `index.html`: `<button type="button" id="addRaceBtn" class="btn small primary wide-only" hidden>Add race</button>` in the top bar after the Data link; `render()` hides it unless connected or in the demo; `.wide-only` is `display: none` below 860 px. `onRoute` (when the view changes) and `wipe` call `closeAddSheet()`. CSS `.sheet`: a bottom sheet on phones (full width, rounded top corners, safe-area bottom padding, scrolls when taller than the screen), a centred 440 px panel at 860 px and up; inputs and select reuse `.connect` input styling at 16 px so iOS does not zoom.
- [ ] **Step 4: Run** `node scripts/stamp-version.mjs 33`, `node --test`. Browser, `?demo` at 375 and 1280, and `mock.html`: the top-bar button opens the sheet (1280 only); a past date shows "Finished races come in from Strava."; a valid race closes the sheet and is in `S.upcoming.hand`; on `mock.html` it is in `lw.upcoming.42` and survives a reload; with `localStorage.setItem` stubbed to throw from the console, submit shows the not-saved sentence and the sheet stays open; Tab stays inside the sheet; Escape returns focus to the button; during a `mock.html` sync an open sheet keeps its typed text through the redraws. No console errors.
- [ ] **Step 5: Commit**: "Add race sheet".

### Task 4: Up next on Races

**Files:**
- Modify: `js/races-view.js`, `js/main.js` (`renderRacePanes`), `styles.css`, `index.html` (stamp 34), `README.md`

**Interfaces:**
- Consumes: Task 1's `daysText`, `isoDay`; Task 2's `upcomingRows`, `removeHand`; Task 3's `openAddSheet`.
- Produces: `renderRaces(model, up: Row[])`; `upNext(up: Row[]): Element` exported from `js/races-view.js` for `main.js`'s failed-model fallback.

- [ ] **Step 1: Up next section**, after the pace trend and before Finished: heading "Up next" and an "Add race" button (`data-focus="up-add"`); one row per race with `data-focus="up-<id>"`: class badge, name, date (`dateText`), start time when there is one, place when there is one, `daysText`, and either "From your Strava bio" (bio races) or a "Remove" button with `aria-label` "Remove <name>" (hand races). Not affected by the distance filter. Empty: "Nothing coming up. Add a race here, or list races in your Strava bio, one per line, as MM/DD/YYYY and the name."
- [ ] **Step 2: Remove.** `window.confirm('Remove “<name>” from Up next?')`; then `removeHand(id)`; false → `window.alert("This browser couldn't save the change, so the race is still listed.")`; then `bus.emit('data')` and focus `up-add`.
- [ ] **Step 3: Up next never depends on the race model.** `renderRaces` draws the title and Up next first, then the existing loading, empty or list content. In `renderRacePanes`, the `pane()` fallback for `view-races` draws the title, `upNext(up)` and then the `racesDown()` note (Up next in its own `try`, so a throw there still leaves the note). `main.js` passes `upcomingRows()`.
- [ ] **Step 4: README.** The "Your races" bullet gains upcoming races: read from the Strava bio (one line per race, `MM/DD/YYYY Name`) or added by hand with "Add race", shown under "Up next" until their date has passed.
- [ ] **Step 5: Run** `node scripts/stamp-version.mjs 34`, `node --test`. Browser, `?demo` at 375, 768 and 1280: both demo upcoming races listed, the bio one without Remove; Remove asks, removes and focuses "Add race"; a chip filter leaves Up next unchanged; on `mock.html` with storage cleared, Up next shows while the race scan is still "Scanning your race history…"; forcing the model to fail (`S.races.races = { x: null }`, then `bus.emit('data')`) still shows Up next above the note; clear storage and reload afterwards, since the next sync would save the broken cache. Screenshot at 375.
- [ ] **Step 6: Commit**: "Up next on Races, with Remove".

### Task 5: Hub content

**Files:**
- Modify: `js/races-model.js` (`hubStats`), `tests/races-model.test.js`, `js/hub.js`, `js/race-view.js` (export `when`), `js/main.js` (pass rows, tick), `styles.css`, `index.html` (stamp 35)

**Interfaces:**
- Consumes: Task 1's `countdown`; Task 2's `upcomingRows`; Task 3's `openAddSheet`; `routeTile` from `js/race-draw.js`; `fmtTime`, `fmtPace` from `js/races-model.js`.
- Produces: `hubStats(model): {count, podiums, metres, latest: Row[], records: Row[]}` (pure; `latest` the 10 newest, `records` one row per class with a record, in `STANDARDS` order then by class name); `renderHub(legends, races, up: Row[])`; `tickHub(up: Row[]): void` (redraws only the countdown digits).

- [ ] **Step 1: Write the failing test** `hubStats counts races, podiums and official distance, and lists the latest ten and the records in class order` (invented races through `buildRaces`: 12 races, places 1, 3, 4 and none; a short-course race; a class "Other" race with GPS distance) → `count` 12, `podiums` 2, `metres` the sum of `official`, `latest` the 10 newest ids, `records` classes in `STANDARDS` order. Also `hubStats` of a model with no rows → zeros and empty lists.
- [ ] **Step 2: Run** `node --test tests/races-model.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `hubStats`.**
- [ ] **Step 4: The hub**, in this order, each section in its own `try` (a throw shows that section's note; the rest draws), as `racesRow` does now:
  - **Next start** (`id="nextStart"`, full width): label "Next start", the first row's name, the date and start time as the race page writes them (export `when(r)` from `js/race-view.js`; rows carry `date` and `time`), then ` · <place>` when known; `countdown`: `'clock'` → three `led` groups with ghosts labelled days, hrs, min and an `aria-label` "<d> days, <h> hours and <m> minutes to the start"; `'days'` → one group labelled days; `'today'` → "Race day". No upcoming race: "Nothing coming up." and an "Add race" button.
  - **Races** card (opens `#races`): `led` count with ghost, sub `<podiums> age-group podiums · <distance> raced` (`fmt0` in the Units setting); the existing loading, failed and "No races yet" states.
  - **Local Legends** card: as now.
  - **Latest results**: `ul.strip`, sideways scroll with scroll snap, up to 10 cards linking `#race/<id>`: route tile 72 px, `led` time, class badge, date. Left out with no races.
  - **Personal records**: grid of tiles linking `#race/<id>`: badge, `led` time, date. Left out with no records.
  - "Data and connection" link, as now.
  - Wide (860 px and up): Next start full width, Races and Legends side by side, then the strip and the records grid full width.
- [ ] **Step 5: Redraws keep the page still.** `renderHub` puts back the strip's `scrollLeft` and the focused element (by `data-focus`, as `renderRacePanes` does) after it redraws. `main.js` runs `tickHub(upcomingRows())` every 30 s while `current().view === 'hub'` and `#dash` is shown. The tick replaces only the countdown digits (`#nextClock`), so focus on the card's links and buttons stays; with nothing upcoming it does nothing, and when the first row's id or countdown kind has changed it asks for a full redraw (`bus.emit('data')`).
- [ ] **Step 6: Run** `node scripts/stamp-version.mjs 35`, `node --test`. Browser, `?demo` at 375, 768 and 1280: the countdown shows days, hours and minutes to the demo's hand race; removing it on Races makes the hub show the bio race in days only; removing every hand race and with no bio (`S.upcoming.bio = null` and a redraw) shows "Nothing coming up." with Add race; a strip card opens the race and Back returns to the hub. On `mock.html` during a sync: scroll the strip sideways, then watch two redraws and one tick: the strip stays where it was and a focused strip card keeps focus. A new athlete with no races (mock with an empty activity list) shows each card's empty state with no console errors. Screenshots at 375 and 1280.
- [ ] **Step 7: Commit**: "Hub: next start countdown, races summary, latest results and records".

### Task 6: Export, import, the offer before leaving, and hand-back

**Files:**
- Create: `js/upcoming-panel.js`
- Modify: `js/upcoming.js` (`exportUpcoming`, `importUpcoming`), `tests/upcoming.test.js`, `js/upcoming-sync.js` (`importHand`), `tests/upcoming-sync.test.js`, `js/data-view.js`, `js/main.js` (`leave`, `useSetup`), `index.html` (`#upPanel`, stamp 36), `styles.css`, `README.md`

**Interfaces:**
- Consumes: Task 1's `checkHand`, `PAST`, `DUP`; Task 2's store.
- Produces:
  - `exportUpcoming(hand: Hand[]): string` (ruling 10; no `id` or `at` in the file)
  - `importUpcoming(text, existing: {n, date}[], today): {add: race[], dup, past, bad} | {error: string}`
  - `importHand(text, today = isoDay(new Date())): {added, dup, past, bad} | {error}` in `js/upcoming-sync.js` (checks against `S.upcoming.hand` only, ruling 4; all-or-nothing: a failed save adds none and returns `{error: NOT_SAVED}`)
  - `renderUpcomingPanel(): void` and `showExport(): void` in `js/upcoming-panel.js`

- [ ] **Step 1: Write the failing tests:**
  - `exportUpcoming then importUpcoming round-trips every field` into an empty list.
  - `importUpcoming refuses what is not a Run Hub export`: `'not json'`, `'{}'`, `JSON.stringify({app: 'Run Hub', kind: 'upcoming', v: 2, races: []})`, an array → `{error: "This isn't a Run Hub races export."}`; text over 200,000 characters or more than 200 races → `{error: 'That is too long to be a Run Hub races export.'}`.
  - `importUpcoming counts duplicates, finished races and unreadable entries`: an export holding one race already in `existing`, one past, one with a 5,000-character name, one with `date: 42`, one good → `add` length 1, `dup` 1, `past` 1, `bad` 2. A name with `<b>` markup in it is kept as plain text. `races: [null, 'x', {n: 5, date: '2027-06-20'}]` → `bad` 3, no throw. The same race twice in one file → added once, `dup` 1.
  - `importHand adds nothing when the save fails` (`setItem` throws) → `{error: NOT_SAVED}`, `hand` unchanged.
  - `importHand accepts a race that is only in the bio` (it is then shown once, as the hand copy, by `mergeUpcoming`).
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions.
- [ ] **Step 4: Data panel** `#upPanel` (after `#linkPanel`, hidden in the demo and when not connected): heading "Races you added"; "<H> added in this browser. They are kept only here. Export them to move them to another browser or the home-screen app." "Export" shows a read-only text box with `exportUpcoming` of the hand rows still ahead and "Copy", plus "Download file" (`run-hub-races.json`, from a `Blob` and an `a[download]`) only when not in the home-screen app (`standalone()` moves from `data-view.js` to this module or is exported). "Import": a text box "Paste an export here", a file input (`accept=".json,application/json"`, read with `file.text()`), and "Import"; the result line (`role="status"`): `Added <a>` then `, <d> already here`, `, <p> already finished`, `, <b> could not be read` for each count above 0, or "Nothing new to add", or the error. The export box is built when asked for and not kept in storage.
- [ ] **Step 5: The offer before leaving.** In `leave()`, before the existing confirm, when not in the demo and `upcomingRows()` has hand rows (H of them): `window.confirm('You added <H> races by hand, and leaving removes them from this browser. Press OK to export them first, or Cancel to continue without exporting.')`; OK → `location.hash = '#data'`, `showExport()`, scroll the panel into view, and stop. In `useSetup`, when replacing a different athlete with hand races present, the existing question adds: "The races you added by hand here will be removed; export them from Data first if you want them."
- [ ] **Step 6: README.** A short "Upcoming races" section: the bio format with invented lines, Add race, that hand-added races live only in that browser, export and import on Data (file where the browser allows it, copy and paste everywhere), and that leaving offers an export first.
- [ ] **Step 7: Run** `node scripts/stamp-version.mjs 36`, `node --test` (all pass). Browser on `mock.html` at 375 and 1280: add two races, Export, Download file saves a JSON file under the page's CSP (if the browser blocks it, remove the button and tell the owner, ruling 10), Copy works; "Forget this browser" offers the export first, and Cancel then OK wipes them; after reconnecting, Import by paste and by file brings both back with "Added 2", a second import says "2 already here", a paste of `{}` shows the refusal; console clean. Confirm the diff holds no real names, dates, bio text or places.
- [ ] **Step 8: Commit**: "Export and import hand-added races; offer an export before leaving".
- [ ] **Step 9: Hand-back to the owner.** Report the test count, the commits, and that the CSP and host list did not change. Ask for the push, merge and deploy decision. After deploy the owner checks on the live site: the hub counts down to the real next race from the bio and its dates match the bio; Data's "bio lines not read" is 0 (or names a line to fix); a hand-added race survives a reload; on the iPhone home-screen app, Add race, the countdown and export by copy and paste work, and an import there brings races over from Safari.

## Done means (from the spec, this phase)

- Opening the site lands on the hub with the next start, races summary, latest results and records, on phone and desktop.
- An upcoming race can be added, survives a reload, drives the countdown, and can be exported and imported.
- Bio races appear without any action, and one deleted from the bio disappears on the next read.
- Legends, Races and the race page work as before.
