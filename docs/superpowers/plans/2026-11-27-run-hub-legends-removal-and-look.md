# Run Hub: remove Legends, then the Announcer hub and Live board

## Context

The owner finds the Local Legends page low-value: it takes a tab and most of the Strava budget (one detail
call per run in the last 90 days, plus one `/segments/{id}` call per segment every 6 to 24 h). It goes
entirely. Mileage, which lives inside that page today, moves to the hub (owner's choice).

The owner also wants the UI to be more distinctive. From six mock-ups they chose two directions:

- **Announcer**: the hub is a few plain sentences with live clock numbers set inside them, not cards.
- **Live board**: the finish clock behaves like real hardware (lamp test, dot-matrix ticker, run-up).

They then asked for their dog, Ziggy, as a pixel character in the app and as the new app icon.

Two phases, each its own session and shippable alone. Phase 5 first: phase 6 designs for the app without
Legends.

## Approaches considered (look)

Six were mocked: Live board, Season course (year as a course profile), Finisher ribbons (generated ribbon
per race), Announcer, Track lanes (a lane per distance), Results slip (race page as a timing-tent receipt).
Picked: Announcer plus Live board. Reason (mine): both deepen the one idea the app already owns, the amber
dot-matrix clock, and Announcer removes the generic parts (identical cards, tracked uppercase labels,
dot-joined meta lines) while giving mileage a natural home. Results slip is a possible later add-on.

## Constraints (unchanged)

- Static site, no build step, dark only, iPhone home-screen app first.
- CSP `font-src 'self'`: no new font files are needed (Doto 900 and Manrope are already committed).
- Every `js/*.js` file must be in the import map at the current version; the CSP carries the map's hash.
  Use `node scripts/stamp-version.mjs N`, never hand-edit: it rebuilds the map from whatever is in `js/`,
  so added and deleted modules are picked up, and rewrites the hash. `tests/versions.test.js` checks it.
- Public repo: invented races only in tests, docs and demo data.
- `mock.html` and `mock-fetch.js` are gitignored; regenerate `mock.html` from `index.html` after changes.
- The one-second tick replaces digits only, and writes the aria-label only when it changes.
- Reduced motion: every new animation shows its final state at once.

---

## Phase 5: remove Legends, move mileage to the hub (v41)

The `legends-*` files also hold app-wide plumbing. Keep and re-home that; delete the rest.

### New and deleted files

| Action | File | Holds |
|---|---|---|
| Add | `js/sync.js` | `sync()`, `syncActivities()`, `syncRaces()` moved from `legends-sync.js` with three changes: `sync()` no longer calls `syncDetails` or `syncLeaders` (neither is moved); the prune loop in `syncActivities` drops `delete c.det[id]` (a v2 cache has no `det`, so it would throw); a stored run no longer carries `v`. |
| Add | `js/runs-model.js` | `emptyCache`, `loadCache`, `saveCache`, `miles`, `demoCache` (runs only) |
| Add | `tests/runs-model.test.js` | the `miles` and `loadCache` tests from `legends-model.test.js`, plus the prune test below |
| Delete | `js/legends-sync.js`, `js/legends-model.js`, `js/legends-view.js`, `tests/legends-model.test.js` | |

- `decodePolyline` moves into `js/races-model.js` (its only remaining user); its test moves to
  `tests/races-model.test.js`.
- **Do not change `syncActivities`' window logic** (`after`, the daily 95-day re-list, the floor at Jan 1
  last year). `noteListed(rc, listed, after)` in `js/races-sync.js` relies on `after` to drop un-flagged
  races, and mileage needs the runs back to Jan 1 last year.

### Stored cache (`lw.cache.{id}`)

Existing browsers hold a v1 cache with `det`, `eff`, `seg`. Do not reset it (that would refetch every run).
`loadCache` accepts v1 or v2; for v1 it deletes `det`, `eff`, `seg`, sets `v: 2` and returns it. The next
`saveCache` writes the smaller cache. `emptyCache()` returns
`{ v: 2, athlete: null, acts: {}, lastStart: 0, lastSync: 0, lastFull: 0 }`. Stop storing the per-run
visibility `v`. Test: a seeded v1 cache loads with `acts` and `lastSync` intact and no `eff`, `seg`, `det`.

### Edits

- `js/main.js`: imports from `sync.js` and `runs-model.js`; drop `'legends'` from `ENABLED` and `SECTIONS`;
  delete the `view === 'legends'` branch, the `S.map` lines (in `render`, `onRoute`, `wipe`) and the
  `$('dMap')` listener in `wireSetup()` (it would throw once the element is gone and stop the app loading);
  the hub gets the cache (`ready ? c : null`) in place of `compute(c)` and works out `miles(c)` inside its
  own `part()` guard, so a throw there shows a note and the rest of the hub still draws;
  `renderData(c, races)`; header comment.
- `js/router.js`: drop `'legends'` from `VIEWS`. `#legends` then falls back to the hub like any unknown
  hash. Update `tests/router.test.js` (fixture `P1`, and add `'#legends'` to the falls-back-to-hub list).
- `js/hub.js`: delete `legendsCard` and the `riskSummary` import. `renderHub(cache, races, up)`. Add a
  plain Mileage section built from `renderMiles` in the old `legends-view.js` (the four lines and the
  13-week bars, existing `.mline` and `.bars` styles), with a "Loading your runs from Strava" note while
  the cache is null. Phase 6 restyles it.
- `js/data-view.js`: `renderData(c, races)`; keep "Last synced" and "Runs cached" (without its
  "in the last 90 days" clause, which used `WINDOW`); remove the four Legends rows and "Runs by
  visibility"; import `sync` from `./sync.js`; `mapRow` no longer touches `S.map`.
- `js/core.js`: remove `WINDOW`, `REACH_GAP`, `HOT_MAX_AGE`, `COLD_MAX_AGE`, `MANUAL_MAX_AGE`, and `map`,
  `layers` from `S`. Grep each name first.
- `index.html`: remove the Legends nav link and the whole `#view-legends` section; rewrite the meta
  description and the setup lede (races and mileage); drop the Local Legends sentence from setup step 5
  and from the footer. Then `node scripts/stamp-version.mjs 41`.
- `styles.css`: remove by selector, not by block: `.bans`, `.card.hero/.mini/.danger/.ok`, `.card .num`,
  `.card .sub`, `#map`, `.legend`, `.sw*`, `tr.risk`, `tr.reach`, `td.seg`, `.linkish`, `.ext`.
  Keep: `.card` and `.card .label` (both sit in the "Legends: headline cards" block but style Next start,
  the race clock and the trend), `details`/`summary` (phase 6 uses them), the table rules, the mileage
  rules and `.hub-rows` (now one column).
- `README.md`: intro, the "Before a run" bullet, the leaders-stay-anonymous bullet, the Within reach and
  Titles held rows, the undocumented-field caveat.
- Comments that say "Legends" in `js/races-sync.js`, `js/races-model.js`, `tests/races-sync.test.js`,
  `tests/setup-link.test.js`.
- `docs/superpowers/specs/2026-11-26-hub-and-races-design.md`: one dated note at the top that Legends was
  removed on 2026-11-27. Leave the rest as history.
- Local only: `mock-fetch.js` (drop the segment answers), regenerate `mock.html`.

### Verify

1. `node --test`: all pass.
2. Preview `dashboard`, `?demo`: hub shows Next start, Races and Mileage; two tabs; `#legends` lands on the
   hub; Races, a race page and Data draw; no console errors.
3. Preview `dashboard-8082` with `mock.html`, storage cleared, full sync: the network log has no
   `/segments/` and no `include_all_efforts` request; "Strava API calls used" on Data is far lower than
   before.
4. Same harness: seed a v1 `lw.cache.42` holding `eff`, `seg`, `det`; reload; the key now has `v: 2`,
   the runs intact, and none of the three.
5. Phone width (375): tab bar shows Hub and Races evenly.

Commit: "Remove Local Legends; mileage moves to the hub; v41". Push to `origin` (Carpe-Canem/RunHub) only
when the owner says.

---

## Phase 6: Announcer hub and Live board (v42)

### Announcer: the hub as sentences

Layout, top to bottom. Left aligned, one column, max about 34 characters per line on a phone.

```
┌────────────────────────────────┐
│ ░ SYNCED 3 MIN AGO ■ NEXT ...  │  ticker (Live board)
│                                │
│  14   06   41   09             │  the clock, as today
│  days hrs  min  sec            │
│  to Harbor 10K.                │
│  Sat Dec 12, 8:00 am           │
│                                │
│  18.2 miles this week.         │
│  That's 3.1 over your usual.   │
│                                │
│  842 miles this year, 61 ahead │
│  of this date last year.       │
│                                │
│  Last out: Turkey Trot 5K in   │
│  22:41. Your fastest 5K yet.   │
│                                │
│  31 races finished, 4 on an    │
│  age-group podium.             │
│                                │
│  Last 13 weeks          (open) │
│  Latest results  [strip]       │
│  Personal records [grid]       │
└────────────────────────────────┘
```

- New `js/hub-lines.js`, pure, no DOM: `hubLines({ mi, stats, units })` returns an array of lines, each an
  array of parts `{ text }`, `{ led }`, `{ text, tone: 'go' | 'slow' }`, plus an optional `href`.
  `js/hub.js` turns parts into nodes with `h()` and `led()` from `js/dom.js`. Tested in
  `tests/hub-lines.test.js`.
- Copy rules (each a test case):
  - Week: over the 12-week average → "That's N over your usual." Otherwise "Your usual week is N." Never
    "behind": a part-week under the average is normal.
  - Year: "N ahead of" or "N behind this date last year"; with no runs last year, just the total.
  - Last out: the newest finished race; "Your fastest {class} yet." only when it is that class's record.
    Links to `#race/{id}`.
  - Totals: links to `#races`; podium clause only when there is one.
  - Loading and empty: "Loading your runs from Strava." / "Loading your race history." / "No races yet."
  - No races and nothing upcoming: "Nothing on the calendar." with the Add race button.
- **My call, differs from the mock-up:** the mock-up opened with "14 days to Harbor 10K." The plan keeps
  the full four-group clock with seconds (asked for in v39) and puts the sentence under it.
- The clock keeps its markup id (`#nextClock`), `setClock`, `tickHub` and `tickAction` exactly as they are;
  only the casing around it changes (no card, the race name becomes the sentence under the digits).
- The 13-week bars sit in a closed `<details>` "Last 13 weeks". Latest results and Personal records stay
  as they are, below the sentences.
- Type: Manrope 800 at about 22 px for sentences, LED numbers inline at about 1.5× the sentence size,
  `--mut` 14 px for the closing line. Retire on the hub: `.rowlink` cards, the tracked uppercase `.label`
  eyebrows, dot-joined meta strings.
- Each section still draws on its own through `part()`, so one throw leaves the rest standing. Focus
  restore by `data-focus` stays.

### Live board

1. **Lamp test.** Once per page load, on the first connected draw: every `.led` shows all cells lit for
   about 700 ms, then its value. `led()` in `js/dom.js` always emits the `.gh` layer (it is `aria-hidden`
   already); CSS hides it unless the LED asked for a ghost or the lamp class is on. `main.js` sets that
   class on `<html>` and removes it on a timer; under it `.gh` has full opacity and the real digits are
   hidden. Update `tests/dom.test.js` for the new `led()` output. Not replayed on redraws or route
   changes. Purely visual, so no aria change.
2. **Ticker.** The status text in the top bar becomes a dot-matrix strip (Doto, amber on `--board`).
   - New `js/ticker.js`, pure: `tickerText({ status, next, mi })` → when idle, "Synced 3 min ago", then
     the next start, then this week's miles, joined by a square. During a sync, the progress text alone.
     Tested in `tests/ticker.test.js`.
   - It scrolls only when the text is wider than the strip; otherwise it sits still.
   - Errors and the rate-limit pause never scroll: static, in `--slow`, wrapping.
   - Screen readers: `#statusText` stays the polite live region with plain text, visually hidden; the
     strip is `aria-hidden`. The progress bar and "Refresh now" stay.
   - Uppercase by CSS on the strip only (a dot-matrix sign is the one place it is the vernacular); the
     text itself stays sentence case.
3. **Run-up.** Opening a race counts its finish time up from 0:00 over about 1.2 s, eased, then holds;
   a record flashes `--go` once. Trigger from `raceOpened(id)` in `js/race-view.js`, once per open, never
   on the redraws a sync causes (keep a "played for this id" flag). During the run the clock carries
   `role="img"` and an aria-label with the final time. Pure helper `runUpAt(totalSeconds, progress)` in
   `js/race-rules.js` or a new file, tested.

### Ziggy: the board's dog

The owner's dog, drawn as a dot-matrix sprite from a photo (the photo is never committed). The owner
approved the second sprite as the starting point; poses still get tuned by eye in the build.

- What makes it Ziggy: black coat as half-lit cells so the white bib, socks and tail tip can be fully
  lit; tail curved up with the bright tip; one floppy ear as a dimmer flap on the side of the head (two
  pointed ears read as a cat); a long dark muzzle with **only a thin white mark just behind the nose**
  (owner's correction: never white all the way back the muzzle, in the app or the icon); an unlit cell
  for the eye; a deep chest and tucked belly; the collar is the only blue on the board.
- Cells: `.` off, `o` coat (amber at 42%), `e` ear (20%), `#` white (100%), `c` collar (`#6EC6E6`, new
  token `--collar`). Grid 24 by 14, facing right. Starting frames:

  ```
  trot, frame 1                 trot, frame 2 (last 3 rows)
  ..#.....................
  .#.............oo.......
  .o............ooooo.....
  .o............oeeo.ooo..
  ..o...........ooeooooo#o
  ..o..........oooooooo#..
  ...oooooooooocc##.......
  ...ooooooooooo##........
  ...ooooooooooo#.........
  ...oooo....oooo.........
  ....oo......oo..........
  ...o..o....o..o.........      .....oo....oo...........
  ..o....o..o....o........      ......oo..oo............
  .#......##......#.......      .......#..#.............

  sit                           nap (rows 9 to 12; the rest are empty)
  ........................
  ...............oo.......
  ..............ooooo.....
  ..............oeeo.ooo..
  ..............ooeooooo#o
  .............oooooooo#..
  ............occ##.......
  ...........oooo##.......
  ..........ooooo##.......      ......ooooooo...oo......
  .........oooooooo.......      ....ooooooooooooeeoo....
  ........oooooo.oo.......      ...oooooooooooooeoooo#o.
  .......ooooooo.oo.......      #ooooooooo###ooo.####...
  .#....oooooooo.oo.......
  ..oooooooo###..##.......
  ```

- New `js/ziggy.js`: the frames as data plus `ziggy(pose, cell)`, which returns an `aria-hidden` SVG built
  with `svg()` from `js/dom.js`. The two trot frames swap by a CSS `steps()` animation, so the global
  reduced-motion rule stills them. `tests/ziggy.test.js`: every frame is 14 rows of at most 24 allowed
  characters, and the trot frames differ only in the last three rows.
- Where Ziggy appears (my call from the five mocked; the owner did not pick, so confirm at approval):
  - **Ticker**: at the left end of the strip, and the sync status at a glance. Trots while syncing, sits
    when synced, naps when paused, offline or after an error. `tickerPose(state)` in `js/ticker.js`,
    tested. The progress bar and the text stay; Ziggy adds nothing a screen reader needs.
  - **Finish line**: a strip under a race's clock. During the run-up Ziggy runs toward a chequered post,
    moved by the same eased progress as the digits, and sits past the line when the time lands. A record
    gets three quick hops first. Reduced motion: sitting at the line from the start.
  - **Empty and error notes**: sits beside "Nothing on the calendar." and "No races yet."; naps beside
    the "not available right now" notes.
  - Not built: Ziggy commenting on the week's mileage. It would put a second voice beside the sentences.
- The name `ziggy` appears in the public repo's code. Rename to `dog` if the owner prefers.

### App icon: runner and Ziggy on amber

Chosen by the owner over three rounds: a full amber field, an angular runner, and Ziggy trotting ahead on
a leash clipped to a blue harness. It is a smooth vector drawing, not the dot grid: the owner asked that
it be distinctly a runner and a dog and not held to the ticker's cell size.

- Colours: field `#FFB52E`; figures `#0A0E18`; Ziggy's ear `#27324F`; white `#FFFFFF` for the bib, socks,
  tail tip, the eye dot and the thin band behind the nose; harness and collar `#2E9BC6`.
- Style ("angular"): strokes with butt caps and miter joins, torsos and heads as polygons.
- Geometry of the approved sketch, in a 512 box. Runner: local points below, placed at (160, 326), scale
  1.45. Ziggy: placed at (372, 346), scale 0.9.

  ```
  Runner (strokes: arms 16, legs 22)
    back arm   (8,-100) (-34,-84) (-52,-54)
    back leg   (-6,-30) (-34,22) (-88,10)
    torso      polygon (-1,-118) (37,-106) (6,-26) (-18,-34)
    front leg  (-6,-30) (50,-8) (38,52) (62,56)
    front arm  (14,-104) (50,-84) (84,-78)        hand holds the leash
    head       polygon (10,-158) (34,-172) (54,-152) (44,-128) (18,-130)

  Ziggy (strokes: legs 13, tail 12; the last third of each leg and of the tail is white)
    tail       (-64,-10) (-92,-34) (-90,-78)
    legs       (-48,8) (-74,38) (-98,60)   (-40,10) (-36,46) (-56,70)
               (44,14) (66,42) (90,60)     (36,16) (22,48) (4,68)
    body       polygon (-58,-24) (40,-30) (64,-8) (48,24) (-8,8) (-50,16) (-68,-4)
    bib        white polygon (55,-14) (64,-8) (53,18) (46,8)
    harness    girth (22,-30) (26,17) width 10; chest strap (22,-27) (57,-11) (32,19) width 8;
               ring circle at (22,-33) radius 7: the leash ends here
    neck       polygon (34,-30) (62,-10) (84,-44) (64,-62)
    head       polygon (60,-74) (88,-78) (98,-64) (128,-54) (130,-44) (100,-38) (72,-40)
    nose band  white polygon (114,-58.7) (120,-56.7) (120,-42) (114,-40.8)
    ear        polygon (62,-74) (80,-76) (60,-46)
    eye        white circle at (92,-63) radius 3.2
    collar     (49,-46) (73,-27) width 8
  Leash: width 6, from the runner's front hand to the harness ring, sagging slightly.
  ```

- Redraw it carefully from this; the sketch was quick. Check at 60 px, the home-screen size: both figures,
  the leash, the harness and Ziggy's white marks must still read. Thicken strokes if they don't.
- Full-bleed square, no drawn corner radius or border: the home screen applies its own mask. Keep both
  figures inside the middle 88%.
- `icon.svg` is written by hand. `icon-180.png` and `icon-512.png`: draw `icon.svg` on a canvas in the
  preview browser at each size, read the PNG back as base64, and write the files with Node. No new
  dependency and no script to keep.
- `manifest.webmanifest`: `background_color` stays `#0C1424`. iOS keeps the old icon for an installed
  home-screen app, so the owner removes and re-adds it to see the new one (say so at hand-off).
- The in-app sprite keeps its blue collar and gets no harness or leash: at ticker size there is no room,
  and nobody holds the other end.

### Files

`icon.svg`, `icon-180.png`, `icon-512.png`, `js/ziggy.js` (new),
`tests/ziggy.test.js` (new), `js/races-view.js` (empty and down notes),
`js/hub.js`, `js/hub-lines.js` (new), `js/ticker.js` (new), `js/main.js` (`renderStatus`, lamp class),
`js/race-view.js`, `js/dom.js` and `tests/dom.test.js` (`led()` always emits the ghost), `styles.css`,
`index.html` (status markup; stamp 42), `tests/hub-lines.test.js`, `tests/ticker.test.js`, a run-up test,
`README.md` (what the hub shows), `mock.html` (local).

### Verify

1. `node --test`: all pass.
2. Preview `?demo` at 375 px and at 1000 px: screenshots of the hub and a race page; sentences wrap
   without orphaned single words where avoidable; no horizontal scroll.
3. Lamp test plays once on load and not again after a route change or during a mock sync.
4. Watch the countdown for 10 s with focus on a hub link: focus does not move; the clock's aria-label
   changes only when the minute does.
5. Emulate reduced motion: no lamp test, no scrolling ticker, the race time shows at once.
6. `mock.html` sync: the ticker shows progress, then the idle line; force an error (offline) and see it
   static in red and announced once.
7. `design:accessibility-review` on the hub: contrast of `--mut` sentence text and amber LED on `--night`.
8. Icon: view `icon.svg` at 60 px and 512 px in the preview and open both PNGs; the browser tab shows the
   runner and Ziggy; no white runs back along the muzzle.
9. Ziggy: screenshot each pose at ticker size and at finish-line size; in a `mock.html` sync Ziggy trots,
   then sits; offline, Ziggy naps; a record race shows the hops once and not again on a sync redraw.

Commits: "Ziggy: the sprite and the app icon", then "Hub speaks in sentences; live board: lamp test,
ticker, run-up; Ziggy on the board; v42".

---

## After each phase (owner's standing preference)

End the session with a ready-to-paste prompt for the next one in a code block, the recommended model and
effort, and any workflow tips.

Next-session prompt for phase 5:

```
Run Hub, phase 5: remove Local Legends and move mileage to the hub. Follow the "Phase 5" section of the
plan at docs/superpowers/plans/2026-11-27-run-hub-legends-removal-and-look.md. If that file is not there
yet, copy it from
C:\Users\rossi\.claude\plans\pasted-content-id-1bba-some-b-serialized-adleman-of-a5456991-3117-4ce5-869c-987c67bbafd2.md
and commit it first. Branch run-board. Decisions already made: Legends goes entirely; mileage moves to
the hub; the stored v1 cache is pruned to v2, not reset; syncActivities' window logic does not change.
Done means: node --test passes, no /segments/ or include_all_efforts requests in a mock sync, #legends
lands on the hub, stamped v41, committed but not pushed.
```

Model and effort: Sonnet 5.5 at medium for phase 5 (mechanical, well specified). Fable 5.2 or Opus 5.5 at
high for phase 6 (copy rules, motion and accessibility judgement).
