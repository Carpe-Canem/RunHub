# Ziggy is always busy: design

Date: 2026-11-28. Status: approved by the owner on 2026-11-28.

## Intent

Ziggy, the pixel dog at the foot of the Hub, holds a still pose for 6 to 14 s between short fidgets. The owner's words: "He should always be doing something, always in motion somehow. Walking, running, playing with a ball, playing with a chew toy, playing tug-of-war with a rope, sleeping, etc. Right now he's far too static."

The Hub is opened to check training at a glance. Ziggy is what makes it feel alive and his own. A dog that stands frozen most of the time reads as a picture; a dog that is always up to something reads as a companion.

## Goals

- Between his lines, Ziggy is always doing something: one activity follows the next with no still wait.
- Activities are scenes a few seconds long, not 1 to 2 s twitches: walk somewhere, run, chase a ball, chew a toy, tug a rope, lie down, nap.
- The mood picks the set (see "Activities by mood").
- The 16-bit outlined pixel style stays. The ball, chew toy and rope are drawn as their own small sprites, so fewer dog frames are needed.
- New activities are approved by the owner from mock-ups before they ship. Each visual choice is shown as about six rendered options at 440 × 956, the owner's iPhone 16 Pro Max.
- He keeps doing what he does today: talks while a line types, the bubble pointer follows his head, a press on him or the bubble gives the next line.

## Non-goals

- No pause or stop control. Reduce Motion is the way to still him (see "The 5-second rule is dropped").
- No new moods; the six stay (happy, thrilled, eager, curious, worried, asleep).
- No change to what he says or when (`js/ziggy-says.js`).
- No change to the side dog (`side` sheet, `ziggy()` in `js/ziggy.js`).
- Nothing about him is stored. A reload starts from the first line, in the middle of the strip.

## Anti-goals

- **Twitchy.** Short moves stacked with no gap, so he jitters instead of playing. Each activity should read as one thing he is doing.
- **A loop.** The same few seconds over and over. Activities vary in order and length, never the same one twice running.
- **A taller Hub.** The Hub fits a phone with no scroll (v48). The strip stays 88 px high; props fit inside it.
- **A lost pointer.** The bubble's pointer drifting off his head when he lies down, turns round or runs.
- **A different dog.** New poses that are thicker or more tan than the approved sprite (narrow frame, black and white, tan a small accent; memory `ziggy-markings`).

## Decided by the owner

1. **Activities, chained back to back** (approach A below), chosen 2026-11-28.
2. **The 5-second rule is dropped** (2026-11-28). On 2026-11-27, after the accessibility review, the owner chose to keep every unbroken movement under 5 s so no stop control was needed (WCAG 2.2.2). Always-in-motion breaks that. The owner chose to drop the rule rather than add a pause button: Reduce Motion is the only way to still him. The Hub no longer meets WCAG 2.2.2 for Ziggy, knowingly.
3. **Art:** pose sheets are generated in Leonardo with the owner's credits, then traced into the pixel grids with the local tools in `.claude/mockups` (`trace2.mjs`, `paint.mjs`, `move.mjs`, `view.mjs`). Prompts describe his look only, never his name. Ask before uploading any photo.
4. **Moods:** happy, thrilled, eager and curious get the full play rotation: walk, run, ball, chew toy, rope tug, and a nap or lie-down. Worried gets slower moves: pacing, lying down. Asleep naps, with breathing, rolling over and dreaming paws.

## Approaches considered

- **A. Activities chained back to back** (chosen). Each activity is a scene of 4 to 12 s built from a few steps. When one ends the next begins. Props are separate sprites. It can be built and shown with today's frames, then grow one activity at a time as art is approved. Costs the most engine work.
- **B. Today's fidgets with no gap.** Quickest, but 1 to 2 s moves chained read as twitchy, and there is no room for ball, toy or rope play. Rejected: it works against "always doing something".
- **C. CSS-only loops.** Smooth, but the pointer cannot follow his head per frame, he cannot stop mid-walk to speak, and a hidden tab and Reduce Motion are harder to honour. Rejected.

## How he behaves

### The day of a line

1. A line appears (first load, a press, or new words). Wherever he is and whatever he is doing, he stops: any slide is cancelled where it is going (he lands at its end), props are put away, and he faces the way he was drawn. He talks while the line types, as today.
2. The line is typed. He plays the mood's own movement, as today (`steps(mood, 'mood')`).
3. Then activities begin and chain until the next line: the scheduler picks one, plays it, picks the next, and so on, with no still wait between them.

### Activities

An activity is a short scene of 4 to 12 s, made of steps. A step is one of:

- **pose:** a frame sequence played in place (today's `[[frame, ms], ...]`), optionally repeated n times;
- **travel:** he goes to another spot on the strip, sliding while two or more frames loop; walking and running differ in speed and frames;
- **prop:** a prop sprite appears, moves or goes (a ball rolls to a spot; a toy sits between his paws; a rope comes in from the edge).

The scheduler:

- picks the next activity from the mood's set at random, weighted, never the same one twice running;
- gives calm, long activities (lie down, nap) a lower weight than short, busy ones;
- lets an activity's length vary within its range (a walk goes a random distance; a chew lasts a random number of chews);
- ends every activity on a frame from which the next can start without a jump (normally the mood's still, shown for no more than a beat).

### Activities by mood

| Mood | Set |
|------|-----|
| happy, thrilled, eager, curious | walk, run, ball, chew toy, rope tug, lie down / nap, plus today's fidgets folded in as short beats |
| worried | slow pacing, lying down, sigh, glance up |
| asleep | nap: breathing all the time, with rolling over and dreaming paws now and then |

Asleep is never still either: his breathing runs the whole time, and the twitches, roll-overs and dreaming paws are spaced through it.

### Phase 1 activities (today's frames only)

Phase 1 ships the scheduler with activities built only from frames already in the hub sheet, so the owner sees him in motion before new art exists:

- **stroll:** trot (`eager`, `eager-trot`) to a spot, then a beat there (sniff, look back, wag, scratch, tilt or blink, whatever the mood has).
- **dash:** the same trot frames, swapped faster and slid faster, there and back.
- **potter:** two or three of the mood's fidgets in a row, with a short trot between.
- **worried:** sigh, glance and low poses chained, in place. He does not travel in phase 1 (builder's call): his still lies low with his head on the left, and cutting to the standing eager trot would be a jump. Pacing comes with the head-low walk frames.
- **asleep:** breathing throughout, with the ear and paw twitches. One activity, so "never the same twice running" does not apply to asleep.

A trotting thrilled, curious or happy dog uses the eager trot frames, as the wander does today. That is accepted for phase 1 and replaced when walk frames are drawn.

### What stays

- **Talking:** he talks while a line types; asleep breathes instead.
- **The pointer** follows his head on every frame (see "The pointer").
- **Press:** a press on him or the bubble gives the next line and interrupts any activity.
- **Reduce Motion:** he holds the mood's still and nothing moves. Every line is whole at once.
- **A hidden tab:** nothing runs. Shown again, he picks up with a fresh activity.
- **Off screen** (another view is showing): nothing runs. When the strip is laid out again (`ResizeObserver`), he picks up with a fresh activity.
- **Sparks and z's** keep animating while he moves, in every moving state (see "Engine").

## Art

### Dog frames

- New dog frames go on the `hub` sheet (96 × 88 cells, eight to a row). The `SHEETS.hub.frames` list is append-only: new names go on the end, so no existing frame moves.
- Every hub frame's name starts with one of the six moods (a test). A frame shared by moods (a walk cycle) is named for the mood it was drawn from, e.g. `happy-walk1`, and may be used by other moods' activities, as `eager-trot` is today.
- The sprite tests hold for every new frame: palette letters only, a one-colour outline, standing on the bottom row, tan under 1.5 %.
- Lying and rolling poses still touch the bottom row. Everything fits the 88 px strip.
- Expected new poses (to be confirmed by mock-ups): walk cycle, run cycle, pounce and carry (ball), lie down with paws forward and chew (toy), tug crouch and pull (rope), lie down, roll over, dreaming paws, worried head-low walk.

### Props

- A new `props` sheet in `SHEETS`, with its own cell size (small, e.g. 24 × 24) and PNG `sprites/ziggy-props.png` built by `scripts/build-sprites.mjs`, grids in `sprites/src/props/`.
- Props: ball (a couple of frames for a roll or bounce), chew toy, rope (one end in his mouth; how the other end reads is for the mock-ups). Same outline rule.
- Colours (builder's call): the dog's palette is full (16 colours, capped by a test). The mock-ups may show props in colours he does not have, such as a yellow-green tennis ball or a red toy. If the owner picks one, props get their own palette file (`sprites/src/props-palette.txt`, also at most 16), so the dog's palette and its tests stay as they are.
- A prop is its own element on the strip beside the dog, placed in px like him, so it can roll on its own and leave when an activity ends.

### How art reaches the page

For each group of activities:

1. Leonardo pose sheets from look-only prompts, in the approved style, as reference.
2. Mock-ups of about six options for each visual choice (e.g. how he holds the rope, how the ball bounces), rendered at 440 × 956 on the real Hub, and the owner picks.
3. Trace the chosen poses into grids, hand-patch, check against the sprite tests.
4. Add the frames and activity, then ship.

## Engine

Files: `js/ziggy-moves.js` (pure rules), `js/ziggy-stage.js` (DOM and the one timer), `js/ziggy-frames.js` (sheets, head points).

- **Pure plan, impure player.** `ziggy-moves.js` gains the activity table (per mood, with weights) and a picker. It turns an activity into a concrete list of steps for a given strip width, position and random source, so it can be tested without a DOM. The stage plays the list with its one timer.
- **One timer.** As today: every step is driven by `after()`; a slide's end is decided by the clock, not by `transitionend`.
- **No spin.** Today `due()` waits again when the tab is hidden or the strip is off screen. With no wait that would spin. Instead the scheduler stops (`stop()`), and restarts from `seen()` (tab shown), `fit()` (strip laid out again) or the next `ziggyStage()` call.
- **Interruptions.** `land()` (and so a press, a new line, a reset, Reduce Motion) also clears every prop and cancels its animations.
- **States.** `data-state` gains `play` for an activity. The CSS that animates sparks and z's for `moving` and `fidget` covers `play` too. `still` remains for Reduce Motion and the beat between steps.
- **`FIDGETS`** stays as the fidget set per mood (the beats activities draw from). A new `ACTIVITIES` table sits beside it rather than reshaping it, so the approved-sequence tests keep passing.
- **Check hooks.** `?ziggy=<mood>` stays. `&fidget=<name>` still plays that fidget, now as the only beat. New `&activity=<name>` plays that activity every time.
- **Facing.** Each frame has the way it faces (most face right; the worried and asleep stills have their heads on the left). A travel flips him (`scaleX(-1)`) only when it goes against the way the frame faces; props flip with him where it matters.

### The pointer

- Today the pointer aims at `HEAD[mood]` whatever frame is showing. A new `FRAME_HEAD` in `ziggy-frames.js` gives the head's x for any frame that differs from its mood's still (lying, running, looking back); any other frame falls back to `HEAD[mood]`.
- When the frame is flipped, the point is mirrored: `cell width - 1 - x`.
- The pointer moves when the frame changes, in the same step that sets the frame, and slides with him on a travel.
- `HEAD` keeps its six keys (a test checks them).

## Tests that change on purpose

These encode the owner's earlier choices and change because of decisions 1 and 2:

- `tests/ziggy-moves.test.js`, "the wait is 6 to 14 seconds": `fidgetWait` goes; the test is replaced by "activities chain with no wait".
- "a mood's movement ... with the typing stays under 5" and "every fidget lasts 1 to 2 seconds": the `<= 4700` and `< 5000` bounds go (the 5-second rule is dropped). The mood movement and fidgets keep their lengths; their real-frames and ends-on-the-still checks stay.
- "asleep only twitches, worried only sighs or glances": stays for `FIDGETS`; the new activity sets get their own test.
- `tests/ziggy-stage.test.js`: the phase list in "new words for the same line" gains `play`.
- `tests/ziggy-frames.test.js`, "the hub sheet is 768 × 440 with 33 frames": its counts and size are updated as frames are appended (its title already reads 33 for 39 frames; fix that too). The side sheet line stays.

New tests:

- every activity uses only real frames of its sheet, is 4 to 12 s, and starts and ends on frames that chain;
- the picker never repeats and plays the whole set over many draws;
- a planned travel stays on the strip, and on a strip too narrow to walk on, activities without travel are picked;
- every `FRAME_HEAD` point lies in the cell; mirrored points too;
- the props sheet passes the same grid, palette and outline tests as the others.

## Shipping

Each phase that changes the page ships:

- `node scripts/stamp-version.mjs <n>`, and a plain-words entry at the top of `CHANGES` in `js/version.js` (a test enforces it).
- Commit on `run-board`, push it, then `git push origin run-board:main` as a fast-forward.
- Phase 1 (engine with today's frames) ships as v51.

## Phases

One plan, with a gate for the owner's approval before each art phase ships (builder's call on the grouping and order):

1. **Engine, today's frames** (v51): the scheduler, phase 1 activities, `FRAME_HEAD` and facing, the `play` state, the `?activity=` hook. No new art.
2. **Walk and run**: walk and run cycles drawn first, so the borrowed eager trot can go. No props.
3. **Ball**: the props sheet and prop step are built here, with the ball, pounce and carry poses.
4. **Chew toy and rope tug**: the toy, the rope, and their poses.
5. **Rest**: lie down, nap, roll over, dreaming paws, and the worried head-low walk (pacing).
6. **His bubble and his voice** (added 2026-11-28, after phase 5): see "Phase 6: the bubble and his voice".

Each art phase is its own Leonardo round (owner's credits), mock-up round and version.

## Checks

- `npm test`.
- The preview `dashboard-nostore-8098` with `index.html?demo` on `localhost:8098`, with `?ziggy=<mood>&activity=<name>`.
- Animation is watched with the Browser pane shown (a hidden pane gives no frames; memory `headless-edge-for-checks`).
- Reduce Motion with headless Edge `--force-prefers-reduced-motion`: he is still.
- The Hub still fits 440 × 956 with no scroll.
- The pointer sits over his head through walks, runs and lie-downs.

## Left to the builder

- Weights, exact activity lengths within 4 to 12 s, trot and run speeds.
- The props sheet's cell size.
- How steps are represented in code, as long as the plan stays pure and testable.
- Phase 1's exact activity list from today's frames, within the list above.

## Phase 6: the bubble and his voice

Added 2026-11-28 at the owner's request, to be built after phase 5. Status: approved by the owner on 2026-11-28.

### Intent

The owner, on the speech bubble today: "it feels plain and he sounds like a robot". Both the look and the words are to change. The bubble should catch the eye and be his, and his lines should carry puppy energy, while still giving the training facts at a glance.

### Decided by the owner

1. **Approach 1 (2026-11-28): a mood-shaped bubble, punchy lines of the same length, barks outside the box.** Each mood gets its own bubble look; his lines are rewritten in a puppy voice within a length cap; short sound words ("Woof!", "Yip yip!", "Hmm?") appear as small pixel stickers that sit over space already there (on the bubble's corner or beside him on the strip), so they add no height.
2. **This reverses the non-goal "No change to what he says or when"** for the wording only. When each line is said, and the facts it carries, stay as they are (the rules in `js/ziggy-says.js`).
3. **The Hub must not get taller** (v48: it fits 440 × 956 with no scroll). The owner asked for creative workarounds rather than a taller bubble.

### Approaches considered

- **1. Mood-shaped bubble, punchy lines, barks outside the box** (chosen). Personality in the look and in the words; facts stay instant; no extra height.
- **2. Two-beat bubble**: an excited burst types first, then gives way to the fact in the same space. Rejected: every fact arrives a second or two later, against checking at a glance.
- **3. Taller bubble, Hub reflowed**: two or three rows of free voice, the space won back elsewhere. Rejected: it reworks the approved v48 layout and risks the one-screen fit.

### Goals

- A bubble look per mood, more distinctive than today's panel box (today only thrilled, an amber burst, and asleep, dashed, differ). Directions to mock up: rounded with pixel paw prints at the corners (happy), the burst kept (thrilled), a bouncy double edge (eager), a dotted edge (curious), a wobbly edge (worried), dashed and dim (asleep).
- Every line rewritten in his voice: short sentences, exclamations, dog logic ("Good human!"), the facts and their green highlight kept.
- Bark stickers: small pixel words in his outlined 16-bit style, shown with a line (or a beat of an activity), chosen per mood and line, never the same one twice running.

### Non-goals

- No new moods, no new rules, no change to when a line is said.
- No change to the side dog or to anything outside the Hub's stage.
- Nothing stored.

### Anti-goals

- **A taller Hub.** A line may not wrap to more rows than today's lines do at 440 px; a test holds every rule's line (with long race names and big numbers) to a character cap, measured against the bubble.
- **Facts buried in the fun.** The number or the name comes first or is highlighted; a reader can still get it in a glance.
- **Cringe or repetition.** The same joke on every visit wears thin: each rule has two or three wordings, picked in turn, never the same twice running; barks vary.
- **Lost accessibility.** The bubble text stays the whole message for screen readers (stickers are `aria-hidden`); text contrast at least 4.5:1 on every bubble look; the focus ring stays visible; with Reduce Motion stickers appear without movement.
- **A different dog.** Stickers and bubble trims use his outline colour and the props palette, in his pixel style.

### How art reaches the page

As for the art phases: about six rendered options per visual choice at 440 × 956 on the real Hub (bubble looks per mood, sticker style and placement), and the wordings for every line shown in the same page for the owner to pick from or edit. Then build, test and ship.

### Left to the builder

- The character cap (measured from today's longest line at 440 px), the sticker set and where each sits, the CSS for each bubble look, and how wordings are stored and rotated, as long as `ziggyLines` stays pure and testable.
