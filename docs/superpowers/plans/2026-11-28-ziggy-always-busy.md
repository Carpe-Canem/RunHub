# Ziggy Is Always Busy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ziggy, the pixel dog at the foot of the Hub, chains activities back to back between his lines instead of standing still, first with today's frames (v51), then with new art phase by phase.

**Architecture:** A new pure module, `js/ziggy-play.js`, holds the activity table and turns one activity into a concrete list of steps (poses and travels) for a strip width, a position and a random source. `js/ziggy-stage.js` keeps its one timer and plays that list, then asks for the next activity, with no wait in between. `js/ziggy-frames.js` learns where the head is and which way a frame faces, so the bubble pointer follows him.

**Tech Stack:** Plain ES modules in the browser, no dependencies, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-28-ziggy-always-busy-design.md`

## Global Constraints

- No pause or stop control. Reduce Motion is the only way to still him (the 5-second rule is dropped, owner 2026-11-28).
- `SHEETS.hub.frames` is append-only: new names go on the end.
- Every hub frame's name starts with one of the six moods; sprite tests (palette, one-colour outline, bottom row, tan < 1.5 %) hold for every frame.
- The strip stays 88 px high; the Hub fits 440 × 956 with no scroll (v48).
- Nothing about him is stored; a reload starts from the first line, in the middle.
- An activity lasts 4 to 12 s, never the same one twice running (asleep has one and is exempt).
- Adding a `js/*.js` file needs `node scripts/stamp-version.mjs` (no argument) or `tests/versions.test.js` fails on the import map.
- Ship: `node scripts/stamp-version.mjs <n>`, a plain-words entry at the top of `CHANGES` in `js/version.js`, commit on `run-board`, `git push origin run-board`, `git push origin run-board:main` (fast-forward).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Tab hidden mid-travel, then shown:** he lands at the travel's end (no slide left half-run) and starts a fresh activity. Checked in Task 5.
2. **A strip too narrow to walk on** (room under 96 px): every activity still lasts 4 to 12 s, made of poses only. Pinned in Task 2.
3. **A press mid-travel or mid-beat:** he lands, faces the way he was drawn, talks, then plays the mood movement and resumes activities. Pinned in Task 4 (state) and checked in Task 5.
4. **The strip narrows under him** (phone rotated): planned travels start from his clamped place and stay inside the new room. Pinned in Task 2.
5. **Reduce Motion switched on mid-activity:** he is on the mood's still by the end of the current step at the latest, and nothing starts again. Checked in Task 5.

---

## Phase 1: the engine with today's frames (v51)

### Task 1: Head points and facing

**Files:**
- Modify: `js/ziggy-frames.js`
- Test: `tests/ziggy-frames.test.js`

**Interfaces:**
- Produces: `FRAME_HEAD: { [hubFrame]: number }`, `headAt(frame: string, flipped: boolean) -> number`, `facesLeft(frame: string) -> boolean`.

- [ ] **Step 1: Write the failing tests** in `tests/ziggy-frames.test.js`:

```js
test('a frame\'s head point: its own, else its mood\'s still, mirrored when flipped', () => {
  for (const [name, x] of Object.entries(FRAME_HEAD)) {
    assert.ok(SHEETS.hub.frames.includes(name), name);
    assert.ok(Number.isInteger(x) && x >= 0 && x < 96, `${name}: ${x}`);
  }
  assert.equal(headAt('eager-trot', false), FRAME_HEAD['eager-trot'] ?? HEAD.eager);
  assert.equal(headAt('happy', false), HEAD.happy);
  assert.equal(headAt('happy', true), 95 - HEAD.happy);
  for (const name of SHEETS.hub.frames) {
    const x = headAt(name, true);
    assert.ok(x >= 0 && x < 96, name);
  }
});

test('worried and asleep frames face left, the rest right', () => {
  for (const name of SHEETS.hub.frames) assert.equal(facesLeft(name), /^(worried|asleep)/.test(name), name);
});
```

Also retitle the existing "the hub sheet is 768 × 440 with 33 frames" test to "39 frames" (its assertion already says 39).

- [ ] **Step 2: Run** `node --test tests/ziggy-frames.test.js`. Expected: FAIL, `headAt` is not exported.

- [ ] **Step 3: Implement in `js/ziggy-frames.js`.** `headAt` returns `FRAME_HEAD[frame] ?? HEAD[frame.split('-')[0]]`, mirrored as `cell width - 1 - x` when flipped. Fill `FRAME_HEAD` by reading `sprites/src/hub/*.txt`: an entry for each frame whose top-of-head x differs from its mood still's `HEAD` by more than 4 px (expected: the look-back, sniff and tilt frames). `HEAD` keeps its six keys.

- [ ] **Step 4: Run** `node --test tests/ziggy-frames.test.js`. Expected: PASS.

- [ ] **Step 5: Commit** `js/ziggy-frames.js tests/ziggy-frames.test.js`: "Ziggy: a head point and facing for every frame".

### Task 2: The activity planner

**Files:**
- Create: `js/ziggy-play.js`
- Create: `tests/ziggy-play.test.js`
- Modify: `index.html` (via `node scripts/stamp-version.mjs`, no argument)

**Interfaces:**
- Consumes: `FIDGETS`, `steps(mood, move)`, `wanderTo(x, room, rnd)` from `js/ziggy-moves.js`.
- Produces:
  - `ACT_MIN = 4000`, `ACT_MAX = 12000`.
  - `ACTIVITIES: { [mood]: { [name]: weight } }`, phase 1 values:
    - happy, thrilled, eager, curious: `{ stroll: 3, dash: 2, potter: 2 }`
    - worried: `{ mope: 1, fret: 1 }`
    - asleep: `{ doze: 1 }`
  - `Step = { pose: [[frame, ms], ...] } | { travel: { to: number, ms: number, frames: string[], frameMs: number } }`
  - `pickActivity(mood, last, rnd = Math.random) -> name`: weighted, never `last` unless it is the mood's only activity.
  - `planActivity(mood, name, { x, room, rnd = Math.random, beat = null }) -> Step[]`. `beat`: a fidget name that every beat must use (the `?fidget=` hook).
  - `planMs(list: Step[]) -> number`: total ms.
  - `travelMs(dx, pace: 'walk' | 'run') -> number`: walk 5.5 ms/px up to 2600 ms; run 2.4 ms/px up to 1200 ms. Frames: walk `['eager', 'eager-trot']` at 150 ms; run the same at 90 ms.

What the activities are made of (beats are the mood's `FIDGETS` other than `wander`, played with `steps()`):
- **stroll:** walk to `wanderTo(x, room)`, then one or two beats.
- **dash:** run to `wanderTo`, a tail or wag beat, run to another `wanderTo`, a beat.
- **potter:** two or three beats, with a walk between them.
- **mope / fret** (worried): sigh, glance and `worried-low` poses chained, in place.
- **doze** (asleep): `asleep-breathe` / `asleep` throughout, with ear and paw twitches between.

Rules for every plan: drop travels when `room < 96`; pad with beats until `planMs` is at least `ACT_MIN`; stop adding before `ACT_MAX`; the first and last steps are poses, and the last frame is the mood's still.

- [ ] **Step 1: Write the failing tests** in `tests/ziggy-play.test.js` (use the seeded generator from `tests/ziggy-moves.test.js`):

```js
test('every activity lasts 4 to 12 s, uses real frames and ends on the still', () => {
  for (const [mood, set] of Object.entries(ACTIVITIES)) for (const name of Object.keys(set)) {
    for (const room of [0, 60, 96, 312, 1200]) for (let i = 0; i < 50; i++) {
      const plan = planActivity(mood, name, { x: room / 2, room, rnd });
      const ms = planMs(plan);
      assert.ok(ms >= ACT_MIN && ms <= ACT_MAX, `${mood} ${name} room ${room}: ${ms}`);
      assert.ok(plan[0].pose && plan.at(-1).pose);
      assert.equal(plan.at(-1).pose.at(-1)[0], mood);
      for (const st of plan) for (const f of st.pose ? st.pose.map(([n]) => n) : st.travel.frames) assert.ok(SHEETS.hub.frames.includes(f), f);
    }
  }
});

test('travels stay on the strip, start from where he is, and vanish when it is too narrow', () => {
  // x beyond room: the strip narrowed under him.
  for (const [x, room] of [[0, 312], [312, 312], [500, 312], [40, 95], [40, 0]]) for (let i = 0; i < 50; i++) {
    const travels = planActivity('happy', 'dash', { x, room, rnd }).filter((s) => s.travel);
    if (room < 96) assert.equal(travels.length, 0);
    for (const { travel: t } of travels) assert.ok(t.to >= 0 && t.to <= room && t.ms > 0);
  }
});

test('the picker never repeats, plays the whole set, and asleep always dozes', () => {
  for (const [mood, set] of Object.entries(ACTIVITIES)) {
    const names = Object.keys(set); let last = null; const got = new Set();
    for (let i = 0; i < 300; i++) {
      const next = pickActivity(mood, last, rnd);
      assert.ok(names.includes(next));
      if (names.length > 1) assert.notEqual(next, last);
      got.add(next); last = next;
    }
    assert.equal(got.size, names.length, mood);
  }
  assert.equal(pickActivity('asleep', 'doze', rnd), 'doze');
});

test('worried never travels', () => {
  for (const name of Object.keys(ACTIVITIES.worried)) for (let i = 0; i < 50; i++) {
    assert.ok(planActivity('worried', name, { x: 150, room: 312, rnd }).every((s) => s.pose));
  }
});

test('a beat hook makes every beat that fidget', () => {
  const sniff = JSON.stringify(steps('happy', 'sniff'));
  for (let i = 0; i < 50; i++) {
    for (const s of planActivity('happy', 'potter', { x: 150, room: 312, rnd, beat: 'sniff' })) if (s.pose) assert.equal(JSON.stringify(s.pose), sniff);
  }
});

test('travel times', () => {
  assert.equal(travelMs(100, 'walk'), 550);
  assert.equal(travelMs(-100, 'run'), 240);
  assert.equal(travelMs(5000, 'walk'), 2600);
  assert.equal(travelMs(5000, 'run'), 1200);
});
```

- [ ] **Step 2: Run** `node --test tests/ziggy-play.test.js`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `js/ziggy-play.js`** to the interface above. Pure: no DOM, no timers. Track `x` through the plan so a second travel starts where the first ended. Clamp the starting `x` to `room`.

- [ ] **Step 4: Run** `node scripts/stamp-version.mjs` then `npm test`. Expected: all PASS (the import map now lists `ziggy-play.js`).

- [ ] **Step 5: Commit** `js/ziggy-play.js tests/ziggy-play.test.js index.html`: "Ziggy: an activity planner".

### Task 3: Drop the wait and the 5-second bounds

**Files:**
- Modify: `tests/ziggy-moves.test.js`

**Interfaces:**
- Removes: `fidgetWait`. Everything else in `ziggy-moves.js` stays, `FIDGETS` and `WANDER` unchanged.

- [ ] **Step 1: Edit the tests.** Delete "the wait is 6 to 14 seconds". In "a mood's movement is about 3 seconds…" delete the `TYPE_MS + total(seq) <= 4700` and `total(s) < 5000` assertions and the comment about WCAG 2.2.2; keep the length range, real-frames and ends-on-the-still checks. In "every fidget lasts 1 to 2 seconds" keep it as is (fidgets are still 1 to 2 s beats). Drop `fidgetWait` from the import.
- [ ] **Step 2: Run** `node --test tests/ziggy-moves.test.js`. Expected: PASS. Leave the `fidgetWait` export in place: the stage still imports it, and Task 4 removes both.
- [ ] **Step 3: Commit** `tests/ziggy-moves.test.js`: "Ziggy: the 5-second bounds go (owner, 2026-11-28)".

### Task 4: The stage plays activities back to back

**Files:**
- Modify: `js/ziggy-stage.js`, `js/hub.js:145-152`, `styles.css:257-260`
- Test: `tests/ziggy-stage.test.js`

**Interfaces:**
- Consumes: `pickActivity`, `planActivity`, `ACTIVITIES` (Task 2); `headAt`, `facesLeft` (Task 1); `canFidget`, `steps`, `FIDGETS` (moves).
- Produces: `START` gains `flip: false` and `act: null`. `ziggyStage(lines, { only, activity })`: `activity` is an activity name of the mood's set to play every time.

State and phases:
- `phase` values: `'typing'`, `'moving'`, `'play'` (a pose step of an activity), `'wander'` (a travel step; `to` is its end, as today), `'still'` (Reduce Motion only).
- `show()` (a new line) resets `flip` to false; `onLines` with a kept line leaves `phase`, `flip` and `act` alone.

Behaviour:
- After the mood movement, `next()` starts an activity instead of `settle()` + `wait()`. `next()` checks `canFidget(...)` and `s.x !== null`; if it may not play it calls `stop()` and returns (no re-wait, so no spin). Otherwise: pick (the `activity` hook wins when it is in the mood's set), plan with `{ x: s.x, room: strip.clientWidth - CELL, beat: only in FIDGETS[mood] ? only : null }`, set `phase: 'play'`, `act`, and run the steps; after the last step, `next()` again.
- A travel step generalises `wander()`: same transition-on-`left` and clock-ended slide with `GRACE`, frames from the step. He flips when `dx < 0` and the frame faces right, or `dx > 0` and it faces left; `s.flip` keeps that after the travel, through the following poses and activities, until a new line.
- Every frame change goes through one helper that calls `setFrame` and, outside a travel, sets the pointer to `x + headAt(frame, s.flip)`. During a travel the pointer's offset is fixed at the travel's start (so its own slide is never restarted).
- Restart points: `seen()` when shown (typing → `type()`, else `land()` then `next()`); `fit()` when the strip has width again and `timer === null`, motion is on, the tab is shown and no line is typing; the end of `ziggyStage()` where `settle()` is called today.
- `land()` is for interruptions only (a new line, a press, a reset, Reduce Motion, the tab shown again): it cancels slides and resets the flip and the transform. Between steps only the travel's transition is cleared, so he keeps facing the way he went.
- `draw()` writes `data-activity` = `s.act || ''` beside `data-fidget`.
- `hub.js`: `ziggyStage(lines, { only: q && q.get('fidget'), activity: q && q.get('activity') })`; the comment above names `&activity=<name>`.
- `styles.css`: the spark and z selectors for `[data-state="moving"]` and `[data-state="fidget"]` also cover `play` and `wander`.

- [ ] **Step 1: Write the failing tests** in `tests/ziggy-stage.test.js`:
  - In "new words for the same line…", the phase list becomes `['moving', 'still', 'fidget', 'play', 'wander']`.
  - New: "a new line faces him the way he was drawn": `onLines({ ...s, phase: 'play', flip: true, act: 'stroll' }, [line('c', 'New.')], true)` gives `flip: false` and `phase: 'typing'`; a kept line keeps `flip: true`, `act: 'stroll'`, `phase: 'play'`.
  - New: "a press mid-activity lands him and the next line types": from `{ phase: 'wander', x: 30, to: 210, flip: true, act: 'dash' }`, `onPress` gives `x: 210, to: null, phase: 'typing', flip: false`.
- [ ] **Step 2: Run** `node --test tests/ziggy-stage.test.js`. Expected: FAIL on the new assertions.
- [ ] **Step 3: Implement** the behaviour above in `js/ziggy-stage.js`, `js/hub.js`, `styles.css`. Remove `wait()`, `due()` and `wander()` (its slide code moves into the travel step), and `fidgetWait` from both `ziggy-moves.js` and the stage's import.
- [ ] **Step 4: Run** `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `js/ziggy-stage.js js/ziggy-moves.js js/hub.js styles.css tests/ziggy-stage.test.js tests/ziggy-moves.test.js`: "Ziggy plays activities back to back".

### Task 5: Check in the browser and ship v51

**Files:**
- Modify: `js/version.js` (CHANGES), `index.html` (stamp)

- [ ] **Step 1: Preview.** `preview_start {name: "dashboard-nostore-8098"}`, open `http://localhost:8098/index.html?demo`, show the pane (`mcp__ccd_view__show_pane {pane: "preview"}`), viewport 440 × 956.
- [ ] **Step 2: Watch each mood** with `?demo&ziggy=<mood>` for all six. Sample `#ziggyStage` `data-state`, `data-activity` and the dog's `left` every 250 ms for 40 s with `javascript_tool`. Expected: after the first line has typed, `data-state` is only ever `moving`, `play` or `wander`; the frame (`background-position`) never stays the same for more than 1.5 s; at least three different activities for the awake moods; worried's `left` never changes.
- [ ] **Step 3: Pointer.** Screenshot mid-walk left, mid-walk right and on a look-back beat. Expected: the pointer over his head each time.
- [ ] **Step 4: Review Focus 1, 3, 5.** Hidden then shown mid-travel (switch tab or `document.dispatchEvent` after setting the pane hidden): he lands and resumes. Press the bubble mid-travel: he lands, unflips, types. Reduce Motion: headless Edge `--force-prefers-reduced-motion --virtual-time-budget=6000 --dump-dom` (memory `headless-edge-for-checks`): `data-state="still"`, no `data-activity`.
- [ ] **Step 5: Fit.** `document.scrollingElement.scrollHeight <= 956` at 440 × 956.
- [ ] **Step 6: Ship.** Add `{ v: '51', date: '<today>', items: ['Ziggy is always up to something: he strolls, dashes about and potters between his lines.'] }` at the top of `CHANGES`; `node scripts/stamp-version.mjs 51`; `npm test` (PASS); commit "Ziggy is always busy; v51"; `git push origin run-board`; `git push origin run-board:main`.

**Phase 1 gate:** the owner watches v51 on their phone before the art phases start.

---

## Phases 2 to 5: new art

Each phase follows the same steps. The exact frames, props and timings come from the owner's mock-up picks, so they are decided in that phase's session, not here.

1. **Leonardo pose sheet.** Look-only prompt in the approved 16-bit outlined style (narrow frame, black and white, tan a small accent, white bib and socks, blue collar; memory `ziggy-markings`), no name. Ask before uploading any photo. Owner's credits: one round per phase, a second only if the owner asks.
2. **Mock-ups.** About six rendered options per visual choice, on the real Hub at 440 × 956 (memory `design-choices-by-mockup`). The owner picks.
3. **Trace** the chosen poses with `.claude/mockups/trace2.mjs`, patch with `paint.mjs` / `move.mjs`, view with `view.mjs`; append the frames to `SHEETS.hub.frames`; `node scripts/build-sprites.mjs`; the sprite tests pass. Update the sheet-size test.
4. **Activities.** Add the activity to `ACTIVITIES` and `planActivity`, `FRAME_HEAD` entries for new frames, tests as in Task 2.
5. **Check and ship** as in Task 5, next version number.

| Phase | Adds | Removes |
|-------|------|---------|
| 2. Walk and run | walk and run cycles; `stroll`, `dash`, `potter` use them | the borrowed eager trot for happy, thrilled, curious |
| 3. Ball | `props` sheet (`sprites/src/props/`, `sprites/ziggy-props.png`, `SHEETS.props`), a `{ prop: { name, frames, from, to, ms } }` step, a prop element on the strip that `land()` clears; ball frames; pounce and carry poses; a `ball` activity | |
| 4. Chew toy and rope | toy and rope props; lie-and-chew and tug poses; `chew` and `tug` activities | |
| 5. Rest | lie down, nap, roll over, dreaming paws; head-low walk; `rest` for awake moods, `pace` for worried, roll-over and dreams in `doze` | |
| 6. Bubble and voice | a bubble look per mood, bark stickers outside the text, every line reworded in a puppy voice under a length cap; planned in detail in "Phase 6" below | the plain panel bubble for happy, eager, curious, worried |

Props colours: if a picked prop colour is not in `sprites/src/palette.txt`, props get `sprites/src/props-palette.txt` (at most 16) and the build and sprite tests read it for the props sheet only.

---

## Phase 6: the bubble and his voice (v58)

**Goal:** the bubble gets a look of its own per mood, every line is reworded in a puppy voice with two or three wordings that take turns, and short barks appear as pixel stickers over space already there. The Hub gets no taller.

**Architecture:** `ziggyLines` stays pure and now gives each line all its wordings (`ways`). The stage, which alone knows when a line is shown again, picks the wording: a turn per line key, started from a random number once per page load, moved on each time that line is shown afresh. A redraw that keeps the line keeps its wording. Barks are frames of a new `barks` sheet (props palette), chosen by a pure picker and shown by the stage beside the line. Bubble looks are CSS per `data-mood`, as thrilled and asleep are today.

**Spec:** `docs/superpowers/specs/2026-11-28-ziggy-always-busy-design.md`, section "Phase 6: the bubble and his voice".

### Phase 6 constraints

- When a line is said and the facts it carries stay as they are; only the words around the facts change. No new rules, no new moods.
- **The cap, measured 2026-11-28 at 440 × 956:** the bubble's text box is 376 px wide (408 px bubble, 16 px padding each side). Every line today fits one row with a realistic long name; the widest is `raceday`, 52 graphemes, 351 px (thrilled, weight 600). So: every wording of every rule, with the worst inputs below, is at most **52 graphemes** (node test) and **one row** in the browser in its mood's look (browser check).
- Worst inputs: a name cut at `NAME_MAX` (28, today) such as `The Orchard And Harbor Invit…`; times `1:23:45` and `10:30 AM`; class `Half Marathon`; week `122.4` with `22.4` over; year `12,345` with `1,234` ahead or behind; usual `120.7`; weekday `Wednesday`; date `Sep 30`; `120` races, `12` podiums.
- `NAME_MAX` changes only if the owner picks it in Task 6.1 (the name rules have little room for voice at 28).
- The fact comes first or is in the green `go` highlight. Only `yearbehind` says "behind"; no line scolds (the existing sweep test).
- Text contrast at least 4.5:1 on every look; the focus ring stays visible on every look.
- Stickers: `aria-hidden`, never part of the bubble's text; his blue-grey `o` outline; static under Reduce Motion; clear of the z's (up to 35 px over his head), the pointer and the thrilled sparks. A sticker on the strip stays on it: he speaks wherever he stopped, ends included, so a bark that would leave the strip goes to his other side.
- Each wording keeps the fact first or in the highlight, as today's line does (a candidate that opens with filler and no highlight is rejected).
- Nothing stored: the random start is per load.
- Ship as v58 the same way as the earlier phases.

### Review Focus

1. **Data arrives mid-line** (runs load while a line types): a kept line keeps its wording; only its numbers change. Pinned in Task 6.2.
2. **One line only** (`quiet`, or one rule holds): a press does nothing, the wording stays, no sticker repeats on a redraw. Pinned in Task 6.2 and Task 6.4.
3. **The longest name in the tightest look:** the picked look with the most inset (paw corners, double edge) still holds the 52-grapheme worst case on one row. Checked in Task 6.5.
4. **Reduce Motion:** the line is whole at once and the sticker shows without moving, then goes. Checked in Task 6.5.
5. **km and singulars:** `km` lines and `1 race finished` fit and read right in every wording. Pinned in Task 6.3.

### Picks (filled in after Task 6.1)

| Choice | Pick |
|--------|------|
| Bubble look per mood (happy, thrilled, eager, curious, worried, asleep) | |
| Sticker size and placement | |
| Barks per mood, and per line where set | |
| Stickers on activity beats too, or with lines only | |
| Wordings per rule (2 or 3 each, as in the options page or as edited) | |
| `NAME_MAX` | 28 unless picked |

### Task 6.1: Mock-up round (gate)

**Files:** `.claude/mockups/voice/` only (local, never committed).

- [ ] **Step 1: Captures.** With `.claude/mockups/walk/cap.html` grown to hide the whole stage (`.zs-say`, `.zs-tail`, `.zs-dog`), the banner hidden and safe areas 62/34, capture `index.html?demo` at 440 × 956 with headless Edge, and record the bubble, pointer and strip rectangles.
- [ ] **Step 2: Options page** `voice/ziggy-voice-options.html`, self-contained (Manrope embedded as a data URI, the hub sheet and stickers as data URIs): about six bubble families that differ in kind, each on a phone at 440 × 956 drawn as live CSS over the capture, switchable through the six moods, each mood shown with its worst-case line; each family with a different sticker placement; a wordings table for all 13 rules, two or three per rule, each with its worst-case grapheme count and one-row check measured in the page, editable in place.
- [ ] **Step 3: Check** every look's text contrast (at least 4.5:1) and one-row fit in the page before sending.
- [ ] **Step 4: Send** with `SendUserFile` and stop for the owner's picks. Write them into the Picks table above and commit the plan.

### Task 6.2: Lines carry their wordings; the stage takes turns

**Files:**
- Modify: `js/ziggy-says.js`, `js/ziggy-stage.js`, `tests/ziggy-says.test.js`, `tests/ziggy-stage.test.js`

**Interfaces:**
- Produces:
  - `ziggyLines(...) -> Line[]`, `Line = { key, mood, ways: Part[][] }`, one or more wordings; `moodCheck(mood)` likewise (one wording each).
  - `wordsFor(line: Line, n: number) -> { key, mood, parts }`: `parts = ways[n % ways.length]`. This is the shape `lengthOf` and `splitParts` take; they do not change. `keepLine` reads only `key`, so it takes the raw lines as they are.
  - Stage: `START` gains `turns: {}` and `seed: 0`. `show()`, `onLines()` and `onPress()` take the raw lines. `show()` first moves `turns[key]` on by one for the line it shows, then computes `len` from the wording about to be shown, `wordsFor(raw[i], s.seed + turns[key])`; `onLines` with a kept line leaves `turns` alone and computes `len` from that line's current wording. Everything that draws reads `wordsFor(raw[s.i], s.seed + (s.turns[key] ?? 0))`. `ziggyStage` sets `seed` once per load from `Math.floor(Math.random() * 6)` (6 covers both 2 and 3 wordings).

- [ ] **Step 1: Failing tests.**
  - `ziggy-says`: `check()` and `say()` read `ways[0]`; a new test "every line has one to three wordings, each a list of parts" over the existing sweep of cases; "the check hook" expects `ways: [[{ text: 'Mood check: thrilled.' }]]`.
  - `ziggy-stage`: "a line shown again takes its next wording": two raw lines, each with two `ways`; press, press, press from line 0: line 0's words differ between its first and second showing, and after each `show()` `len` equals `lengthOf` of the wording shown (two ways of different lengths). "a redraw keeps the wording": `onLines` with the same raw lines mid-typing gives the same `parts` and the same `turns`. "one line: a press keeps its words".
- [ ] **Step 2: Run** `npm test`. Expected: FAIL on `ways` and `turns`.
- [ ] **Step 3: Implement.** In `ziggy-says.js`, `line(key, mood, ...ways)` where each way is an array of parts (strings or `t(text, tone)`); today's wording is the only way for now. In the stage, keep the raw lines and voice them through `wordsFor` wherever `lines[i]` is read today.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** "Ziggy's lines carry their wordings; a line shown again takes the next".

### Task 6.3: His voice

**Files:**
- Modify: `js/ziggy-says.js`, `tests/ziggy-says.test.js`

**Interfaces:**
- Consumes: the Picks table's wordings (and `NAME_MAX` if picked).
- Produces: `WORDINGS_CAP = 52` exported from `js/ziggy-says.js`.

- [ ] **Step 1: Failing tests.**
  - Every exact-text test (rules 1 to 13, km, stops, long and empty names, emoji cut) checks the picked wording in every `ways` entry: one `check(line, mood, [text1, text2, ...])` per rule. These change on purpose (owner, 2026-11-28).
  - "each wording keeps its facts": for each rule, every way contains the same numbers and names as today's line (`/22\.4 over/`, the name, the time, the weekday, the date), and the toned parts are the same texts.
  - "every wording fits the cap": with the worst inputs of the constraints above, in miles and in km, every way of every rule is at most `WORDINGS_CAP` graphemes (`graphemes()` from `ziggy-moves.js`).
  - "only the year is ever behind" and the toned-part checks run over every way.
- [ ] **Step 2: Run** `node --test tests/ziggy-says.test.js`. Expected: FAIL on the new texts.
- [ ] **Step 3: Implement** the picked wordings, the facts in the same order of importance, the same `go` parts.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** "Ziggy talks like a puppy: two or three wordings per line, under the cap".

### Task 6.4: Bark stickers

**Files:**
- Modify: `js/ziggy-frames.js` (`SHEETS.barks`), `js/ziggy-says.js` (barks table and picker), `js/ziggy-stage.js`, `styles.css`
- Create: `sprites/src/barks/*.txt`, `sprites/ziggy-barks.png` (built)
- Test: `tests/ziggy-frames.test.js`, `tests/ziggy-says.test.js`, `tests/ziggy-stage.test.js`

**Interfaces:**
- Produces:
  - `SHEETS.barks = { cell: [w, h] from the pick, cols, palette: 'props-palette.txt', frames: [the picked barks, e.g. 'woof', 'arf', 'yip', 'awoo', 'ruff', 'hmm', 'sniff'] }`. New colours, if any, go on the end of `props-palette.txt` (16 at most).
  - `BARKS: { [mood]: string[] }` and `BARK_FOR: { [key]: string[] }` (a line's own barks, where the pick sets them) in `js/ziggy-says.js`; `pickBark(mood, key, last, rnd = Math.random) -> string | null`: the line's barks if set, else the mood's; never `last` unless it is the only one; `null` for a mood with none.
  - Stage: one `.zs-bark` sprite, `aria-hidden`, placed as picked; shown when a line starts (and on activity beats if picked) for `BARK_MS = 1600`, then hidden. `data-bark` on `#ziggyStage` holds its name or `''`. `land()` hides it. Reduce Motion: shown without its pop, for the same time.
- [ ] **Step 1: Failing tests.** `tests/sprites.test.js` and `scripts/build-sprites.mjs` already loop over every sheet in `SHEETS` (grid, palette, one-colour outline, PNG size); add the barks sheet to the sheet-size test in `tests/ziggy-frames.test.js` and retitle it. `ziggy-says`: "every bark is a real frame, and the picker never repeats" (300 draws per mood and per key, `got.size` equals the set). `ziggy-stage`: "a press shows a new bark; a redraw keeps the one showing".
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Draw** the picked sticker grids (`.claude/mockups/voice/` scripts, the same pixel letters as the options page), `node scripts/build-sprites.mjs`, then implement the picker, the stage sprite and the CSS.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** "Ziggy barks: pixel stickers beside his lines".

### Task 6.5: Bubble looks, check and ship v58

**Files:**
- Modify: `styles.css` (the `.zs[data-mood=...]` rules), `js/version.js`, `index.html` (stamp)

- [ ] **Step 1: The looks.** Port the picked CSS from the options page into `styles.css` per mood. Trims are drawn with `::before` / `::after` on a layer behind the text (as thrilled's burst is), so the focus ring is never clipped. The bubble keeps `min-height: 44px` and its 12 px top room; no look adds height.
- [ ] **Step 2: Fit.** `.claude/mockups/rest/probe.sh` with `HOST=127.0.0.1` and `u=mock.html`: `scrollHeight <= 956` at 440 × 956. In the pane, for each mood, set the worst-case line of each of its rules (`await import('./js/core.js')`, as in memory `headless-edge-for-checks`) and read `.zs-say`'s height: 44 px every time.
- [ ] **Step 3: Contrast and focus.** For each mood read the computed text and background colours and check 4.5:1; tab to the bubble and screenshot the focus ring on each look.
- [ ] **Step 4: Stickers.** Screenshots mid-line for each mood, with the pane shown: the sticker clear of the pointer, the sparks and (asleep, nap) the z's. Reduce Motion with headless Edge `--force-prefers-reduced-motion`: `data-bark` set, no animation running on it.
- [ ] **Step 5: Screen reader text.** The bubble's `textContent` is the line plus " Next line", with no bark words.
- [ ] **Step 6: Ship.** `{ v: '58', date: '<today>', items: ['Ziggy has a bubble of his own for every mood, talks like a puppy, and barks.'] }` at the top of `CHANGES`; `node scripts/stamp-version.mjs 58`; `npm test` (PASS); commit "Ziggy's bubble and voice; v58"; `git push origin run-board`; `git push origin run-board:main`.
