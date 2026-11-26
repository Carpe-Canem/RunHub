# Hub and Races: design

Date: 2026-11-26. Status: approved by the owner on 2026-11-26.

This repository is public. This document contains no real race names, places, times, coordinates or keys, and neither may anything committed after it. Every example below is invented.

## Decisions the owner approved

These began as the builder's proposals. The owner approved all five on 2026-11-26, and separately accepted the Nominatim conditions listed under "Place names".

| # | Decision | Why it was put to the owner |
|---|---|---|
| 1 | The look is "Finish Clock" with route thumbnails in the results list, as in the private mockup. | The owner asked for the mockup and chose a map for it, but never said "this is the one". |
| 2 | The app is called **Run Board**. | The name was invented for the mockup. |
| 3 | Place names ("Riverbend, CO"): first check whether Strava returns them. Only if it does not, use OpenStreetMap's Nominatim lookup, under the conditions in "Place names" below. | Nominatim is a new outside service with a usage policy the owner must read and accept personally. Without it, races show weather and a map but no place name. |
| 4 | The Legends map switches to the same CARTO navy map as the race page. | The owner chose that map for the race page only. |
| 5 | Disconnect also removes races added by hand, after offering an export. | It keeps the existing "wipes this browser" promise literal. |

Answered by the owner on 2026-11-26: the bio format for upcoming races, recorded under "Upcoming races" below.

## Intent

The site today is one page, Local Legend Watch. The owner wants it to become a small personal running app, used mostly from an iPhone home-screen icon and also on a desktop browser:

- a **hub** that opens first and leads to every page, now and as more are added;
- a **Races** page listing every run flagged as a race in Strava, with upcoming races in the same place;
- a **race page** that shows everything known about one race, including the course on a map.

The owner asked for a design that is distinctive rather than generic, and for the top stats on a race to be length, pace, time, and weather and location.

## Goals

- Open on the hub. Reach Races and Legends in one tap.
- Show every race in the athlete's Strava history, not only recent ones.
- For each race show official distance, time, pace, weather and place at a glance, and everything else on its own page.
- Keep upcoming races in the same list, read from the Strava bio when possible and added by hand otherwise.
- Work as a pinned iPhone home-screen app and in a desktop browser, from one codebase.
- Keep the existing promises: no server, the athlete's keys and data stay in the browser, each athlete uses their own Strava API app.

## Non-goals

- Offline use. The page shows cached data instantly but needs a connection to load itself. No service worker in this work.
- Official chip times or results imported from race websites.
- Weather forecasts for upcoming races.
- Activities other than runs.
- Sharing, accounts, or syncing between devices beyond a manual export and import.
- A light theme. The design is dark only.

## Anti-goals

- Any real race data, place name, coordinate or activity ID in the repository, including tests, demo data and docs.
- A new outside service the README and footer do not name.
- Breaking the Legends page or the existing Strava connection for people already using the site.
- Spending the Strava rate limit on race history when Legend counts, which are time-sensitive, are waiting.

## Approaches considered

**A. One page, several views (chosen).** `index.html` becomes a shell. Hub, Races, a race, Legends and Data are views switched by the address hash (`#hub`, `#races`, `#race/<id>`, `#legends`, `#data`). JavaScript is split into ES modules loaded directly by the browser, with no build step.
- For: one Strava sign-in address (the redirect stays `origin + pathname`), one sync loop and one cache in memory, instant switching, and it behaves like an app on the iPhone home screen.
- Against: Legends code must be moved into a view rather than left alone.

**B. Separate pages** (`index.html` hub, `races.html`, `legends.html`) sharing a core script.
- For: Legends stays almost untouched.
- Against: every tap is a full page load, sync restarts on each page, and the home-screen app flashes between pages.

**C. A framework and build step.**
- For: components and routing off the shelf.
- Against: the site is deliberately three static files served by GitHub Pages with a strict content security policy. A build pipeline adds moving parts for a five-view app.

The owner talks in outcomes and has left the how to the builder, so A is the builder's pick.

**Phasing.** The work is split so each phase leaves a working site:

1. **Shell and look.** Hash views, dark theme, fonts, navigation, manifest and icons, setup screen and Legends moved into the shell and restyled. No new data.
2. **Races.** Full-history scan, race cache, distance classes, records, series, results list, race page with a bare route, splits and elevation, demo races.
3. **Enrichment.** Weather, place names, CARTO map on the race page and Legends.
4. **Hub and upcoming.** Hub content, bio reader, add-a-race sheet, export and import, countdown.

Phase 1 starts with a field probe (below), because three later decisions depend on its result.

## The design

Reference: private mockup, owner only, https://claude.ai/artifact/FuBKUcJneWCPdByze5ugr9. It is throwaway code built with `innerHTML`; the product follows this document and the existing code's conventions, not the mockup's source.

### Look

Single dark theme, modelled on a race finish-line clock.

| Token | Value | Use |
|---|---|---|
| `--night` | `#0C1424` | page ground |
| `--panel` | `#131E35` | cards |
| `--bar` | `#0A1120` | tab bar, top bar |
| `--line` | `#233358` | hairlines |
| `--board` | `#04070D` | clock faces, route tiles |
| `--tx` / `--mut` | `#E6ECF8` / `#8D9EC0` | text, secondary text |
| `--led` | `#FFB52E` | clock digits, primary action |
| `--go` / `--slow` | `#35D69B` / `#FF7373` | record and start / off-pace and finish |

Distance classes each have a colour, used for the class badge and the route line: 1 mi `#FF7EB6`, 5K `#5CB8FF`, 5 mi `#4FD1C5`, 10K `#35D69B`, half `#FF9A5C`, marathon `#FFD166`, anything else `#B3A6FF`.

- **Type.** Manrope for text, Doto (weight 900) for clock digits. Both are open-licence fonts and are self-hosted in `fonts/` with their licence files, because the content security policy blocks outside fonts. Downloading the font files in phase 1 needs the owner's OK at that point.
- **Clock digits.** Finish times and the countdown are set in Doto in `--led` with a faint glow. The colon is drawn as two square dots in CSS (Doto's own colon reads as plus signs), with the real ":" kept in the text for screen readers and copying. The large clock on the race page and hub sits over dim "8" ghost digits.
- **Route thumbnails.** Each result carries its course drawn from the Strava polyline as a small SVG line in the class colour on a `--board` tile. A race without GPS shows a dashed circle.

### Layout

- **Phone (narrow).** One view at a time, a three-item tab bar at the bottom (Hub, Races, Legends), safe-area insets respected, tap targets at least 44 px.
- **Desktop (wide).** A top bar with the same three items, sync status and "Add race". Races shows the list and the selected race side by side. The hub uses two columns.
- The breakpoint is the builder's call (the mockup used 700 px inside a frame; around 860 px is likely right for the real page).

### Views

**Hub (`#hub`, the default).**
- "Next start": countdown clock to the next upcoming race, with its name and date. If the race has no start time, show days only. If nothing is upcoming, say so and offer "Add race".
- Races card: number of races, age-group podiums, total race distance. Opens Races.
- Local Legends card: titles at risk this week, from the existing calculation. Opens Legends.
- Latest results: a sideways strip of the ten most recent races (route tile, time, class, date).
- Personal records: one tile per distance class that has a record, opening that race.
- Sync status and "Refresh now", and a link to Data.

**Races (`#races`).**
- Filter chips: All, the athlete's most-run classes (up to four), Other. Each shows its count.
- Pace trend: a small chart of pace over time for the selected class, record marked.
- Up next: upcoming races with date, class, days to go, and "Remove" on hand-added ones.
- Finished: grouped by year under sticky year headers, ten shown at first with "Show all". Two list modes, remembered: **Rows** (thumbnail, name, class, date, weather, time, pace) and **Routes** (larger route tiles).
- "Add race" opens the add sheet.

**Race (`#race/<id>`).**
- Clock: class, date and start time, name, finish time, and one line of context: "Personal record", "+0:42 off your 10K record", or "Course ran short".
- Top stats: pace, distance, climb, temperature. Tags: record, age-group place, virtual, short course.
- Course: map (see Map), start and finish markers, then the elevation profile.
- Splits per mile or kilometre, fastest and slowest marked.
- Same race, other years: each year's time, pace and weather, tappable.
- Race-day weather: temperature, feels like, sky, wind, humidity, precipitation in the start hour.
- From Strava: relative effort, Strava PR count, GPS distance, average and maximum heart rate, calories, and a link to the activity on Strava.
- Back returns to wherever the race was opened from (hub or results), with the list's scroll position restored.

**Legends (`#legends`).** The existing page, unchanged in what it shows and how it counts, restyled with the tokens above. Its map switches to the CARTO navy recipe in phase 3 (decision 4).

**Data (`#data`).** The existing Data status panel and Disconnect, plus: race scan progress, "Rescan all history", export and import of hand-added races, and the field probe results.

**Setup and demo.** The connect screen keeps its flow and wording and takes the new look. `?demo` keeps working and gains invented races (see Testing).

### What counts as a race

A run (`Run`, `TrailRun`, `VirtualRun`) whose Strava `workout_type` is `1`. Nothing else is inferred.

### Derived values

All computed in the browser from Strava fields; none is stored at Strava.

- **Distance class and official distance.** GPS distance is unreliable (a marathon can log 26.5 miles), so take the distance from the name:
  1. a number followed by `k` → that many kilometres (`Riverbend 10K` → 10 km);
  2. a number followed by `mile`, `miler` or `mi` → miles (`Frostbite 5 Miler` → 5 mi);
  3. `half marathon` → 13.1094 mi; otherwise `marathon` → 26.2188 mi;
  4. if the name gives nothing, or disagrees with GPS by more than 15 %, use the nearest standard distance (1 mi, 5K, 5 mi, 10K, 15K, 10 mi, half, marathon) when GPS is within 4.5 % of it;
  5. otherwise class "Other" with the GPS distance.
- **Time** is Strava's `elapsed_time`. **Pace** is time divided by official distance, so it can differ from Strava's by a few seconds.
- **Short course.** GPS distance under 97 % of official distance. Flagged, and excluded from records.
- **Virtual.** `VirtualRun`, or "virtual" in the description. Excluded from records.
- **Record.** Fastest time per class among races that are neither short nor virtual.
- **Series ("same race, other years").** Same class and same name key. The key is the lower-cased name with years, ordinals ("12th annual"), distance words and punctuation removed (`2025 Riverbend 10k` and `Riverbend 10K 2024` → `riverbend`).
- **Age-group place.** Read from the activity description when it contains a phrase like "3rd in age group". The description itself is not stored, only the place.

### Data and sync

**Strava fields.** Strava's published schema confirms `workout_type`, `start_latlng`, `map`, `elapsed_time`, `distance`, `total_elevation_gain` and `achievement_count` on list results, and `description`, `calories`, `splits_standard`, `splits_metric` and `best_efforts` on a single activity. It is known to be incomplete. These are **unconfirmed**, each with a fallback:

| Field | Used for | If absent |
|---|---|---|
| `bio` on `GET /athlete` | reading upcoming races | hand-added races only; export and import become the way to move them between devices. Strava gives the detailed athlete only to a token with `profile:read_all`, which the app does not request today; if the probe shows that is why the bio is missing, adding that permission is the owner's decision |
| `suffer_score` | relative effort | row omitted |
| `pr_count` | Strava PRs | use `achievement_count`, labelled "achievements" |
| `average_heartrate`, `max_heartrate` | heart rate | rows omitted |
| `location_city`, `location_state` | place name | Nominatim (approved) |

**Field probe (first task of phase 1).** The builder cannot call Strava with the owner's token. Add a Data line that reports, from the owner's own browser, whether each unconfirmed field came back (yes or no only, never the values). The owner reads it out; the result is recorded here before phases 2 to 4 rely on it. On the same visit the owner checks two things on a real iPhone:
- whether the home-screen app shares storage with Safari (if not, the app needs its own connection and hand-added races do not cross over);
- whether Strava's approval screen returns into the home-screen app or into Safari.

**Field probe results (owner's browser, live site, 2026-11-26; permissions `read,activity:read_all`; 17 recent runs and 1 activity checked).**

| Field | Result | Consequence |
|---|---|---|
| `bio` on the athlete | returned and filled | The bio reader goes ahead. No extra Strava permission is needed. |
| `measurement_preference` on the athlete | not returned | The app cannot read the athlete's units with its current permission, and today it silently shows miles to everyone. Units become a setting on Data (miles by default), decided when phase 2 is planned. |
| `workout_type`, `start_latlng`, `map.summary_polyline` on list results | returned (`workout_type` filled on 16 of 17) | Races can be found and drawn from the activity list alone. |
| `suffer_score`, `pr_count`, `average_heartrate`, `max_heartrate` on list results and on an activity | returned and filled | Relative effort, Strava PRs and heart rate are shown as designed. |
| `location_city`, `location_state` | returned but always empty | Place names come from Nominatim, as approved. |
| `description`, `calories`, `splits_standard` on an activity | returned (`description` empty on the one checked) | Age-group place, calories and splits work as designed. |

iPhone, reported by the owner the same day: the home-screen app has its own storage, so it asks for the Client ID and Secret again; and Strava's sign-in returns into the home-screen app, not Safari. The setup screen needs no extra instruction. The first finding led to the setup link below.

**Race scan.** Legends sync stops at 1 January of last year and prunes anything older (`app.js`, `syncActivities`). Races need all history and must not be touched by that prune, so they get their own pass and their own cache.
- First run: list all activities, newest first, 200 per page, keeping only races. A few thousand activities cost about 15 requests.
- Afterwards: races are picked out of the activity lists the existing sync already fetches, at no extra cost. The existing daily 95-day re-list catches recent edits. "Rescan all history" on Data repeats the full pass for older edits.
- Per race, one detail request, fetched in the background newest first and cached: age-group place, virtual flag, splits, heart rate, calories, relative effort.
- Elevation profile: one streams request (`altitude`, `distance`), fetched when the race is first opened, reduced to at most 80 points before caching.
- All of it goes through the existing request counter (90 per 15 minutes, 900 per day) and pause-and-resume. Order within a sync: Legends work first, then the race scan, then race details.

**Storage.** `localStorage`, alongside the existing keys, which do not change:

| Key | Holds |
|---|---|
| `lw.races.<athleteId>` | race summaries (ID, name, local start, times, distance, climb, start point, summary polyline, sport type) and scan state |
| `lw.raceDet.<athleteId>` | per-race detail, weather and place, each with a fetched-at time |
| `lw.upcoming.<athleteId>` | hand-added races |
| `lw.ui` | list mode and last filter |

Every access stays guarded as today. If storage is full, details are dropped before summaries and the existing "storage is full" warning is shown. Disconnect removes all of these (decision 5).

### Upcoming races

- **From the bio**, if the probe finds it: re-read once a day (one request). The owner's bio has this shape (races invented here):

  ```
  Upcoming Races
  -----------------------
  03/14/2027 Riverbend 5k
  05/09/2027 Frostbite Half Marathon
  ```

  - A race is any line that starts with a date as `MM/DD/YYYY` (month first; one- or two-digit month and day accepted) followed by a name. The heading, the dashed rule and any other bio text are ignored.
  - The distance class comes from the name, by the same rule as finished races.
  - The bio carries no start time or place. A bio race counts down in days only, and shows no place.
  - Lines that start with something date-like but do not parse are counted, and Data shows how many.
  - The bio is the source of truth for its own races: one removed from the bio disappears here on the next read, and bio races have no "Remove" button.
- **By hand**: a sheet with name, date, start time (optional), distance class and place. Dates in the past are refused with "Finished races come in from Strava."
- A hand-added race and a bio race on the same date with similar names are shown once.
- A race whose date has passed leaves "Up next" on its own.
- **Export and import** on Data: a JSON file where the browser allows a download, and copy and paste as text everywhere, since iPhone home-screen apps restrict downloads.

### Setup link (added 2026-11-26, awaiting the owner's approval)

**Why.** Every browser, and the iPhone home-screen app, keeps its own storage, so each one asks for the Client ID and Secret again. The owner moves between several and asked for a link that carries the connection. Offered a keys-only link or one that also signs in, the owner chose the one that signs in, accepting that such a link is as sensitive as a password.

**What it carries.** Client ID, Client Secret, the Strava refresh token, the athlete ID and the granted permissions. Not the short-lived access token, and no cached data.

**Shape.** `<site address>#setup=<code>`, where the code is base64url of `{"v":1,"i":clientId,"s":clientSecret,"r":refreshToken,"a":athleteId,"p":scope}`. It rides after the `#`, which browsers do not send to the site.

**Making one.** Data gains "Set up another device": the warning below, then a "Create setup link" button. Pressing it shows the link in a read-only box with Copy. Nothing is created before the press and the link is not stored anywhere.

**Using one in a browser.** On load, before anything else, an address starting `#setup=` is read and removed from the address bar at once, valid or not. If this browser is already connected as a different athlete, ask before replacing. Otherwise store the keys and the token with an expiry of zero, so the first request refreshes it, then show the hub and sync.

**Using one in the home-screen app.** A link always opens in Safari, never in the home-screen app. So the setup screen gains one box, "Have a setup link? Paste it here", which accepts the whole link or just the code.

**When it fails.** A code that does not decode, or a refresh that Strava refuses, shows "This setup link no longer works. Create a new one on a connected device."

**Stopping it.** All devices that use one Strava app share one grant of access. Today's "Disconnect" revokes that grant at Strava, which signs out every device and kills every link. That becomes two choices on Data:
- **Forget this browser** wipes this browser only.
- **Disconnect everywhere** revokes access at Strava and wipes this browser. This is the way to cancel a link that has gone astray.

**Said in the page and the README.** Anyone holding the link can read all of the athlete's Strava activities, private ones included, until "Disconnect everywhere" is used. Send it only to yourself.

**Not for friends.** Giving someone the link gives them the owner's Strava access. A friend connects with their own Strava app, as now, and can then make links for their own devices.

**Unverified.** Whether Strava issues a new refresh token when a second device refreshes, which would sign the first one out. If it does, that device shows the "no longer works" message and needs a fresh link. Check with the owner's two devices during the build.

**Tests.** Two pure functions, `encodeSetup(fields)` and `decodeSetup(text)`. The second accepts a whole link or a bare code and returns nothing for garbage, a wrong version or a missing field.

### Weather

Strava supplies none. Use Open-Meteo's archive API, which needs no key, allows browser requests, and was checked to return same-day hours.

- One request per race with a start point: the start date, the start hour's temperature, feels-like, humidity, wind, precipitation and sky code, in the athlete's units.
- Coordinates are rounded to two decimals (about 1 km) before sending.
- The archive answers for today and even for hours that have not happened yet, so recent values are model estimates, not final data. Weather fetched within 7 days of the race is marked provisional and fetched once more after that; older weather is cached for good.
- A race without a start point (treadmill, no GPS) shows "No weather".
- Footer credit: "Weather data by Open-Meteo.com".

### Place names (decision 3)

**First choice: Strava.** Activities have `location_city` and `location_state` fields that Strava's documentation calls deprecated and that are often empty. The field probe checks them. If they are filled, use them and add no service.

**Otherwise: Nominatim reverse lookup at city level.** The owner accepted these conditions on 2026-11-26. Its usage policy is at https://operations.osmfoundation.org/policies/nominatim/. What it requires, and how this design meets it:

| The policy says | This design |
|---|---|
| At most one request per second, counted across all of a site's users; moderate user numbers | One request every 1.5 seconds per browser. The site has a handful of users. If that changes, turn lookups off. |
| Results must be cached; repeated identical queries get a client blocked | Cached for good; one lookup per distinct rounded point, so a venue raced ten times costs one request |
| Periodic or bulk requests are discouraged; a small one-time batch may be acceptable | A one-time backfill of distinct venues (tens, not thousands), then one lookup per new venue |
| The app must be able to stop using the service on request, without a software update | A "Place lookups" switch on Data, and a single constant that turns them off for everyone on the next page load |
| Identify the application | The page's referrer policy already sends the site's address |
| Show attribution | The existing OpenStreetMap credit in the footer |
| The developer must make a deliberate, informed decision and is responsible for compliance | This is why it is the owner's decision and not the builder's |

- Coordinates are rounded to two decimals before sending.
- Label: town and state or region code ("Riverbend, CO").
- With lookups switched off, the place line is left out and nothing else changes.

### Map

The race page's Course panel and, by decision 4, the Legends map use CARTO's dark raster tiles tinted navy. This is option F from the comparison the owner picked from.

- Base layer: `https://basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png?key=<key>` with CSS filter `sepia(.85) hue-rotate(183deg) saturate(1.25) brightness(.9)` on the layer's class.
- Route: a Leaflet pane above the base (z-index 450). The line is drawn twice in the class colour: 9 px at 22 % opacity for glow, then 3.5 px solid. Finish is a filled `--slow` dot; start is a `--go` ring with a `--board` centre, drawn last.
- Labels: `.../dark_only_labels/{z}/{x}/{y}{r}.png?key=<key>` in a pane above the route (z-index 460, no pointer events) with `brightness(1.25)`, so street names stay readable over the line.
- `{r}` requests double-density tiles on retina screens. Attribution: "© OpenStreetMap contributors © CARTO".
- In the page the map is fitted to the course and does not pan or zoom, so it never traps scrolling on a phone. An "Expand" control opens it full-screen and interactive. Builder's call; the owner has not seen this behaviour.
- The route uses the summary polyline already cached. Thumbnails in lists stay bare SVG traces and load no tiles.

**The key.** CARTO has required a key since September 2026; it is free for non-commercial use and is meant to sit in public page code.
- Do not write it in this document. It lives in one constant in the map module.
- Order of work: the owner restricts the key to the GitHub Pages address in CARTO's dashboard first, then it is committed.
- **A refused key does not raise an error.** Tested: a wrong or missing key gets a normal `200` response carrying a placeholder image that says a key is required, so Leaflet cannot detect it and no automatic fallback is possible.
- **So the map source is chosen, not detected.** Use CARTO when the page is served from the GitHub Pages host, and the keyless map everywhere else (local development, forks). Data has a "Map" switch (CARTO or OpenStreetMap) that overrides this in that browser, for the day a key is revoked.
- **The keyless map** is the existing OpenStreetMap tiles with filter `grayscale(1) invert(1) brightness(.82) contrast(1.15) sepia(.75) hue-rotate(178deg) saturate(1.5)`. It was rendered and is acceptable, slightly softer on retina screens.
- Whether CARTO accepts more than one host per key is unknown. Its dashboard allows more keys, so a second unrestricted key for local use is possible but not needed.

### Outside hosts and the privacy promise

The README, the `app.js` header and the footer currently say the page talks only to Strava and OpenStreetMap. That changes and all three must be updated in the same phase that adds each host.

| Host | Gets | CSP change | Phase |
|---|---|---|---|
| `basemaps.cartocdn.com` | map tile requests for the area of a race or segment, the site's address, the public key | add to `img-src` | 3 |
| `archive-api.open-meteo.com` | a rounded start point and a date per race | add to `connect-src` | 3 |
| `nominatim.openstreetmap.org` (only if Strava has no place names; approved) | a rounded start point per venue | add to `connect-src` | 3 |
| the site itself | font files | add `font-src 'self'` | 1 |

No host receives names, times, tokens or the athlete's identity. Leader anonymity on Legends is unchanged.

### Home-screen app

- Manifest: name and short name "Run Board" (decision 2), `background_color` and `theme_color` `#0C1424`, `display: standalone`.
- `viewport-fit=cover`, the Apple web-app meta tags, safe-area insets on the tab bar, top bar and sheets.
- New icons in the clock look at 180 and 512 px plus SVG, replacing the current uncommitted set. The owner sees them before they are committed.

### Code conventions

- Keep the existing rule: data never goes through `innerHTML`. Build DOM with the `h()` helper, extended for SVG.
- ES modules, no build step, no new runtime dependencies beyond Leaflet, which stays pinned with its integrity hash.
- Pure logic (distance class, pace, records, series key, bio parsing, polyline decoding, weather-hour selection) lives apart from DOM code so it can be tested without a browser.
- Miles or kilometres, Fahrenheit or Celsius, follow the athlete's Strava preference, as the existing mileage code does.
- Accessibility: visible focus, `aria-current` on navigation, real text behind clock digits, charts with text labels, `prefers-reduced-motion` respected.

### Failure behaviour

Each enrichment is independent. A failed weather, place, detail or elevation request leaves that part showing "not available yet" and is retried on a later sync; it never blocks the list or the race page. Rate-limit pauses behave as they do today.

## Testing

- Unit tests with Node's built-in runner (`node --test`, no dependencies) for the pure logic, using invented races.
- Demo mode gains about twenty invented races covering: a record, a short course, a race without GPS, a virtual race, a three-year series, an unusual distance, and one upcoming race. It is the public showcase and the fixture for manual checks.
- Manual checks each phase at phone, tablet and desktop widths, and on a real iPhone installed to the home screen.
- Before every commit: confirm no real activity IDs, names, coordinates or keys other than the CARTO key are in the diff.

## Done means

- Opening the site lands on the hub, on phone and desktop.
- Every race flagged in Strava appears with class, time, pace and, where a start point exists, weather.
- A race page shows the course on the navy map, splits, elevation, other years and the Strava extras.
- An upcoming race can be added, survives a reload, drives the countdown, and can be exported and imported.
- Legends works as before in the new look.
- The README, footer and code header name every outside host.

## Left to the builder

File and module names, the exact breakpoint, chart drawing details, the order of work inside a phase, cache eviction details, and icon artwork (shown to the owner before commit).
