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

Props colours: if a picked prop colour is not in `sprites/src/palette.txt`, props get `sprites/src/props-palette.txt` (at most 16) and the build and sprite tests read it for the props sheet only.
