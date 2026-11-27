# Run Hub: the hub at a glance, and Ziggy speaks (v43)

> **For agentic workers:** work one phase per session, in order. In each phase write the named tests first,
> watch them fail, then write the code (superpowers:test-driven-development). Phases 1 and 2 each end at an
> owner approval; do not go past one without a clear yes.

**Goal:** replace the v42 sentence hub and the dot-matrix status strip with the "At a glance" hub, a plain
status line that is also the refresh button, and Ziggy as a full-colour pixel character who speaks one line
from a bubble at the foot of the hub.

**Spec:** `docs/superpowers/specs/2026-11-27-hub-at-a-glance-and-ziggy-speaks-design.md` (approved by the
owner on 2026-11-27). Read it with this plan. Its decisions are final; this plan only adds what the spec
left to the builder, and marks each such call "plan's call".

**Architecture:** every rule that can be tested without a browser lives in a pure module (`hub-model.js`,
`ziggy-says.js`, `ziggy-moves.js`, `status.js`, `ziggy-frames.js`). `hub.js` and a new `ziggy-stage.js`
only turn their answers into nodes. Ziggy's frames are drawn as text grids in `sprites/src/`, built into
two PNG sheets by a Node script with no dependencies, and shown by moving a background image.

**Tech:** static site, ES modules, no build step for the app, `node --test`, Node 26.

## Context

The owner's words about v42: "It's overwhelming. Font looks odd." Over the mock-up rounds of 2026-11-27
they chose layout E ("At a glance"), Ziggy speaking from a bubble above him with six moods and random
fidgets including a wander, a seven-day strip labelled only by the week's dates, and a new sprite (sheet
"B6"). The locked base art and every mock-up are in `.claude/mockups/`, which is gitignored and stays
uncommitted. `hub-c-pinned.png` (phone), `hub-desktop-and-topbar.png` (desktop and the four top-bar
states) and `ziggy-speech.png` (bubble style 6, and the burst in style 5) are the pictures to build to.

## Constraints (every phase)

- Public repo: invented races only in tests, docs and demo data. Never commit photos, Leonardo's raw
  output, `.claude/`, `mock.html` or `mock-fetch.js`.
- No dependencies, no new font files, no new outside service. The CSP string does not change
  (`tests/versions.test.js` pins it); `img-src 'self'` already covers the sprite sheets.
- Every `js/*.js` file must be in the import map. Phase 1 runs `node scripts/stamp-version.mjs 43`; every
  later phase that adds or deletes a module runs it again with `43`. Never hand-edit the map. v43 is the
  release number: nothing is pushed before Phase 7 is done. If the owner asks for an earlier push, stop
  and ask, because a second push at the same number would be served stale.
- The preview pane caches `?v=43` files. After an edit, load from an origin not used yet
  (`127.0.0.1` in place of `localhost`, or the `dashboard-8082` or `dashboard-8093` server).
- `mock.html` is `index.html` plus one line, `  <script src="mock-fetch.js?n=N"></script>`, placed on the
  line before the Leaflet `<script>`. Regenerate it after every change to `index.html`, with `N` one
  higher than before (it is 29 now).
- Touch targets at least 44 px. Text contrast at least 4.5:1 on `--night` and `--panel`.
- The one-second tick replaces digits only. `#nextClock`, `setClock`, `tickHub` and `tickAction` keep
  their behaviour.
- Reduced motion: nothing types, moves or drifts; every line is complete and he holds the still pose.
  Script motion goes through `motionOK()` in `js/dom.js`; CSS motion is stilled by the stylesheet's rule.
- Leonardo is not called anywhere in this plan. If a frame cannot be made by moving pixels, stop and ask
  the owner before running `.claude/mockups/leo_run.py` (it uploads reference images; the owner's
  earlier yes covered one round only).
- Commit at the end of each phase with the message given. Do not push unless the owner says.

## Phone size for every check

iPhone 16 Pro Max as a home-screen app: 440 × 956 CSS px, safe areas 62 px top and 34 px bottom.

- `env(safe-area-inset-*)` is 0 in the preview pane and in headless Edge, which would give 96 px of room
  the phone does not have. So Phase 4 adds two root tokens, `--sat` and `--sab`, and every check sets
  them on `<html>` from the harness: `--sat: 62px; --sab: 34px` (home-screen app), or both `0px` (Safari).
- 440 px wide: preview pane, `resize_window` with width 440 and height 956, tokens set with
  `javascript_tool`. Headless Edge clips windows narrower than about 500 px, so there use a scratch page
  in `.claude/mockups/` that frames the app in a 440 × 956 `<iframe>` inside a 1000 px window, sets the
  tokens on the frame's root, and writes what it measured into its own DOM (`--dump-dom`,
  `--screenshot`, and `--force-prefers-reduced-motion` for check 6).

## Review focus

Inputs the spec implies but does not spell out. Each has a named test in the phase that owns the code.

1. A long race name in Ziggy's line must still fit two lines at 440 px: names are cut to 28 characters
   with an ellipsis in his line only (Phase 3, `ziggy-says`).
2. The line he is showing keeps its key but its text changes during a sync (the week's miles grow): the
   text is swapped in place and the typing carries on from where it was, never from zero (Phase 3,
   `carryTyped`).
3. `weekAvg` of 0, and `lytd` of 0 while `hasLastYear` is true: no meter is ever `NaN` or wider than 100%
   (Phase 3, `hub-model`).
4. Today is Monday, or the week crosses a month or a year: the seven sums, the range label and the
   "today" column are still right (Phase 3, `runs-model` and `hub-model`).
5. A fidget falls due while the tab is hidden, the hub is not the view on screen, or a line is typing;
   and a press lands while he is mid-wander (Phase 3, `canFidget`; Phase 6, stage rules).

## Plan's calls the owner should hear about

None blocks Phase 1. Put them to the owner at the Phase 2 review.

- **The wander's sprite.** The spec says the wander uses "the side trot sprite", which is drawn 40 px
  tall for the finish line. Beside an 80 px Ziggy it has to be shown at 2×, so his pixels double in size
  while he walks. That is what gets built unless the owner prefers the alternative: the eager pose's two
  trot frames, the same side-on trot at his real size and pixel size. Phase 2's review page shows both.
  **Decided at the Phase 2 gate (2026-11-27): the owner chose the hub-size trot at 1×.**
- **Asleep has no talking frame.** The spec lists a mouth-open frame for each of the six moods. While
  "All quiet." types he breathes instead; a sleeping dog that talks reads wrong.
- **Today with no run yet shows nothing in the week's strip,** not a dash. The spec gives a dash to a
  past day and nothing to a day to come, and does not say which today is; a dash before the day is over
  would read as a miss.
- **Six fidgets in v43:** blink, ear flick, tail thump, yawn, shake off, head tilt. The other three
  (sniff, scratch, look back) need new bodies and follow later, as the spec allows.
- **"Orchard 10K is on Sunday."** for a race exactly 7 days away names today's weekday. The spec's rule
  is "1 to 7 days"; it is built as written and pinned by a test.
- **The refresh button's name.** The spec gives it the accessible name "Refresh now" while it shows
  "Synced 2 min ago". Voice-control users say what they see. Built as written; the Phase 7 accessibility
  review reports it as a finding for the owner.
- **"No records yet"** on the records row when there are races but none counts for a record. The spec
  does not cover that case.

---

## Phase 1: the sprite pipeline and the three-frame proof (owner gate)

Proves that single frames can be changed by moving pixels on the grid and still look like him. Three
frames of the happy pose: the still, mouth open (talking), and an ear flick (the fidget).

### Files

| Action | File | Holds |
|---|---|---|
| Add | `scripts/sprite-png.mjs` | `encodePng(width, height, indices, palette)` returns a Buffer: 8-bit indexed PNG (colour type 3), `PLTE` plus `tRNS` with index 0 fully transparent, filter 0 on every row, `zlib.deflateSync`, `zlib.crc32`. `decodePng(buf)` returns `{ width, height, indices, palette }` for files this encoder wrote. |
| Add | `scripts/build-sprites.mjs` | `readPalette()`, `readFrame(sheet, name)`, `sheetIndices(sheet)` (exported for tests), and when run: writes `sprites/ziggy-<sheet>.png` for each sheet in `SHEETS`. `--out <dir>` writes elsewhere. A missing or mis-sized grid is an error naming the file. |
| Add | `js/ziggy-frames.js` | Pure. `SHEETS`, `framePos`, `sheetSize`, `sheetUrl` (below). |
| Add | `sprites/src/palette.txt` | One line per colour: a letter, `#RRGGBB`, a name. At most 16. `.` is transparent and is not listed. |
| Add | `sprites/src/hub/happy.txt`, `happy-talk.txt`, `happy-ear.txt` | Text grids: 88 lines of 96 characters, one palette letter or `.` per pixel. |
| Add | `tests/sprite-png.test.js`, `tests/ziggy-frames.test.js`, `tests/sprites.test.js` | Below. |
| Local only | `.claude/mockups/trace.html`, `ziggy-proof.html`, `ziggy-proof.png`, `proof/` | The tracing page, the proof page, its screenshot, the built proof sheet. |

### `js/ziggy-frames.js`

```js
export const SHEETS = {
  hub:  { cell: [96, 88], cols: 8, frames: ['happy', 'happy-talk', 'happy-ear'] },   // Phase 2 fills the list
  side: { cell: [48, 40], cols: 4, frames: [] },                                      // Phase 2
};
export function framePos(sheet, name)   // { x, y, w, h } in sheet pixels; throws on an unknown name
export function sheetSize(sheet)        // { w, h }: cols × cell wide, a whole number of rows high (at least one)
export function sheetUrl(sheet, base = import.meta.url)   // '../sprites/ziggy-<sheet>.png' resolved against base, keeping base's ?v=
```

- A frame's index is its place in `frames`: column `i % cols`, row `Math.floor(i / cols)`.
- The cell is 96 × 88 because the six locked poses, shrunk so the happy pose is 80 px tall, measure at
  most 90 wide (the trot) and 88 tall (thrilled): see `.claude/mockups/pose-*.png`. Feet stand on the
  cell's bottom row, centred left to right.
- `sheetUrl` is how the sheet gets the same `?v=` as the scripts without touching the stamp script: the
  module's own URL already carries it.

### Starting palette (plan's call; sample the base art and fix the values in this phase)

`o` outline blue-grey, `k` coat black, `d` coat shadow, `g` coat gloss, `w` white, `c` cream shade,
`s` grey shade on white, `t` tan, `u` dark tan, `e` eye amber, `n` nose and pupil, `b` collar blue,
`l` collar light, `p` tongue pink, `m` mouth dark, `h` highlight white. Sixteen, the limit.

### Tests

`tests/sprite-png.test.js`
- "a grid survives encode then decode": 3 × 2 indices and a 3-colour palette come back equal.
- "the file is an indexed PNG with index 0 transparent": signature bytes, IHDR width and height, bit
  depth 8, colour type 3, a `tRNS` chunk whose first byte is 0.

`tests/ziggy-frames.test.js`
- "every named frame lies inside its sheet": for each sheet and name, `x + w <= sheetSize.w` and
  `y + h <= sheetSize.h`.
- "a sheet is a whole number of cells": `w % cell[0] === 0`, `h % cell[1] === 0`.
- "frame names are unique within a sheet".
- "the sheet's address carries the script's version":
  `sheetUrl('hub', 'https://x.test/js/ziggy-frames.js?v=43') === 'https://x.test/sprites/ziggy-hub.png?v=43'`,
  and with no query there is none.

`tests/sprites.test.js`
- "the palette has at most 16 colours, each one letter and #RRGGBB".
- "every frame has a grid of exactly its cell, in palette letters": for each name in `SHEETS`.
- "the outline is one colour": every opaque pixel with a transparent neighbour (up, down, left, right) or
  on the cell's edge is `o`.
- "every hub frame stands on the bottom row".
- "tan is a small accent": in every hub frame, `t` and `u` together are under 4% of the opaque pixels
  (plan's number; tighten it once the approved still is measured).
- "the collar is in every frame": at least one `b`.
- "a talking or ear frame differs from its still only near the mouth or ear": `happy-talk` differs from
  `happy` inside a box at most 24 × 20; `happy-ear` inside a box at most 28 × 28 (the plan's guesses;
  tighten them to the frames the owner approves).
- Phase 2 adds: "the committed sheets are what the grids build" (below).

### Steps

1. Encoder and frame map, test first.
2. `trace.html`: served by the `dashboard` preview server, it draws `ziggy-b6-moods.jpg` on a canvas,
   crops the happy pose (top-left pose; `pose-happy.png` is the same crop already at 71 × 80), turns the
   navy background transparent by flood fill from the corners, shrinks to 80 px tall by taking the most
   common colour in each block (not the average, which smears), snaps every pixel to the nearest palette
   colour, and prints the grid as text. Copy it into `sprites/src/hub/happy.txt`, padded to 96 × 88.
3. Correct it by hand against the spec's markings: narrow frame, slender chest, long thin legs; a thin
   white blaze widening into the white muzzle; two tan eyebrow dots; tan only as a thin edge on the legs,
   a little less than B6 shows; white bib, socks and tail tip; floppy ears; amber eyes; blue collar; a
   one-pixel `o` outline all round. Remove the wag marks beside the tail: movement is real now.
4. `happy-talk.txt` and `happy-ear.txt`: copy the still and move pixels only (lower jaw down two or three
   pixels with `m` and `p` inside; the near ear lifted). The box tests hold you to that.
5. `node scripts/build-sprites.mjs --out .claude/mockups/proof`, then `ziggy-proof.html`: the three
   frames at 1× on `--night` (#0C1424), `--panel` (#131E35) and `--board` (#04070D); the same at 4× with
   `image-rendering: pixelated`; the still beside the B6 crop; and two loops at real speed (still and
   talk every 130 ms; still, ear, still over 1.2 s). Screenshot to `ziggy-proof.png`.
6. **Show the owner and stop.** If a real choice comes up (the outline shade, how far the mouth opens),
   show the variants side by side, up to six, as the owner prefers. Ask for a clear yes.
7. If the owner says the edited frames do not look like him: the spec's fallback ladder, in order. Ask
   before any Leonardo call.
8. On approval: `node scripts/stamp-version.mjs 43`, `node --test`, commit.

### Verify

- `node --test` passes (282 before this phase, plus the new ones).
- Spec check 0, first half: the owner has approved the proof in so many words.

Commit: "Ziggy: sprite pipeline and the three-frame proof".

---

## Phase 2: the full sprite sheets (owner gate)

### Frames

Hub sheet, 96 × 88 cells, 8 columns, 5 rows (768 × 440), three-quarter view. Thirty-three frames:

| Mood | Still | Talking | Movement | Fidget frames |
|---|---|---|---|---|
| happy | `happy` | `happy-talk` | `happy-wag` | `happy-blink`, `happy-ear`, `happy-yawn`, `happy-shake1`, `happy-shake2`, `happy-tilt` |
| thrilled | `thrilled` | `thrilled-talk` | `thrilled-wag` | `thrilled-blink`, `thrilled-ear` |
| eager | `eager` | `eager-talk` | `eager-trot` | `eager-blink`, `eager-ear`, `eager-tail` |
| curious | `curious` | `curious-talk` | `curious-tilt` | `curious-blink`, `curious-ear` |
| worried | `worried` | `worried-talk` | `worried-low` | `worried-glance` |
| asleep | `asleep` | (none) | `asleep-breathe` | `asleep-ear`, `asleep-paw` |

- The five other stills are traced from the same B6 sheet exactly as the happy one was (`pose-thrilled`,
  `pose-trot`, `pose-curious`, `pose-worried`, `pose-asleep` show the crops), all at the happy pose's
  scale so he is one size throughout. Every other frame is a copy of its still with pixels moved.
- **Talking, as the owner chose at the Phase 1 gate (2026-11-27, loop B of three):** he talks by swapping the
  still with the opposite mouth. The happy still has his mouth open with the tongue out, as B6 shows, so
  `happy-talk` is the mouth shut. A mood whose still has the mouth shut gets a mouth-open talking frame.
- The thrilled hop is a CSS lift of the sprite (as `zg-hop` is today), not a frame. Sparks and the z's
  are drawn by CSS beside him, not in the sheet.
- `eager` and `eager-trot` are the two leg frames of the trot at hub size.
- Asleep has no talking frame: while "All quiet." types he breathes.
- First-release fidgets (six of the spec's nine, all pixel edits): blink, ear flick, tail thump, yawn,
  shake off, head tilt. Sniffing the ground, scratching and looking back need new bodies; they follow
  later and are not part of v43.

Side sheet, 48 × 40 cells, 4 columns (192 × 40): `sit` (from `ziggy-b2.jpg`), `trot1` (from
`ziggy-b4.jpg`), `trot2` (`trot1` with the legs gathered, moved by hand), `nap` (the asleep still redrawn
at half size; there is no side-on nap in the base art). Sit is 40 px tall; the others are at its scale.

### Also in this phase

- `js/ziggy-frames.js`: fill both `frames` lists, and add
  `export const HEAD = { happy, thrilled, eager, curious, worried, asleep }`: for each mood's still, the
  x in the cell (px from its left) of the top of his head, read off the grid. The bubble's pointer aims
  there.
- `tests/sprites.test.js` adds:
  - "the committed sheets are what the grids build": `decodePng(readFileSync('sprites/ziggy-hub.png'))`
    has `sheetSize('hub')` and its indices equal `sheetIndices('hub')`; the same for `side`. Compared
    after decoding, not byte for byte, so a different zlib does not fail it.
  - "every talking, blink and ear frame differs from its still only in a small box" (24 × 20, 24 × 8 and
    28 × 28), for every mood. The box sizes are the plan's guesses: set them from the approved Phase 1
    frames, as tight as those allow.
  - "every mood's head point lies inside the cell".
- `node scripts/build-sprites.mjs` writes `sprites/ziggy-hub.png` and `sprites/ziggy-side.png`.

### Review page (local): `.claude/mockups/ziggy-sheet.html`

- The six stills in a row at 1× with no labels, then with labels: each mood must be readable from the
  still alone (spec).
- Every frame at 1× on `--night`, `--panel` and `--board`, and at 4×.
- Each mood's talking loop and movement, and each fidget, at the timings in Phase 3's `steps()` table.
- The side frames at 1× on `--board`, with the trot swapping every 180 ms.
- The wander both ways, moving across a 408 px strip: the side trot at 2× (the spec's wording), and
  the hub-size `eager` trot at 1×. The owner picks.
- The plan's calls listed near the top of this plan, as a short note the owner can answer.

**Show the owner and stop** until they approve the sheets.

### Verify

- `node --test` passes.
- Spec check 0, second half: owner's yes to the sheets. Nothing is wired into the app before it.

Commit: "Ziggy: the full-colour sprite sheets".

Phases 3 to 5 do not use the sprite. By default they still wait for this gate (spec check 0). They may
run while a sheet is with the owner only if the owner says so.

---

## Phase 3: the rules, as pure modules

No visible change to the app. All test first.

### Files

| Action | File | Holds |
|---|---|---|
| Modify | `js/runs-model.js` | `miles()` also returns `days` and `dow`. |
| Add | `js/hub-model.js` | `NOTHING_ON`, `startText`, `timeText`, `weekTile`, `yearTile`, `weekStrip`, `rowNotes`. |
| Add | `js/ziggy-says.js` | `ziggyLines`, `moodCheck`. |
| Add | `js/ziggy-moves.js` | The fidget picker, frame sequences, typing and wander arithmetic. |
| Modify | `js/hub-lines.js`, `tests/hub-lines.test.js` | `startText` and `NOTHING_ON` leave (the file itself goes in Phase 5). |
| Modify | `js/hub.js` | Imports `startText` and `NOTHING_ON` from `./hub-model.js`. Nothing else. |
| Add | `tests/hub-model.test.js`, `tests/ziggy-says.test.js`, `tests/ziggy-moves.test.js` | Below. |
| Modify | `tests/runs-model.test.js` | The daily sums. |

Then `node scripts/stamp-version.mjs 43`.

### `miles()` (`js/runs-model.js`)

Adds `days`: seven sums in the display unit, index 0 the day `weekStart()` returns (Monday) to 6; and
`dow`: `t0 - ws`, today's index in that array. Runs after today are already skipped.

Test, "the week's seven daily sums": build the fixture from `weekStart(todayIdx())` and `todayIdx()`,
never from "n days ago" (that breaks on Mondays). One 5 km run on the week's first day, one 3 km run
today, and one 8 km run tomorrow when today is not the last day. With units km: `days.length === 7`;
`days[0]` is 5, or 8 when `dow === 0`; `days[dow]` is 3, or 8 when `dow === 0`; every later index is 0;
`days` sums to `week`; `dow === todayIdx() - weekStart(todayIdx())`.

### `js/hub-model.js`

```js
export const NOTHING_ON = 'Nothing on the calendar.';
export function startText(r, now = new Date(), locale)   // moved unchanged from hub-lines.js
export function timeText(r, locale)                       // '8:00 AM', or '' without a valid r.time; startText uses it
export function weekTile(mi)    // { value, unit, line, tone, meter }
export function yearTile(mi)    // the same shape
export function weekStrip(mi, locale)   // { range, runs, days: [{ letter, text, fill, today }], label }
export function rowNotes(mi, stats)     // { weeks, latest, records }: the text at the right of each row
```

`tone` is `'go'`, `'slow'` or `null`. `meter` is 0 to 1, or `null` for no meter. With `mi` null (still
loading) a tile is `{ value: '–', unit: '', line: '', tone: null, meter: null }`.

Tests (`MI = { unit: 'mi', week: 5.0, weekAvg: 20.7, ytd: 1098, lytd: 1121, hasLastYear: true,
runsWeek: 2, ws: Date.UTC(2026, 10, 23) / 864e5, dow: 3, days: [0, 3.1, 0, 1.9, 0, 0, 0] }`, locale
`'en-US'`; compare range text after replacing every whitespace character with a plain space):

- "this week, under the usual": `{ value: '5.0', unit: 'mi', line: 'of your usual 20.7', tone: null }`,
  meter close to 5 / 20.7.
- "this week, over": week 22.4 gives `line: '1.7 over your usual'`, `tone: 'go'`, `meter: 1`.
- "this week, a difference that rounds to nothing is not over": week 20.74 gives "of your usual 20.7".
- "this week, no usual yet": `weekAvg: 0` gives `line: ''`, `meter: null`.
- "this year, behind": `value` is `fmt0(1098)`, `line: '23 behind last year'`, `tone: 'slow'`, meter
  close to 1098 / 1121.
- "this year, ahead": `lytd: 1075` gives "23 ahead of last year", `'go'`, `meter: 1`.
- "this year, level": `lytd: 1098.3` gives "level with last year", `null`.
- "this year, nothing to compare": `hasLastYear: false` gives `line: ''`, `meter: null`.
- "this year, last year started later than today's date": `hasLastYear: true, lytd: 0` gives
  "1,098 ahead of last year" (number by `fmt0`) and `meter: 1`; with `ytd: 0` too, `meter: null`.
- "still loading": both tiles for `null`.
- "the strip": `range` "Nov 23 – 29"; `runs` "2 runs"; letters `M T W T F S S`; `text`
  `['–', '3.1', '–', '1.9', '', '', '']`; `today` true at index 3 only; `fill` `[0, 1, 0, 1.9 / 3.1, 0,
  0, 0]`; `label` "This week: Tuesday 3.1 mi, Thursday 1.9 mi".
- "the strip: today with no run yet shows nothing, not a dash": `dow: 4` gives `text[4] === ''`.
- "the strip: one run, no runs": `runsWeek: 1` gives "1 run"; 0 gives `''`, every `fill` 0, and `label`
  "This week: no runs yet".
- "the strip: a week across a month and a year": `ws` for 2026-11-30 gives "Nov 30 – Dec 6"; `ws` for
  2026-12-28 gives a range naming both Dec 28 and Jan 3.
- "the strip in km": `unit: 'km'` puts "km" in the label.
- "row notes": with `stats = { count: 20, podiums: 2, latest: [{ n: 'Orchard 5K', t: 1262 }], records:
  [six rows] }` gives `{ weeks: 'avg 20.7 mi', latest: '21:02, Orchard 5K', records: '6 distances' }`;
  one record gives "1 distance"; a latest race with no time gives its name alone.
- "row notes: nothing loaded, and no races": `rowNotes(null, null)` is three empty strings;
  `count: 0` gives `latest` and `records` "No races yet"; races but no record gives `records`
  "No records yet" (plan's call: the spec is silent).
- "next start: day, time and place…": moved unchanged from `tests/hub-lines.test.js`, with the
  `NOTHING_ON` assertion.

### `js/ziggy-says.js`

```js
export function ziggyLines({ mi, stats, up, sync, now, locale })   // [{ key, mood, parts }], never empty
export function moodCheck(mood)   // the two lines of the check hook, or null for an unknown mood
```

- `mi`: from `miles()`; `null` while the runs are loading; `false` when working it out threw.
- `stats`: from `hubStats()`; `null` while the race history is loading; `false` when it failed.
- `up`: the upcoming rows, or `null` when reading them threw.
- `sync`: `{ running, runsLoaded }`. `now`: a `Date`.
- Lines come out in the spec's table order; every rule that holds contributes one. Keys, in order:
  `fetching`, `raceday`, `record`, `soon`, `weekover`, `latest`, `yearahead`, `weeklow`, `yearbehind`,
  `norun`, `after`, `totals`, and `quiet` only when no other rule held.
- Both `mi` and `stats` false: the answer is the `quiet` line alone, whatever is coming up (spec).
- Numbers: distances by `fmt1` with a trailing ".0" dropped ("5 miles", "22.4 miles"); year totals by
  `fmt0`. Units from `mi.unit`: "miles" or "km".
- Tones (plan's call): `go` on the record time (rule 3), on "1.7 over" (rule 5) and on "23 ahead"
  (rule 7). No line carries `slow`: he never scolds.
- Race names are cut to 28 characters plus "…" in his lines. A name ending in `.`, `!` or `?` gets no
  second stop, as in `hub-lines.js` today.
- Days between dates: whole days from two `YYYY-MM-DD` strings (`isoDay(now)` from `js/upcoming.js` and
  the race's `date`).
- `moodCheck('thrilled')`:
  `[{ key: 'check-1', mood: 'thrilled', parts: [{ text: 'Mood check: thrilled.' }] },
    { key: 'check-2', mood: 'thrilled', parts: [{ text: 'And a second line.' }] }]`.

Tests (`NOW = new Date(2026, 10, 27, 12)`, a Friday at local noon; `MI` as above with `runsToday: 1,
dow: 4`; `race = (over) => ({ id: 7, n: 'Orchard 5K', t: 1262, cls: '5K', date: '2026-11-20',
record: false, ...over })`; `stats = (over) => ({ count: 20, podiums: 2, latest: [race()], ...over })`;
`UP = [{ id: 'u1', n: 'Orchard 10K', date: '2026-12-06', time: '08:00' }, { id: 'u2', n: 'Harbor Half',
date: '2027-01-17' }]`; `sync: { running: false, runsLoaded: true }`; `say(line)` joins the parts' text):

| Test | Input, changed from the base | Expect |
|---|---|---|
| rule 1 | `mi: null`, `sync: { running: true, runsLoaded: false }` | first line `fetching`, eager, "Fetching your runs from Strava." |
| rule 2 | `up[0].date` is today | `raceday`, thrilled, "Race day. Orchard 10K at 8:00 AM." |
| rule 2, no time | the same without `time` | "Race day. Orchard 10K." |
| rule 3 | latest `record: true, t: 1236`, 7 days ago | `record`, thrilled, "20:36! A new 5K record."; "20:36!" toned `go` |
| rule 3 is not rule 6 | the same | no `latest` line |
| rule 3 lapses | the record 15 days ago | no `record` line; `latest` present |
| rule 4 | `up[0].date: '2026-11-29'` | `soon`, eager, "Orchard 10K is on Sunday." |
| rule 4 edges | 1 day, 7 days, 8 days away | present, present ("… is on Friday."), absent |
| rule 5 | `week: 22.4` | `weekover`, happy, "22.4 miles this week, 1.7 over your usual." |
| rule 6 | base | `latest`, happy, "Orchard 5K in 21:02." |
| rule 6, no time; lapses | `t: 0`; 31 days ago | "Orchard 5K."; absent |
| rule 7 | `lytd: 1075` | `yearahead`, happy, `${fmt0(1098)} miles this year, 23 ahead of last year.` |
| rule 8 | `dow: 5` | `weeklow`, worried, "5 miles so far this week. Your usual is 20.7." |
| rule 8 edges | `dow: 4`; `dow: 5, week: 12.5` (just over 60% of 20.7); `dow: 6` | absent; absent; present |
| rule 9 | base | `yearbehind`, worried, "23 miles behind this date last year." |
| rule 10 | `runsToday: 0` | `norun`, eager, "No run yet today. Shall we?" |
| rule 10 gives way | `runsToday: 0, dow: 5` | `weeklow` present, `norun` absent |
| rule 11 | base | `after`, curious, "After that: Harbor Half, Jan 17." |
| rule 12 | base; `podiums: 0`; `count: 1, podiums: 0` | "20 races finished, 2 on an age-group podium."; "20 races finished."; "1 race finished." |
| rule 13 | `mi` with week equal to usual, level year, a run today; `stats` count 0; `up: []` | exactly `[quiet]`, asleep, "All quiet." |
| order | everything that can hold together | keys in the order listed above |
| only the year is ever "behind" | every fixture in this file | no line but `yearbehind` contains "behind"; no part has tone `slow` |
| km | `unit: 'km'` | "km" in rules 5, 7, 8, 9; never "miles" |
| a name with its own stop | `n: 'Run the Mile.'`, `t: 0` | "Run the Mile." |
| a long name | a 40-character name in rules 4 and 6 | cut to 28 characters and "…" |
| races still loading | `stats: null` | no `record`, `latest` or `totals`; no line says "No races" |
| mileage failed | `mi: false` | no `weekover`, `yearahead`, `weeklow`, `yearbehind`, `norun`; no `fetching` |
| both failed | `mi: false, stats: false`, `up` with a race tomorrow | exactly `[quiet]` |
| upcoming unreadable | `up: null` | no `raceday`, `soon`, `after`; the rest as usual |
| the check hook | `moodCheck('asleep')`, `moodCheck('cat')` | two lines, both asleep; `null` |

### `js/ziggy-moves.js`

```js
export const TYPE_MS = 1500;    // a line types out over this
export const TALK_MS = 130;     // mouth open, mouth shut
export const MOOD_MS = 4000;    // the mood's own movement after speaking
export const FIDGETS = {
  happy:    ['blink', 'ear', 'tail', 'yawn', 'shake', 'tilt', 'wander'],
  thrilled: ['blink', 'ear', 'tail', 'wander'],
  eager:    ['blink', 'ear', 'tail', 'wander'],
  curious:  ['blink', 'ear', 'tilt', 'wander'],
  worried:  ['sigh', 'glance'],
  asleep:   ['ear', 'paw'],
};
export function pickFidget(mood, last, rnd = Math.random)   // a name from the mood's set, never `last`
export function fidgetWait(rnd = Math.random)               // ms, 6000 to 14000
export function steps(mood, move)   // [[frame, ms], ...]; move is 'talk', 'mood' or a fidget other than 'wander'
export function typedCount(ms, len)                    // characters shown, ms into the typing
export function carryTyped(typed, wasDone, newLen)     // typed count after the same line's text changed
export function splitParts(parts, n)                   // { on, off }: the parts cut after n characters
export function keepLine(lines, key)                   // { i, fresh }
export function canFidget({ hidden, onScreen, typing, motion })   // boolean
export function wanderTo(x, room, rnd = Math.random)   // a new left edge in 0..room, or x when room < 96
export function wanderMs(dx)                           // ms for that distance, under 2000
```

- `steps()` frame names come from `SHEETS.hub.frames`. `'talk'` is one cycle (the caller repeats it
  while typing). Every sequence but `'talk'` ends on the mood's still. Spec ear flick, tail thump and
  the rest map as: `tail` uses the mood's `-wag` or `-tail` frame, `sigh` uses `worried-low`, `tilt`
  uses `happy-tilt` or `curious-tilt`, `shake` alternates `happy-shake1` and `happy-shake2`.
- Wander is not a frame sequence: the stage moves him and swaps the two frames named in
  `export const WANDER = { sheet: 'hub', frames: ['eager', 'eager-trot'], scale: 1 }` every 150 ms. The
  owner chose this at the Phase 2 gate (2026-11-27) over the spec's side trot at 2×: the same dog at
  the same pixel size. Test: "the wander's frames exist in its sheet and its scale is a whole number".
- Timings the owner saw and approved on the Phase 2 review page; `steps()` carries these (`T` is
  `TALK_MS`, `m` the mood's still, "× n" repeats the pair):

  | Move | Sequence, `[frame, ms]` |
  |---|---|
  | talk (every awake mood) | `m` T, `m-talk` T |
  | mood, happy | (`happy-wag` 250, `happy` 250) × 8 |
  | mood, thrilled | (`thrilled-wag` 120, `thrilled` 120) × 16 |
  | mood, eager | (`eager-trot` 150, `eager` 150) × 13 |
  | mood, curious | `curious-tilt` 900, `curious` 500, `curious-tilt` 900, `curious` 500, `curious-tilt` 900, `curious` 300 |
  | mood, worried | `worried-low` 1600, `worried` 500, `worried-low` 1600, `worried` 300 |
  | mood, asleep (and its talk) | (`asleep-breathe` 1000, `asleep` 1000) × 2 |
  | blink | `m` 400, `m-blink` 120, `m` 220, `m-blink` 120, `m` 400 |
  | ear (awake) | `m` 300, `m-ear` 200, `m` 150, `m-ear` 200, `m` 350 |
  | tail | (`m-wag` or `eager-tail` 150, `m` 150) × 4 |
  | yawn | `happy` 200, `happy-yawn` 1000, `happy` 300 |
  | shake | (`happy-shake1` 90, `happy-shake2` 90) × 6, `happy` 200 |
  | tilt | `m-tilt` 1100, `m` 300 |
  | sigh | `worried-low` 1300, `worried` 300 |
  | glance | `worried-glance` 1100, `worried` 300 |
  | ear (asleep) | `asleep-ear` 150, `asleep` 150, `asleep-ear` 150, `asleep` 600 |
  | paw | `asleep-paw` 180, `asleep` 180, `asleep-paw` 180, `asleep` 500 |

Tests:
- "a fidget is always from the mood's set and never the same twice running": for each mood, 300 draws
  from a seeded generator, feeding each result back as `last`.
- "asleep only twitches, worried only sighs or glances": the two sets, exactly.
- "the wait is 6 to 14 seconds": `fidgetWait(() => 0) === 6000`; `fidgetWait(() => 0.999)` at most 14000.
- "every fidget lasts 1 to 2 seconds and uses real frames": for each mood and each fidget but wander,
  the ms total is 1000 to 2000 and every frame is in `SHEETS.hub.frames`.
- "a mood's movement is about 4 seconds, ends on its still, and nothing reaches 5": totals for `'mood'`
  are 3500 to 4500; no sequence totals 5000 or more.
- "typing": `typedCount(0, 30) === 0`, `(750, 30) === 15`, `(1500, 30) === 30`, `(9999, 30) === 30`,
  `(100, 0) === 0`.
- "the same line with new words keeps its place": `carryTyped(12, false, 40) === 12`;
  `(12, false, 8) === 8`; `(12, true, 40) === 40`.
- "a line cut part-way keeps its tones": `[{ text: '20:36!', tone: 'go' }, { text: ' A new 5K record.' }]`
  at 3 gives `on: [{ text: '20:', tone: 'go' }]` and `off: [{ text: '36!', tone: 'go' }, { text: ' A new
  5K record.' }]`; at 0 everything is `off`; at 99 everything is `on`.
- "the line being shown survives a new list": the key is found at its new index with `fresh: false`; a
  missing or null key gives `{ i: 0, fresh: true }`.
- "no fidget while hidden, off screen, typing or with reduced motion": `canFidget` is true only for
  `{ hidden: false, onScreen: true, typing: false, motion: true }`.
- "a wander stays on the strip, goes somewhere else, and takes under 2 seconds": 200 seeded draws with
  `room: 312` stay in 0..312 and move at least 48 px; `wanderTo(10, 60) === 10`;
  `wanderMs(312) < 2000`; `wanderMs(0) === 0`.

### Verify

`node --test` passes. `?demo` in the preview looks and behaves exactly as before.

Commit: "Hub and Ziggy: the rules as pure modules".

---

## Phase 4: the top bar without the strip

### Files

| Action | File | Holds |
|---|---|---|
| Rename | `js/ticker.js` to `js/status.js` | `statusOf` unchanged, byte for byte in what it returns. Add `statusRow`. Delete `tickerText`, `tickerPose`, `stripMode`, `SEP`. |
| Rename | `tests/ticker.test.js` to `tests/status.test.js` | The seven tests named "status: …" move unchanged. The three "ticker: …", the "pose: …" and the four "strip: …" tests are deleted. New `statusRow` tests. |
| Modify | `js/main.js` | `renderStatus` draws the row. `drawTicker`, `fitTicker`, `layTicker` and the `strip` state go. |
| Modify | `index.html` | The status markup. Then stamp, and regenerate `mock.html`. |
| Modify | `styles.css` | The status line; the strip's rules go. |
| Local only | `mock-fetch.js` | Three switches for the checks (the file is gitignored). |

`mock-fetch.js` answers at once and never fails, and its one 429 sits in a branch the app stopped
calling when Local Legends went. Add, read from the page's query: `?slow=300` delays every answer by
that many ms; `?fail` makes every Strava request reject as a network error does; `?limit` answers the
first Strava API request with a 429, as Strava does (read `js/strava.js` for the headers it expects).

### `statusRow(s, st = statusOf(s))` in `js/status.js`

What the eye sees. `null` when not connected. Otherwise
`{ text, dot, arrow, press, note, tone }`: `dot` is `'ok'`, `'warn'`, `'bad'` or `null`; `note` is the
second row's sentence or `null`; `tone` is the note's colour, `'warn'` or `'bad'`, and `null` whenever
`note` is `null`.

| State | text | dot | arrow | press | note | tone |
|---|---|---|---|---|---|---|
| demo | "Demo" | null | no | no | null | null |
| syncing, with a total | "Races: 3 of 40" | null | no | no | null | null |
| syncing, no total | "Loading runs…" | null | no | no | null | null |
| error | "Retry" | bad | yes | yes | the error sentence | bad |
| paused | "Paused" | warn | no | no | "Paused for Strava's rate limit. Resumes at …" | warn |
| never synced | "Not synced yet" | null | yes | yes | `s.warn` or null | warn |
| synced | "Synced 3 min ago" | ok | yes | yes | `s.warn` or null | warn |

Short labels for the row during a sync (plan's call, so the row never overflows; the announced text
keeps the full label): "Checking for new runs" → "Checking", "Loading your runs" → "Loading runs",
"Scanning your race history" → "Scanning races", "Reading race details" → "Races". Any other label is
used as it is.

Tests: one per row of the table, with the spec's strings; "a storage warning goes to the note, not the
button" (`text` is "Synced 3 min ago" while `statusOf(...).live` still ends ". Storage is full");
"a sync outranks an old error, an error outranks a pause" for the row too; "not connected: no row".

### Edits

- `index.html`, in place of the `.ticker` button and the old Refresh button:

  ```html
  <div class="status" id="status">
    <span id="statusText" class="vh" role="status" aria-live="polite"></span>
    <button type="button" id="refreshBtn" class="sync" aria-label="Refresh now" hidden><i class="sync-dot" id="syncDot"></i><span id="syncText"></span><span class="sync-arrow" id="syncArrow" aria-hidden="true">↻</span></button>
    <span id="statusPlain" class="sync plain" aria-hidden="true" hidden></span>
  </div>
  <p id="statusNote" class="status-note" aria-hidden="true" hidden></p>
  <progress id="progress" aria-label="Sync progress" hidden></progress>
  ```

  `#statusNote` and `#progress` are children of `.top-inner`, after `#status`. The note and the plain
  "Demo" are hidden from screen readers because `#statusText` already says the same.
- `js/main.js`:
  - `renderStatus()`: `#statusText` and the progress values exactly as now; then, inside the same
    `try`, draw `statusRow(...)`: button text, `syncDot` class (`ok`, `warn`, `bad`, or hidden), arrow
    hidden or shown, `aria-disabled="true"` when `press` is false (not `disabled`, so a button with
    focus keeps it through a sync), demo shown in `#statusPlain` with the button hidden, the note's text
    and class.
  - The click handler: `if ($('refreshBtn').getAttribute('aria-disabled') !== 'true') sync(true);`.
  - Delete `drawTicker`, `fitTicker`, `layTicker`, the `strip` object, the `$('ticker')` listener in
    `wireSetup()` (it would throw once the element is gone and stop the app loading), the `resize`
    listener and both `document.fonts` hooks in `init()`, and the imports only they used
    (`tickerText`, `tickerPose`, `stripMode`, `SEP`, `ziggy`, `daysText`, `isoDay`, `miles`). Grep each
    name before deleting its import. Update the comment above `renderStatus`.
- `styles.css`:
  - Tokens on `:root`: `--sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px);`.
    Use them in `body`, `.top`, `#nav` and `.year-head` in place of the `env()` calls there, so a check
    can set the phone's insets.
  - Remove `.ticker` and every `.ticker…` rule, `.tk-dog`, `.tk-win`, `.tk-text`, `.tk-sq`,
    `@keyframes tk-slide`, the `.status progress` and `.status .btn` order rules, the 860 px rules that
    name `.ticker`, and the `.tk-text` line inside the reduced-motion block.
  - `.sync`: 13 px/600, `--mut`, no box, `min-height: 44px`, one line, `inline-flex` with a 7 px gap;
    `.sync-dot` 7 px round (`ok` `--go`, `warn` `--led`, `bad` `--slow`); `[aria-disabled="true"]` has
    the default cursor.
  - Phones: `.status { order: 1 }` and `.datalink { order: 2 }`, so the row reads title, status, Data.
    At 860 px and up no `order`: the document order (title, tabs, Data, Add race, status) is the layout.
  - `.status-note`: its own row (`flex: 1 1 100%; order: 5`), 12 px/600, wraps, `.warn` in `--led`,
    `.bad` in `--slow`, no bottom margin.
  - `.top { position: relative }`; `#progress` is a 3 px bar along its bottom edge, full width
    (`appearance: none`, track `--line`, value `--led`, with the `-webkit-` and `-moz-` parts).

### Verify

1. `node --test` passes.
2. Spec check 4, at 440 × 956 with `--sat: 62px`, a screenshot of each: synced (`mock.html`); syncing
   (`mock.html?slow=300`, taken while `#syncText` shows a count); error (`mock.html?fail`, press the
   button: "Retry" and the sentence); paused (`mock.html?limit`: "Paused" and the sentence). In each,
   `.top-inner.scrollWidth <= .top-inner.clientWidth`; synced and syncing are one row, 60 px under the
   inset; the button is at least 44 px tall; error and paused show the sentence on a second row in red
   and amber.
3. Tab to the status button and start a sync: focus is still on it when the sync ends.
4. `#statusText` changes once per state during a whole mock sync (count with a `MutationObserver`).
5. At 1200 px: the status sits at the right of the bar.
6. Races, a race page and Data still draw; no console errors. (Ziggy is gone from the top bar; the old
   dog is still on the race page and the notes until Phase 6.)

Commit: "Top bar: the sync status is the refresh button; the strip is gone".

---

## Phase 5: the hub at a glance

### Files

| Action | File | Holds |
|---|---|---|
| Modify | `js/hub.js` | The new layout. |
| Delete | `js/hub-lines.js`, `tests/hub-lines.test.js` | `mileLines`, `raceLines`, `hubLines`, `nextParts` and their tests. |
| Modify | `styles.css` | Hub rules; the safe-area tokens; the sentence, strip and record-tile rules go. |
| Modify | `index.html` | Stamp only (a module was deleted). Regenerate `mock.html`. |

### `js/hub.js`

`renderHub(cache, races, up)` keeps its signature. `#view-hub` gets two children that are made once and
never removed: `div.hub-body`, whose children are replaced on every draw, and (from Phase 6) Ziggy's
stage. `.hub-body` is `display: contents`, so its children lay out as the hub's own.

```
#view-hub
  div.hub-body
    h2.vh "Hub"
    section#nextStart.next-start        label "Next start", #nextClock, p.next-race, p.next-when
    div.tiles                            two div.tile: span.label, p.tile-num, p.tile-line, i.meter
    section.days.panel                   p.days-head (range, runs), div.days-strip role="img"
    div.hub-rows                         details.weeks, a.hub-row, details.recs
  (Phase 6: div#ziggyStage)
```

- **Next start:** the clock as now but `led(p2(n))` with no ghost. Under it the race name
  (`r.n || 'Your next race'`) and `startText(r)`. Nothing coming up: `NOTHING_ON` and the Add race
  button, no dog. Unreadable: the note as text.
- **Tiles:** from `weekTile(mi)` and `yearTile(mi)`. The meter is an `<i aria-hidden="true">` with its
  width as a percentage; left out when `meter` is `null`.
- **Days:** from `weekStrip(mi)`. The strip is `role="img"` with `aria-label` the model's `label`;
  everything inside is `aria-hidden`. Not drawn while `mi` is null.
- **Rows**, each at least 44 px, a title at the left and `rowNotes()` text at the right:
  - Last 13 weeks: the existing `weeks()` fold-out; the note goes in its `<summary>`. Stays open across
    redraws as now. Only when `mi` is loaded.
  - Latest results: `<a class="hub-row" href="#races" data-focus="hub-latest">`.
  - Personal records: `<details class="recs">` with `data-focus="hub-recs"` on its summary; inside, one
    row per record: badge, date, time in Manrope, each an `<a href="#race/{id}" data-focus="rec-{id}">`
    with the `aria-label` the tiles have today. It stays open across redraws like the weeks panel.
  - No races, or no records: that row is a plain `div.hub-row` with the note and does nothing.
- **Loading:** tiles from the `null` model; the two race rows with nothing at the right.
- **Failed:** `down(note)` returns `h('p', { class: 'empty races-down' }, note)`, text only. Mileage
  failed: the note in place of the tiles and the days. Races failed: `RACES_DOWN` in place of the two
  race rows.
- Delete: `partNode`, `sentence`, `mileage`, `racesSay`, `latest`, the old `records`, the strip's
  scroll-position restore, the "Data and connection" link, `dogFree`, and the imports of `withZiggy`,
  `routeTile` and `./hub-lines.js`. Focus restore by `data-focus` stays.

### `styles.css`

- Token on `:root`: `--topbar: 61px` (the bar's 60 px and its 1 px rule). `--sat` and `--sab` are
  there since Phase 4.
- Under 860 px: `#view-hub` is a column, `min-height: calc(100dvh - var(--topbar) - var(--sat) -
  var(--tab) - var(--sab) - 18px)` (18 px is `main`'s top padding). Phase 6's stage takes
  `margin-top: auto`, which is what stands him on the tab bar.
- 860 px and up: two columns. Left: `#nextStart`, left-aligned, digits up to 64 px, and the stage under
  it. Right: tiles, days, rows.
- Sizes from the spec: clock centred on phones, no glow (`.next-clock .led` and its lamp layer have no
  `text-shadow`); race name 18 px/800; date line 13 px `--mut`; `.label` 10 px/800 tracked capitals
  (make the existing `.stat .label` rule a plain `.label` rule); tile number Manrope 22 px/800 with its
  unit; tile line 12 px `--mut`, `.go` green, `.slow` red; meter 5 px, track `--line`, fill `--led`;
  day bars `--line` with the fill `--led`, letters 10 px, today's letter `--led`; rows divided by a
  1 px `--line` rule, the note 13 px `--mut`, a chevron at the right.
- Remove: `.say` and every `.say…` rule, `.say-close`, `.next-name`, `.zg-note .say`,
  `.hub-say .zg-note`, `.strip`, `.strip > li`, `.strip-card` (and its part of the shared hover rule),
  `.sc-time`, `.sc-meta`, `.rec-grid` (both rules), `.rec-tile`, `.rec-time`, `.rec-date`, `.hub-sec`.
  Grep `js/` and `index.html` for each before deleting; `.textlink` goes too if the hub's link was its
  only user.

### Verify

1. `node --test` passes.
2. `?demo` at 440 × 956: countdown, two tiles, the seven days, three rows; nothing in dot-matrix but
   the countdown. Screenshot.
3. Fold both panels out, run a mock sync: both stay open; focus on a row survives the redraws.
4. Watch the countdown 10 s with focus on a row: focus does not move.
5. `mock.html` with storage cleared, first paint: tiles show a muted dash, race rows have nothing at
   the right, nothing throws.
6. Demo with no races (edit the demo data locally, do not commit): both race rows read "No races yet"
   and are not links.
7. `?demo` at 1200 px: two columns.

Commit: "Hub at a glance: countdown, two tiles, the week's days, three rows".

---

## Phase 6: Ziggy on the stage, the race page and the notes

Needs the sheets approved in Phase 2.

### Files

| Action | File | Holds |
|---|---|---|
| Rewrite | `js/ziggy.js` | The sprite elements. The dot-matrix frames, `W`, `H`, `FRAMES`, `cellPaths` and `layer` go. |
| Rewrite | `tests/ziggy.test.js` | For the new frame map (below). |
| Add | `js/ziggy-stage.js` | The bubble, the strip he walks on, and the one timer that drives him. |
| Modify | `js/hub.js` | Builds his lines and places the stage. |
| Modify | `js/race-view.js`, `js/races-view.js` | The new dog at scale 1. |
| Modify | `styles.css` | Sprite, stage, bubble; `.finish` refitted; the four `zg-` colour rules and `--collar` go. |
| Modify | `index.html` | Stamp. Regenerate `mock.html`. |

### `js/ziggy.js`

```js
export const poseFrames = (pose) => ...   // pure: 'trot' → ['trot1', 'trot2'], 'nap' → ['nap'], anything else → ['sit']
export function ziggy(pose, scale = 1)    // the side dog: <span class="zg zg-side zg-{pose}" aria-hidden="true">
export const withZiggy = (pose, node, scale = 1) => h('div', { class: 'zg-note' }, ziggy(pose, scale), node);
export function sprite(sheet)             // a cell-sized <span class="zg zg-{sheet}" aria-hidden="true"> showing that sheet
export function setFrame(el, sheet, name) // moves the background to framePos(sheet, name)
```

- The image is `sheetUrl(sheet)`, set as an inline `background-image`. `image-rendering: pixelated`.
  `scale` is now a whole-number multiple of the drawn size (it used to be px per cell). The finish line and the notes use 1; the wander uses `WANDER.scale`, and
  for the trip the stage shows `sprite(WANDER.sheet)` at that scale in place of the hub sprite.
- The side trot's two frames swap by a CSS `steps()` animation on `background-position`, so the
  stylesheet's reduced-motion rule stills it, as today.
- Callers: `js/race-view.js` `dogFor` passes `1` (was `3`); `js/races-view.js` uses the default (was
  `2`); the hub's notes no longer have a dog; `js/main.js` lost its call in Phase 4.

`tests/ziggy.test.js`: "every pose maps to side frames that exist" (`poseFrames` for trot, sit, nap and
an unknown pose, each name in `SHEETS.side.frames`); "the trot is two different frames"; "every mood has
a still, and a talking frame unless it is asleep" (`SHEETS.hub.frames` holds `mood` and `mood-talk` for
the five awake moods, `asleep` and `asleep-breathe`).

### `js/ziggy-stage.js`

`export function ziggyStage(lines, opts)` returns the one stage element (made on first call, the same
node after) and brings it up to date with `lines` from `ziggyLines`. `opts.only`, when it names a fidget
in the mood's set, is played every time in place of a random pick (the check hook below).

```
div#ziggyStage.zs  data-mood  data-state  data-line  data-typed  data-fidget
  button.zs-say data-focus="hub-ziggy"      (a div when there is one line)
    span.zs-on   span.zs-off                 the typed and the still-to-come text; .zs-off has opacity 0
    span.vh " Next line"
  span.zs-tail aria-hidden                   the pointer; two dots when asleep
  div.zs-strip aria-hidden                   the strip he walks on
    span.zs-dog                              sprite('hub'), three i.zs-spark, two i.zs-z
```

- **State** lives in the module, never in storage: the line's key, how many characters are typed, the
  phase (`typing`, `moving`, `still`, `fidget`, `wander`), the last fidget, his x (px from the strip's
  left).
- **A new list** (`ziggyStage(lines)`): `keepLine(lines, key)`. `fresh`: start at line 0 and type from
  0. Otherwise keep the line; if its text changed, swap it and set typed by `carryTyped`. Never restart
  a line because the hub redrew. The stage node is never removed from the page, so focus and the
  running movement carry over.
- **Pressing** the bubble (button) or the dog (a click handler on `.zs-dog`, for pointers; keyboard and
  screen readers have the button) shows the next line, wrapping to the first, and starts typing. A press
  mid-wander puts him at his target at once, sitting. With one line nothing is pressable.
- **Typing:** the text is whole in the page from the first frame; `splitParts(parts, typedCount(ms,
  len))` decides what sits in `.zs-on`. While typing he plays `steps(mood, 'talk')` on repeat. Then
  `steps(mood, 'mood')` once (about 4 s), then the still.
- **Fidgets:** after `fidgetWait()`, if `canFidget(...)` (the tab visible, `#view-hub` on screen, not
  typing, `motionOK()`), play `pickFidget(mood, last)`, then wait again. If not, wait again without
  playing. On `visibilitychange` to hidden, clear the timer; to visible, start the wait afresh. Write
  the fidget's name to `data-fidget`.
- **Where he is:** the stage sets `left` on `.zs-dog` (x) and on `.zs-tail` (x plus `HEAD[mood]`) in
  the same frame. A custom property would not do: it only animates if registered, and an unregistered
  one would jump.
- **Wander:** `wanderTo(x, room)` where `room` is the strip's width less 96. For the trip both elements
  get the same inline `transition: left <wanderMs(dx)>ms linear`, removed when he arrives; the trot
  frames in `WANDER` swap every 150 ms; he is mirrored with `transform: scaleX(-1)` when heading left;
  then the mood's still. So the pointer stays over him the whole way.
- **Reduced motion** (`!motionOK()`): typed is the whole line, the still frame, no timers at all.
- **Check hooks:** `data-line`, `data-typed`, `data-state`, `data-fidget` are there for the checks to
  read and cost nothing.

### `js/hub.js`

- `const lines = forced || ziggyLines({ mi: miDown ? false : mi, stats: stDown ? false : st, up,
  sync: { running: S.syncing, runsLoaded: !!cache }, now: new Date() })`, inside its own `try`: a throw
  logs and leaves the stage as it was.
- `forced`: only when `S.demo`, `moodCheck(new URLSearchParams(location.search).get('ziggy'))`. So
  `?demo&ziggy=thrilled` shows that mood with two lines (spec check 5's test hook). Also only when
  `S.demo`: `&fidget=wander` (or any fidget's name) is passed to the stage as `opts.only`.
- The stage is appended to `#view-hub` once, after `.hub-body`.

### `styles.css`

- `.zg`: block, no repeat, `image-rendering: pixelated`. `.zg-side` 48 × 40, `.zg-hub` 96 × 88.
- Remove `.zg-o`, `.zg-e`, `.zg-w`, `.zg-c`, `.zg-f2`, the two `.zg-trot .zg-f…` rules,
  `@keyframes zg-out` and `zg-in`, and `--collar` from `:root`. `.zg-note` and `zg-hop` stay.
- `.finish` refitted to the 48 × 40 dog: `height: 48px`; `.fin-dog { left: calc(var(--p, 1) * (100% -
  48px)); }`; `.fin-post { right: 56px; }`. Check the sitting dog ends past the post, and the hops clear.
- `.zs`: `margin-top: auto` under 860 px; under the clock at 860 px and up.
- `.zs-say`: the hub's width, 14 px/1.4, `--tx` on `--panel` with a 1 px `--line` border, 10 px radius,
  at least 44 px tall, text left; a focus ring.
- `.zs[data-mood="thrilled"] .zs-say`: an amber burst (`clip-path` with a zig-zag at each end,
  `background: var(--led)`, `color: #1A1200`, no border); tones inside it are bold, not green. Three
  sparks round the dog.
- `.zs[data-mood="asleep"] .zs-say`: a dashed `--line` outline, no fill, `--mut` text; `.zs-tail` is two
  dots; the z's show.
- Sparks and z's drift only while `data-state` is `moving` or `fidget`; otherwise they sit still. The
  shapes are there with reduced motion too.
- `.zs-strip`: 88 px tall, `position: relative`; `.zs-dog` and `.zs-tail` are placed by `left`.

### Verify

1. `node --test` passes.
2. `?demo` at 440 × 956 with the tokens set: he stands on the tab bar's edge with the bubble above him;
   the line types once; pressing gives the next line.
3. `?demo&ziggy=` each of the six moods: the pose, the bubble shape, the movement.
4. A race page: the new dog trots to the post and sits past it; a record hops three times, once. Races
   with no races (local edit) and a forced "not available" note: he sits, he naps.
5. No console errors; the sheets load from `sprites/ziggy-hub.png?v=43`.

Commit: "Ziggy speaks: the bubble, six moods, fidgets and the wander; the new dog everywhere".

---

## Phase 7: the sweep, the README, and the spec's checks

### Edits

- `README.md`: the opening paragraph (the hub is a countdown, two mileage tiles, the week's days and
  three rows, with Ziggy's one line at the foot); the "Your mileage" bullet; replace "The status strip"
  bullet with the status line that is also the refresh button, and a sentence on Ziggy and reduced
  motion. Invented names only.
- Sweep `styles.css` for rules with no user left: for every class and id selector, grep `js/` and
  `index.html`; delete what nothing uses. Sweep `js/` for comments that still say "strip", "ticker",
  "sentences" or "dot-matrix dog".
- `node scripts/stamp-version.mjs 43` and regenerate `mock.html` one last time.

### The spec's checks, each with what passes

All phone checks: 440 × 956, `--sat: 62px; --sab: 34px` unless said. Keep every screenshot in
`.claude/mockups/checks/` and show them to the owner.

| # | Check | How, and what passes |
|---|---|---|
| 0 | Owner approvals | Done in Phases 1 and 2; quote the owner's yes for each in the hand-off. |
| 1 | `node --test` | All pass. |
| 2 | One screen | `mock.html` (not `?demo`), synced, idle, a race coming up, rows folded. At scroll 0: the dog's cell bottom is within 1 px of `#nav`'s top; the bubble's top is at or below the rows' bottom; the bubble is at most two lines; `scrollWidth` is 440. Screenshot. Then 440 × 763 and 390 × 664 with both tokens `0px`: he follows straight after the rows, the page scrolls, and no two of rows, bubble, dog and tab bar overlap at any scroll position. Screenshots. |
| 3 | Desktop | `?demo` at 1200 px: the clock's left edge is left of the tiles'; the stage is under the clock in the left column. Screenshot. |
| 4 | Top bar states | As Phase 4's verify 2, again on the finished page, with the mock's `?slow`, `?fail` and `?limit` switches: synced, syncing, error, paused; `scrollWidth <= clientWidth` on the row in each. Screenshots. |
| 5 | Moods | `?demo&ziggy=<mood>` for all six. Screenshot each settled still at hub size (readable without its label). After a press, `data-state` is `still` within 6.5 s. Over 60 s, a `MutationObserver` on `data-fidget` sees at least two different names, with `still` between them. |
| 6 | Reduced motion | Headless Edge with `--force-prefers-reduced-motion`, the framing page, `--dump-dom` after 6 s of virtual time: `data-typed` equals the line's length at once, `data-state` is `still`, the dog's `left` never changes, the countdown still ticks. Lines complete on every mood. |
| 7 | A sync mid-line | `mock.html?slow=300` with a cache already stored; wait until he is still. Press the bubble (the next line starts typing), and about 600 ms later press the status button. Record `[data-line, data-typed]` on every mutation, and note each hub redraw (a `MutationObserver` on `.hub-body`). Passes when `data-typed` is above 0 and below the line's length at the first redraw, and never goes down while `data-line` is the same. Then with storage cleared: the line changes from `fetching` once the runs load, and only then starts again. |
| 8 | Wander | `?demo&ziggy=happy&fidget=wander`, then wait for the first fidget (6 to 14 s): sample the dog's and the pointer's `getBoundingClientRect()` every frame; the pointer's centre stays within 2 px of the dog's head point in every sample, at least five different positions are seen between the start and the end (so it moved and did not jump), the trip takes between 0.3 and 2 s, and he ends on the mood's still. With reduced motion his `left` never changes. |
| 9 | Keyboard | Tab reaches the bubble; the focus ring shows; Enter gives the next line; `document.activeElement` is still the bubble after it, and after a sync redraw. |

Also: run `design:accessibility-review` on the hub and the top bar (contrast of `--mut` on `--night`
and `--panel`, dark text on the amber burst, 44 px targets, the status button's name against its
visible text). Fix what is a defect; report the button's name to the owner as the spec's choice.

### Every "What is removed" item, and where it goes

| Spec item | Phase |
|---|---|
| `js/hub-lines.js`, `tests/hub-lines.test.js`; `startText` and `NOTHING_ON` move with their tests | 3 (the move), 5 (the delete) |
| `tickerText`, `tickerPose`, `stripMode`, `SEP` and their tests; `statusOf` stays | 4 |
| `drawTicker`, `fitTicker`, `layTicker`, the `strip` state in `js/main.js` | 4 |
| The `.ticker` button in `index.html`; `.ticker`, `.tk-*` in `styles.css` | 4 |
| `.say*`, `.next-name`, `.strip*`, `.rec-grid`, `.rec-tile` | 5 |
| "Whatever else is left without a user" | 7 |
| `README.md`: the status-strip paragraph and the hub's description | 7 |
| The dated note on Phase 6 of the earlier plan | Done on 2026-11-27, with this plan |
| The dot-matrix frames, `cellPaths`, the four `zg-` colour rules; `tests/ziggy.test.js` rewritten | 6 |
| Version stamp v43 | 1 (first stamp), kept through 7 |

Commit: "README and sweep for the hub at a glance; v43". Push to `origin` (Carpe-Canem/RunHub) only when
the owner says. The app icon did not change, so nothing needs re-adding to the home screen.

---

## After each phase (owner's standing preference)

End the session with a ready-to-paste prompt for the next one in a code block, the recommended model and
effort, and any workflow tips.

| Phase | Model and effort | Why |
|---|---|---|
| 1, 2 | Fable 5.2 or Opus 5.5, high | Pixel drawing judged by eye against the base art, shown to the owner. |
| 3 | Sonnet 5.5, medium | Every rule and string is in the tables. |
| 4, 5 | Sonnet 5.5, high | Layout to a mock-up, with removals that can stop the app loading. |
| 6 | Fable 5.2 or Opus 5.5, high | Timing, state across redraws, accessibility. |
| 7 | Sonnet 5.5, high | Mechanical checks; many screenshots. |

Next-session prompt for Phase 1:

```
Run Hub, phase 1 of the "hub at a glance, and Ziggy speaks" plan: the sprite pipeline and the
three-frame proof. Repo C:\Claude\StravaDashboard, branch run-board. Follow "Phase 1" of
docs/superpowers/plans/2026-11-27-hub-at-a-glance-and-ziggy-speaks.md, and read its Constraints first;
the spec is docs/superpowers/specs/2026-11-27-hub-at-a-glance-and-ziggy-speaks-design.md.

Build the dependency-free PNG encoder and build script, js/ziggy-frames.js and their tests, test first.
Then redraw Ziggy's happy pose on a true 96 x 88 pixel grid from the locked base art in
.claude/mockups/ziggy-b6-moods.jpg (ziggy-b2.jpg and ziggy-b4.jpg are the same dog side-on, for
reference), and make two more frames from it by moving pixels only: mouth open, and an ear flick.

Decisions already made: frames are text grids in sprites/src/, at most 16 colours, a one-pixel
blue-grey outline, transparent background; no Leonardo call in this phase (ask me before using
.claude/mockups/leo_run.py for anything); .claude/ stays uncommitted; this is a public repo.

Done means: node --test passes, and you have shown me a rendered proof page (the three frames at 1x on
the app's three backgrounds, enlarged 4x, beside the base art, with the talking and ear loops) and
stopped for my approval. Commit only after I approve; do not push.
```

Tips:

- Approve the proof on your phone if you can: at 1× on a 440 px screen is how he will be seen.
- If the three frames look right, say whether the outline shade and the mouth are right too; Phase 2
  repeats both thirty times.
- Phases 3 to 5 do not touch the sprite. If you want them to run while you look at a sheet, say so in
  the prompt; otherwise the order is strict.
