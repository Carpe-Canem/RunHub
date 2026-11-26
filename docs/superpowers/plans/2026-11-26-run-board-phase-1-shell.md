# Run Board Phase 1 (Shell and Look) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the one-page Local Legend Watch into the Run Board shell: a field check the owner can run, hash-routed views (Hub, Legends, Data), the dark Finish Clock look, and home-screen app identity, with Legends behaving exactly as before.

**Architecture:** `index.html` becomes a shell whose views are switched by the address hash. `app.js` is split into ES modules loaded directly by the browser, with pure logic kept apart from DOM code so it runs under Node's test runner. No build step and no new runtime dependency.

**Tech Stack:** HTML, CSS, browser ES modules, Leaflet 1.9.4 (already pinned), Node's built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-11-26-hub-and-races-design.md`. This plan covers the spec's phase 1 only. Phases 2 to 4 get their own plans after checkpoint A below reports which Strava fields exist.

## Global Constraints

- **Public repository.** No real race names, places, coordinates, activity IDs, personal names, e-mail addresses or local file paths in any committed file, including tests and demo data. Invent everything.
- **No `innerHTML` with data.** Build DOM with `h()` and `svg()`.
- **ES modules, no build step, no new runtime dependencies.** Only `js/main.js` may touch `document`, `window` or `localStorage` while a module is being loaded; every other module does so only inside functions, so Node can import it.
- **Module imports carry no `?v=` query.** The same module imported under two URLs loads twice. GitHub Pages caches files for 10 minutes, so a browser can hold mixed versions for up to 10 minutes after a deploy. Bump `?v=` on the entry script and stylesheet in `index.html` every task that changes them.
- **Storage keys stay as they are:** `lw.creds`, `lw.token`, `lw.oauthState`, `lw.rate.<clientId>`, `lw.cache.<athleteId>` (cache version `1`). An already-connected browser must stay connected with its cache intact. New in this phase: `lw.probe`.
- **Dark only.** Tokens, exactly: `--night:#0C1424; --panel:#131E35; --bar:#0A1120; --line:#233358; --board:#04070D; --tx:#E6ECF8; --mut:#8D9EC0; --led:#FFB52E; --go:#35D69B; --slow:#FF7373`.
- **Type:** Manrope for text, Doto weight 900 for clock digits, both self-hosted in `fonts/`.
- **Layout:** wide layout from `860px`; tap targets at least `44px`; safe-area insets respected.
- **No new outside host in this phase.** The content security policy at the end of this phase is exactly: `default-src 'none'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://tile.openstreetmap.org https://cdnjs.cloudflare.com; connect-src https://www.strava.com; font-src 'self'; base-uri 'none'; form-action 'none'; manifest-src 'self'`.
- **No Races tab yet.** Navigation shows Hub and Legends only. `#races` and `#race/<id>` fall back to the hub until phase 2.
- **Owner stop points.** Ask before downloading the font files. Show the icon artwork before committing it. Never push, merge to `main` or deploy without the owner saying so; `main` is the live site.
- **Local test harness.** `mock.html` and `mock-fetch.js` are gitignored and exist only in the owner's main checkout. Copy both into any other checkout before using them. `mock.html` is a copy of `index.html` with `<script src="mock-fetch.js"></script>` placed before the app's script tag; regenerate it whenever `index.html` changes. The mock leaves a fake connection in that origin's `localStorage`; clear the `lw.*` keys before opening `index.html` or `?demo` on the same origin, or the page will try the fake token against Strava.
- **Run tests with** `node --test` from the repository root. Serve locally with `python -m http.server 8080`.

## Review Focus

Conditions the spec implies and no feature test would otherwise exercise, most likely first. Each has a test or check in the task named.

1. **Unknown, stale or not-yet-built address** (`#races`, `#race/12`, `#nonsense`, empty) → the hub, never a blank page. Task 3, router tests.
2. **An already-connected browser after the upgrade** → still connected, cache still read. Task 2, `loadCache` test.
3. **Returning from Strava's approval screen** (address carries `?code=`) → the code is removed from the address bar and the hub shows. Task 3, browser check.
4. **Storage blocked or full** → the page still renders and nothing throws. Task 2, `store` test.
5. **The Legends map opened, then left and returned to** → drawn at the right size, not a grey strip. Task 3, browser check.

---

### Task 1: Field check on the current page

Ships alone so the owner can run it before the rest of the phase is built.

**Files:**
- Create: `package.json`, `js/probe.js`, `tests/probe.test.js`
- Modify: `app.js` (import, Data status rows), `index.html` (script tag), `styles.css` (probe table only if needed)

**Interfaces:**
- Produces: `PROBE_FIELDS: {source: 'athlete'|'list'|'activity', field: string}[]` and `probeFields(athlete: object|null, summaries: object[], detail: object|null): ProbeRow[]` where `ProbeRow = {source, field, returned: number, filled: number, of: number}`. Storage key `lw.probe` holds `{at: number, rows: ProbeRow[]}`.

- [ ] **Step 1: Branch and commit what is pending, in the owner's main checkout.** Create branch `run-board` from `main`. Commit the uncommitted home-screen work (`index.html` change, `icon.svg`, `icon-180.png`, `icon-512.png`, `manifest.webmanifest`) as "Add home-screen manifest and icons". Commit `docs/` as "Add hub and races design and phase 1 plan". All later work happens on this branch.

- [ ] **Step 2: Add `package.json`** with exactly `{"private": true, "type": "module", "scripts": {"test": "node --test"}}`.

- [ ] **Step 3: Write the failing test** in `tests/probe.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROBE_FIELDS, probeFields } from '../js/probe.js';

const row = (rows, source, field) => rows.find((r) => r.source === source && r.field === field);

test('counts returned and filled per field', () => {
  const rows = probeFields(
    { id: 1, bio: '' },
    [{ suffer_score: 12, location_city: null, map: { summary_polyline: 'abc' }, workout_type: 1, start_latlng: [1, 2] },
     { location_city: 'Xtown', start_latlng: [] }],
    { description: null, calories: 300 });
  assert.deepEqual(row(rows, 'athlete', 'bio'), { source: 'athlete', field: 'bio', returned: 1, filled: 0, of: 1 });
  assert.deepEqual(row(rows, 'list', 'suffer_score'), { source: 'list', field: 'suffer_score', returned: 1, filled: 1, of: 2 });
  assert.deepEqual(row(rows, 'list', 'location_city'), { source: 'list', field: 'location_city', returned: 2, filled: 1, of: 2 });
  assert.equal(row(rows, 'list', 'start_latlng').filled, 1);            // an empty array is not filled
  assert.equal(row(rows, 'list', 'map.summary_polyline').filled, 1);    // dotted path
  assert.deepEqual(row(rows, 'activity', 'description'), { source: 'activity', field: 'description', returned: 1, filled: 0, of: 1 });
  assert.equal(row(rows, 'activity', 'calories').filled, 1);
});

test('never carries values', () => {
  const text = JSON.stringify(probeFields({ bio: 'secret words' }, [{ location_city: 'Xtown' }], { description: 'private note' }));
  for (const v of ['secret', 'Xtown', 'private']) assert.ok(!text.includes(v));
});

test('missing sources give of: 0 and one row per field', () => {
  const rows = probeFields(null, [], null);
  assert.equal(rows.length, PROBE_FIELDS.length);
  assert.ok(rows.every((r) => r.of === 0 && r.returned === 0 && r.filled === 0));
});
```

- [ ] **Step 4: Run it.** `node --test` → FAIL, cannot find `js/probe.js`.

- [ ] **Step 5: Implement `js/probe.js`.** `PROBE_FIELDS` is, in order: athlete `bio`, `measurement_preference`; list `workout_type`, `start_latlng`, `map.summary_polyline`, `suffer_score`, `pr_count`, `average_heartrate`, `max_heartrate`, `location_city`, `location_state`; activity `description`, `calories`, `splits_standard`, `suffer_score`, `pr_count`, `average_heartrate`, `max_heartrate`. "Returned" means the key exists on the object. "Filled" means the value is not `null`, not `''` and not an empty array.

- [ ] **Step 6: Run it.** `node --test` → PASS, 3 tests.

- [ ] **Step 7: Wire it into the page.**
  - `index.html`: change the app script tag to `<script type="module" src="app.js?v=2"></script>` (modules are deferred by default; keep it after the Leaflet tag).
  - `app.js`: add `import { probeFields } from './js/probe.js';` as the first line. Add `runProbe()`: three requests through the existing `api()`, namely `/athlete`, `/athlete/activities?per_page=30&page=1`, then `/activities/<id>` for the first listed run whose `workout_type` is `1`, else the first listed run, else none. Save `{at, rows}` to `lw.probe` with the guarded `store`; show the rows whether or not the save worked. If a request fails, show the error's message in the panel (for a rate-limit pause: "Paused for Strava's rate limit. Try again at HH:MM.") and keep any earlier result.
  - Data status panel gains, when connected and not in demo: a button "Run field check (3 Strava requests)"; a table with columns Field, From, Result, where Result reads "filled on F of N", "returned but empty" or "not returned"; a "Copy results" button that copies one line per row as `source.field: returned R, filled F of N`; a line "Home-screen app: yes" or "no" from `navigator.standalone === true || matchMedia('(display-mode: standalone)').matches`; and a line "Strava permissions granted:" followed by the stored token's `scope` string, also included in "Copy results".
  - Why `measurement_preference` and the scope line are there: Strava's reference says only a token with `profile:read_all` receives the detailed athlete, and the app asks for `read,activity:read_all`. `measurement_preference` is a detailed-only field, so it is the control: if it and `bio` are both missing, the cause is the permission, not the field.
  - `disconnect()` also deletes `lw.probe`.

- [ ] **Step 8: Check in a browser.** Regenerate `mock.html`, open `http://localhost:8080/mock.html`, wait until the status reads "Synced" (the mock forces one rate-limit pause, which can take up to 15 minutes to clear and blocks every request meanwhile), open Data status, press the button. Expected: a table of 18 rows appears; `athlete.bio` reads "not returned" (the mock athlete has none); `list.workout_type` reads "not returned". Open `http://localhost:8080/?demo`: no button.

- [ ] **Step 9: Commit** "Add field check to Data status".

- [ ] **Step 10: Checkpoint A, owner.** Stop and ask the owner to deploy this branch to `main`. Then the owner:
  1. opens the live site, runs the field check and pastes "Copy results" back;
  2. on the iPhone, adds the site to the home screen and reports (a) whether the home-screen app is already connected or asks to connect again, and (b) whether pressing "Connect with Strava" returns into the home-screen app or into Safari.

  Record the answers in the spec under a new heading "Field probe results" and commit.

  **If `athlete.bio` and `athlete.measurement_preference` are both "not returned":** the bio is not ruled out. Reading it needs the extra Strava permission `profile:read_all`, which changes Strava's approval screen, the README's stated permissions and the spec. Put that choice to the owner; do not add the permission without a yes. Tasks 2 to 6 do not depend on the field results. If sign-in returns into Safari, stop and tell the owner before Task 6: the setup screen then needs an added instruction and the spec needs an amendment.

---

### Task 2: Split `app.js` into modules, behaviour unchanged

**Files:**
- Create: `js/core.js`, `js/dom.js`, `js/strava.js`, `js/legends-model.js`, `js/legends-sync.js`, `js/legends-view.js`, `js/main.js`, `tests/core.test.js`, `tests/legends-model.test.js`
- Delete: `app.js`
- Modify: `index.html` (script tag → `js/main.js?v=3`)

**Interfaces (produces):**
- `js/core.js`: the constants now at the top of `app.js` (`API`, `TOKEN_URL`, `AUTH_URL`, `DEAUTH_URL`, `RUN_TYPES`, `WINDOW`, `REACH_GAP`, `LIMIT_15`, `LIMIT_DAY`, `HOT_MAX_AGE`, `COLD_MAX_AGE`, `MANUAL_MAX_AGE`, `DAY`, `Q`, `K`); `store: {get(k), set(k, v): boolean, del(k)}`; `UserError`, `RateLimited`; the state singleton `S`; `bus: {on(name: 'data'|'status', fn), emit(name)}`; `dayOf`, `todayIdx`, `weekStart`, `dayLabel`, `timeLabel`, `ago`, `fmt1`, `fmt0`, `plural`.
- `js/dom.js`: `$(id)`, `h(tag, props, ...kids): HTMLElement`, `svg(tag, attrs, ...kids): SVGElement` (same contract as `h`, created with the SVG namespace).
- `js/strava.js`: `creds()`, `token()`, `redirectUri()`, `startAuth(clientId)`, `handleCallback(): Promise<boolean>`, `ensureToken(force)`, `rateKey()`, `rateState()`, `api(path): Promise<object|null>`, `revoke(accessToken): Promise<void>`.
- `js/legends-model.js`: `emptyCache()`, `loadCache(athleteId)`, `saveCache()`, `legendCount(L): number|null`, `compute(cache): Model`, `miles(cache)`, `decodePolyline(str): [number, number][]`, `kind(row)`, `statusText(row)`, `demoCache()`, and new `riskSummary(model): {count: number, sub: string, loading: boolean}` holding the wording now inside `renderHeadlines` for the "Titles at risk" card.
- `js/legends-sync.js`: `sync(manual: boolean): Promise<void>`. Where `app.js` called `render()` it emits `bus.emit('data')`; where it called `renderStatus()` it emits `bus.emit('status')`.
- `js/legends-view.js`: `renderLegends(model, mi)`, `renderDataStatus(model, cache)`, `renderMap(model)`, `focusSegment(id)`.
- `js/main.js`: `init()`, `render()`, `renderStatus()`, `wireSetup()`, `startDemo()`, `exitDemo()`, `disconnect()`, `runProbe()`; subscribes `render` to `'data'` and `renderStatus` to `'status'`.

- [ ] **Step 1: Write the failing tests.**

`tests/core.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store, dayOf, plural, bus } from '../js/core.js';

test('dayOf reads the local date and ignores the Z', () => {
  assert.equal(dayOf('2026-03-01T23:30:00Z'), Date.UTC(2026, 2, 1) / 864e5);
  assert.ok(Number.isNaN(dayOf('')));
});
test('plural', () => { assert.equal(plural(1, 'run'), '1 run'); assert.equal(plural(2, 'run'), '2 runs'); });
test('store survives missing or throwing storage', () => {
  delete globalThis.localStorage;
  assert.equal(store.get('x'), null); assert.equal(store.set('x', 1), false);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() {} };
  assert.equal(store.get('x'), null); assert.equal(store.set('x', 1), false);
  delete globalThis.localStorage;
});
test('bus delivers to every listener', () => {
  let n = 0; bus.on('status', () => n++); bus.on('status', () => n++); bus.emit('status');
  assert.equal(n, 2);
});
```

`tests/legends-model.test.js` (uses `todayIdx()` so it holds on any date):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayIdx, DAY } from '../js/core.js';
import { emptyCache, loadCache, legendCount, compute, riskSummary, decodePolyline } from '../js/legends-model.js';

const iso = (daysAgo) => `${new Date((todayIdx() - daysAgo) * DAY).toISOString().slice(0, 10)}T07:00:00Z`;
function fixture() {
  const c = emptyCache(); c.athlete = { id: 42, units: 'mi' };
  const act = (id, daysAgo, v = 'everyone') => { c.acts[id] = { s: 0, d: iso(daysAgo), m: 5000, v }; };
  act('a1', 88); act('a2', 10); act('a3', 5); act('p1', 4, 'only_me');
  c.eff = { held: [[iso(88), 'a1'], [iso(10), 'a2'], [iso(5), 'a3'], [iso(4), 'p1']],
            reach: [[iso(10), 'a2'], [iso(5), 'a3']], behind: [[iso(5), 'a3']], pending: [[iso(5), 'a3']], unknown: [[iso(5), 'a3']] };
  c.seg = { held: { n: 'Held Hill', at: 1, ll: { id: 42, n: 3 } }, reach: { n: 'Reach Ridge', at: 1, ll: { id: 7, n: 4 } },
            behind: { n: 'Far Flat', at: 1, ll: { id: 7, n: 9 } }, pending: { n: 'Pending Path' }, unknown: { n: 'No Legend Lane', at: 1, ll: null } };
  return c;
}
const byId = (m, id) => m.rows.find((r) => r.id === id);

test('compute classifies each segment', () => {
  const m = compute(fixture());
  assert.deepEqual([byId(m, 'held').status, byId(m, 'held').mine, byId(m, 'held').all], ['held', 3, 4]);  // the private run counts in all, not mine
  assert.deepEqual([byId(m, 'held').e7, byId(m, 'held').risk], [1, true]);                                // the 88-day-old effort drops within 7 days
  assert.deepEqual([byId(m, 'reach').status, byId(m, 'reach').gap, byId(m, 'reach').need], ['reach', 2, 3]);
  assert.deepEqual([byId(m, 'behind').status, byId(m, 'behind').gap], ['behind', 8]);
  assert.equal(byId(m, 'pending').status, 'pending'); assert.equal(byId(m, 'unknown').status, 'unknown');
  assert.equal(m.risk.length, 1); assert.equal(m.pending, 1);
});
test('riskSummary wording', () => {
  assert.deepEqual(riskSummary(compute(emptyCache())), { count: 0, sub: 'No public runs on segments in the last 90 days yet', loading: false });
  const s = riskSummary(compute(fixture()));
  assert.equal(s.count, 1); assert.match(s.sub, /^Held Hill loses 1 effort this week/);
});
test('legendCount reads every shape Strava has used', () => {
  assert.equal(legendCount({ effort_counts: { overall: '1,204 efforts' } }), 1204);
  assert.equal(legendCount({ effort_count: '200' }), 200);
  assert.equal(legendCount({ effort_description: '12 efforts' }), 12);
  assert.equal(legendCount({ effort_count: 7 }), 7);
  assert.equal(legendCount({}), null);
});
test('decodePolyline', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});
test('an existing version-1 cache is still read after the upgrade', () => {
  const saved = { ...emptyCache(), lastSync: 123 };
  globalThis.localStorage = { getItem: (k) => (k === 'lw.cache.42' ? JSON.stringify(saved) : null), setItem() {}, removeItem() {} };
  assert.equal(loadCache(42).lastSync, 123);
  assert.equal(loadCache(99).lastSync, 0);
  delete globalThis.localStorage;
});
```

- [ ] **Step 2: Run them.** `node --test` → FAIL, modules not found.

- [ ] **Step 3: Move the code.** Cut each function from `app.js` into the module named above without changing its body, apart from the `bus.emit` replacements, `revoke()` (the fetch to `DEAUTH_URL` now inside `disconnect()`), and `riskSummary()` (extracted; `renderHeadlines` calls it and prints the same text, including the " · N segments still loading" suffix it appends itself). `loading` is true when there are rows and none has a leader count yet. Delete `app.js`. Point `index.html` at `js/main.js?v=3`.

- [ ] **Step 4: Run them.** `node --test` → PASS (3 probe tests plus 9 here).

- [ ] **Step 5: Check behaviour is unchanged.** Regenerate `mock.html` and open it: in the console, the "Held Hill" row shows `window.__mockExpect.mine101` efforts and "Reachable Ridge" shows `mine104` efforts and "2 behind"; the sync passes through a 401 and a 429 and still finishes (the 429 pause can take up to 15 minutes to clear). Open `?demo`: five headline cards, map draws, Defend and Attack tables fill. No console errors in either.

- [ ] **Step 6: Commit** "Split app.js into ES modules".

---

### Task 3: Router, shell and hub

**Files:**
- Create: `js/router.js`, `js/hub.js`, `js/data-view.js`, `tests/router.test.js`
- Modify: `index.html` (shell markup), `js/main.js`, `js/legends-view.js` (Data status moves out), `styles.css` (view and nav layout only; colours come in Task 4)

**Interfaces:**
- Consumes: `riskSummary`, `compute`, `bus`, `h`, `$`, `store`, `probeFields`.
- Produces:
  - `js/router.js`: `VIEWS = ['hub', 'races', 'race', 'legends', 'data']`; `parseHash(hash: string, enabled: string[]): {view: string, id: string|null}`; `routeHref(view: string, id?: string): string`; `startRouter({enabled: string[], onRoute(route, previous)}): void` (listens to `hashchange`, calls `onRoute` once at start); `current(): {view, id}`.
  - `js/hub.js`: `renderHub(model)`.
  - `js/data-view.js`: `renderData(model, cache)` (the former `renderDataStatus` plus the field-check table and buttons from Task 1) and `runProbe()`, moved here from `js/main.js`.
  - `ENABLED = ['hub', 'legends', 'data']` in `js/main.js`. Phase 2 adds `'races'` and `'race'`.

- [ ] **Step 1: Write the failing test** in `tests/router.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, parseHash, routeHref } from '../js/router.js';

const P1 = ['hub', 'legends', 'data'];
test('known views', () => {
  assert.deepEqual(parseHash('#legends', P1), { view: 'legends', id: null });
  assert.deepEqual(parseHash('#data', P1), { view: 'data', id: null });
  assert.deepEqual(parseHash('#race/d12', VIEWS), { view: 'race', id: 'd12' });
});
test('everything else is the hub', () => {
  for (const x of ['', '#', '#hub', '#nonsense', '#LEGENDS', '#legends/5', '#race', '#race/', '#race/a/b', '#race/<x>', '#races', '#race/12'])
    assert.deepEqual(parseHash(x, P1), { view: 'hub', id: null }, x);
  assert.deepEqual(parseHash('#race', VIEWS), { view: 'hub', id: null });   // a race needs an id
});
test('routeHref round-trips', () => {
  assert.equal(routeHref('hub'), '#hub'); assert.equal(routeHref('race', 'd12'), '#race/d12');
  assert.deepEqual(parseHash(routeHref('race', 'd12'), VIEWS), { view: 'race', id: 'd12' });
});
```

- [ ] **Step 2: Run it.** `node --test` → FAIL.

- [ ] **Step 3: Implement `js/router.js`.** Only `race` takes an id, matching `^[A-Za-z0-9_-]{1,32}$`. `startRouter` and `current` are the only parts that touch `location`.

- [ ] **Step 4: Run it.** `node --test` → PASS.

- [ ] **Step 5: Restructure `index.html` into the shell.**
  - Top bar: the name, `<nav id="nav" aria-label="Pages">` holding real links `<a href="#hub">Hub</a>` and `<a href="#legends">Legends</a>`, a "Data" link (`#data`), and the existing status text, progress bar and "Refresh now".
  - `<main>` holds `#setup` (unchanged content) and four siblings: `<section id="view-hub">`, `<section id="view-legends">` (the five headline cards and the Map, Defend, Attack and Mileage panels, with their existing ids), `<section id="view-data">` (the Data status content and Disconnect, with their existing ids), and the demo banner and scope warning above them.
  - Keep every existing element id so `legends-view.js` needs no selector changes.

- [ ] **Step 6: Wire the views in `js/main.js`.**
  - `startRouter({enabled: ENABLED, onRoute})`. `onRoute` shows the one matching section, sets `aria-current="page"` on the matching nav link (none for `data`), saves the leaving view's `window.scrollY` and restores the arriving view's, and calls `render()`.
  - Not connected and not in demo: show `#setup`, hide the nav and all views, whatever the hash says.
  - When `legends` becomes visible and the map exists, call `S.map.invalidateSize()`.
  - `render()` computes the model once and calls `renderHub`, `renderLegends`, `renderData` for the visible view only.
  - Move `renderDataStatus` and the field-check UI into `js/data-view.js` as `renderData`.

- [ ] **Step 7: Implement `js/hub.js`.** `renderHub(model)` fills `#view-hub` with: a heading "Run Board"; one link card to `#legends` titled "Local Legends" showing `riskSummary(model).count` as a two-digit number (`--` while `loading`) and `.sub` beneath; and a link "Data and connection" to `#data`.

- [ ] **Step 8: Check in a browser** (regenerate `mock.html` first).
  - `?demo` opens on the hub; the Local Legends card shows `02` and "Creekside Path North loses 3 efforts and Library Hill loses 1 this week".
  - Links and the back button move between Hub, Legends and Data; scrolling down Legends, visiting the hub and returning restores the position.
  - `?demo#races`, `?demo#race/12` and `?demo#nonsense` each show the hub.
  - Open the map on Legends, go to the hub, return: the map fills its box.
  - `mock.html?code=abc&state=bad#legends`: the query and hash are removed from the address bar and the hub shows (the mock is already connected), not a blank page.
  - Not connected, `#legends`: the setup screen shows and the nav is hidden.

- [ ] **Step 9: Commit** "Add hash router, shell views and hub".

---

### Task 4: The Finish Clock look

**Files:**
- Create: `fonts/manrope-latin.woff2`, `fonts/doto-900-latin.woff2`, `fonts/OFL-Manrope.txt`, `fonts/OFL-Doto.txt`
- Modify: `tests/core.test.js`, `styles.css` (rewritten), `index.html` (CSP, `?v=`), `js/dom.js` (`led`), `js/core.js` (`ghost`), `js/hub.js`, `js/legends-view.js` (colours, map filter)

**Interfaces:**
- Produces: `ghost(text: string): string` in `js/core.js`; `led(text: string, opts?: {ghost?: boolean}): HTMLElement` in `js/dom.js`.

- [ ] **Step 1: Owner stop point.** Ask the owner before downloading: the two font files (Latin subsets, WOFF2, from Google Fonts) and the two licence texts (SIL Open Font License, from the `google/fonts` repository). On yes, save them under the names above.

- [ ] **Step 2: Write the failing test.** Add `ghost` to the import in `tests/core.test.js` and append:

```js
test('ghost turns every digit into 8 and keeps the rest', () => {
  assert.equal(ghost('1:02:33'), '8:88:88'); assert.equal(ghost('07'), '88'); assert.equal(ghost('--'), '--');
});
```

- [ ] **Step 3: Run it → FAIL. Implement `ghost`. Run it → PASS.**

- [ ] **Step 4: Implement `led(text, {ghost})` in `js/dom.js`.** Returns `<span class="led">`. Each `:` becomes `<i class="cn">:</i>` so the character stays in the text. With `ghost`, the span also has class `g` and a first child `<span class="gh" aria-hidden="true">` holding `ghost(text)` built the same way. Text nodes only.

- [ ] **Step 5: Rewrite `styles.css`.**
  - `:root` carries `color-scheme: dark`, the tokens from Global Constraints, `--f: Manrope, system-ui, -apple-system, "Segoe UI", sans-serif` and `--fl: Doto, "Courier New", monospace`. Remove the light palette and the `prefers-color-scheme` block.
  - `@font-face` for both fonts, `font-display: swap`; Manrope declared as a weight range `400 800`.
  - Clock digits: `.led { font-family: var(--fl); font-weight: 900; color: var(--led); line-height: 1; text-shadow: 0 0 10px #FFB52E55 }`. Colon: `.cn { display: inline-block; width: .4em; height: .7em; overflow: hidden; color: transparent; text-shadow: none; font-style: normal; background: linear-gradient(var(--led), var(--led)) 50% 24% / .17em .17em no-repeat, linear-gradient(var(--led), var(--led)) 50% 76% / .17em .17em no-repeat }`. Ghost: `.led.g { position: relative; display: inline-block } .led .gh { position: absolute; left: 0; top: 0; opacity: .13; text-shadow: none; white-space: nowrap }`.
  - Narrow: `#nav` is a fixed bar at the bottom on `--bar` with a `--line` top border, links stacked icon-less at `min-height: 56px`, padded by `env(safe-area-inset-bottom)`; `main` has matching bottom padding; the top bar is padded by `env(safe-area-inset-top)`. The current link is `--led`.
  - Wide (`min-width: 860px`): `#nav` sits inline in the top bar; the current link has a `--panel` pill.
  - Side gutters `max(16px, env(safe-area-inset-left))` and the same on the right.
  - Cards, panels, tables, buttons, form fields, banners and the setup screen restyled with the tokens. "At risk" uses `--slow`, "within reach" `--led`, "held" `--go`. Primary button is `--led` with text `#1A1200`. Focus ring `2px solid var(--led)`.
  - Leaflet inside the dark shell: `.leaflet-container { background: #0A0F18 }`, attribution on `#04070DCC` with `--mut` text, popups on `--panel` with `--tx` text.
  - `@media (prefers-reduced-motion: reduce)` removes transitions and smooth scrolling.

- [ ] **Step 6: Update the JavaScript that carries colours.**
  - `js/legends-view.js`: map line colours become risk `#FF7373`, reach `#FFB52E`, held `#35D69B`, other `#8D9EC0`; the map legend swatches match. The tile layer gets `className: 'map-navy'`, and `styles.css` defines `.map-navy { filter: grayscale(1) invert(1) brightness(.82) contrast(1.15) sepia(.75) hue-rotate(178deg) saturate(1.5) }`. Tiles still come from `tile.openstreetmap.org`.
  - `js/hub.js`: the Local Legends number is `led(text, {ghost: true})`.
  - `index.html`: add `font-src 'self'` to the content security policy so it matches Global Constraints exactly; bump `?v=`; set `<meta name="theme-color" content="#0C1424">`.

- [ ] **Step 7: Check in a browser** at 390, 768 and 1280 px wide with `?demo` on each of `#hub`, `#legends`, `#data`, and the setup screen (leave the demo). Expected: no horizontal scrolling; nothing unstyled or light-coloured; fonts load from `fonts/` with no console CSP errors; clock digits show square-dot colons; the tab bar is at the bottom below 860 px and in the top bar from 860 px; the Legends map is navy with readable street names and the four line colours distinguishable.

- [ ] **Step 8: Commit** "Apply Finish Clock look".

---

### Task 5: App identity

**Files:**
- Modify: `manifest.webmanifest`, `icon.svg`, `icon-180.png`, `icon-512.png`, `index.html` (title, meta), `README.md`, `js/main.js` header comment

- [ ] **Step 1: Manifest.** `name` and `short_name` "Run Board"; `start_url` "./"; `display` "standalone"; `background_color` and `theme_color` `#0C1424`; the same three icon entries.

- [ ] **Step 2: Head of `index.html`.** Title "Run Board". Viewport `width=device-width, initial-scale=1, viewport-fit=cover`. Add `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, `<meta name="apple-mobile-web-app-title" content="Run Board">`. Description: "A personal running board: Local Legend titles to defend and chase, and your mileage against your normal."

- [ ] **Step 3: Icons.** Draw `icon.svg` (512 viewBox): a `--board` rounded square with a `--line` inner border and a finish-clock motif in `--led`, legible at 60 px. Render `icon-180.png` and `icon-512.png` from it with a headless browser screenshot of the SVG at exactly those pixel sizes. **Owner stop point:** show the owner the 180 px render before committing.

- [ ] **Step 4: Words.** README: rename to Run Board, describe the hub and that Legends is one of its pages, keep every privacy statement and the Strava setup steps as they are (no host changed in this phase). `js/main.js` header comment: same statement of destinations as the old `app.js` header. Footer unchanged.

- [ ] **Step 5: Check.** `?demo` in a browser: the tab title is "Run Board"; the manifest loads without console errors; the icon shows in the tab.

- [ ] **Step 6: Commit** "Rename to Run Board and refresh app identity".

---

### Task 6: Final checks and hand-back

- [ ] **Step 1:** `node --test` → all pass.
- [ ] **Step 2:** Repeat the browser checks from Task 2 Step 5, Task 3 Step 8 and Task 4 Step 7 on the finished branch.
- [ ] **Step 3: Scan the branch for real data.** Search every changed file for activity IDs (runs of 9 or more digits), coordinates (two-digit numbers with four or more decimals), personal names, e-mail addresses and local paths (`Users`, drive letters). Expected: none beyond Leaflet's integrity hashes and the invented fixtures.
- [ ] **Step 4:** Confirm `index.html`'s content security policy equals the string in Global Constraints, character for character.
- [ ] **Step 5: Checkpoint B, owner.** Report what was built and verified, and ask the owner whether to deploy. After a deploy the owner removes the home-screen app and adds it again (iOS keeps the old name and icon otherwise; this may mean connecting again), then confirms on the iPhone: the home-screen app opens on the hub, the tab bar clears the home indicator, and Legends shows the same numbers as before.
