# Hub at a glance, and Ziggy speaks: design

Date: 2026-11-27. Status: approved by the owner on 2026-11-27.

This repository is public. Every race name, place and time below is invented demo data.

## Intent

The v42 hub ("the hub speaks in sentences") did not land. The owner's words: "It's overwhelming. Font looks odd." The causes found on review:

- Four sentences in 25 px extra-bold under a 64 px clock, so nothing is secondary.
- Dot-matrix digits set inside sentences at 1.5× the text, off the baseline, with a gap where a thousands comma belongs.
- About 15 dot-matrix numbers on one phone screen: the clock, the scrolling strip, the sentences, the result cards, the record tiles.
- A scrolling strip directly above the clock that repeats it.

The owner wants a hub that can be read at a glance, and wants Ziggy kept and given a bigger part now that the strip goes.

## What the owner chose

From the mock-up rounds on 2026-11-27:

1. **Layout "At a glance"** (option E of six): the countdown, two mileage tiles, and the rest behind three rows.
2. **Ziggy speaks** (option 5 of six): he sits at the foot of the hub with one line, and a tap gives the next.
3. **Animated, with emotions:** his mouth moves while he speaks and he has moods. Six were shown: happy, thrilled, eager, curious, worried, asleep.
4. **One screen:** the owner asked whether it still fits one screen. It should; see "One screen" for what that means on the real page.
5. **Fidgets:** he may go still after speaking but should move again from time to time, with random fidget animations.
6. **A fresh sprite from Leonardo:** still pixelated, with more definition, in his real colours. Chosen as style C of six, then refined from the owner's photos with the tan reduced to a small accent and the frame narrowed, and locked in as the six-mood sheet "B6". See "Ziggy's sprites".
7. **His line sits in a bubble above him** (style 6 of six), with a burst when he is thrilled and a dashed outline when he is asleep. He walks along the strip under it and the bubble's pointer follows him.
8. **The owner's phone is the target:** an iPhone 16 Pro Max. The spare room on it goes to a strip showing each day of this week (idea C of six), labelled only by the week's dates and the run count.
9. **Ziggy stands at the bottom of the screen** on whatever device is in use, with any gap above his bubble.

Everything else in this document is the builder's call and is marked so.

## Goals, non-goals, anti-goals

Goals:

- The hub reads in one look: when the next race is, the week, the year.
- Dot-matrix type appears on the hub in one place only, the countdown. Ziggy is no longer dot-matrix.
- Ziggy carries the hub's one line of prose, and his mood matches what the line says.

Non-goals:

- The Races page, the race page and the Data page keep their layout and type, including dot-matrix times; only the dog on them changes, and the top bar. If the font also looks odd there, that is a separate round.
- No new numbers beyond the week's seven daily sums. Every line Ziggy says comes from data the hub already has.
- No new font files and no new outside service in the running app. Leonardo is used to make art, never called by the app.

Anti-goals:

- Ziggy scolding. A part-week under the usual is normal and is never called "behind".
- Continuous movement. He moves in short bursts with stillness between.
- A line that states something the data does not show.

## Approaches considered

For the hub: six were mocked. A (the sentences, calmed), B (one headline and four numbers), C (dot-matrix rows on a board), D (the pre-v42 cards, tidied), E (at a glance), F (training first, with a ring for the week). The owner chose E. B was the builder's recommendation; E keeps the full ticking clock, which B reduced to a day count.

For Ziggy: six were mocked. Running along the week tile, standing in for the sync light, sitting on the clock, on a road from the last race to the next, speaking one line, living on the tab bar. The owner chose speaking. The builder had recommended the week track with the sync light, and had warned that a spoken line brings back prose; the answer to that warning is that it is one short line at body size, where v42 had four at headline size.

## The hub

Phone, connected, idle:

```
Run Hub                ● Synced 2 min ago ↻   Data
---------------------------------------------------
                    NEXT START
                 08   13   50   10          <- dot-matrix, ticking
                days  hrs  min  sec
                   Orchard 10K
          Sun, Dec 6, 8:00 AM, Orchard, CO

  THIS WEEK                 THIS YEAR
  5.0 mi                    1,098 mi
  of your usual 20.7        23 behind last year
  ▬▬▬───────────            ▬▬▬▬▬▬▬▬▬▬▬▬▬─

  NOV 23 – 29                          2 RUNS
  [ M ][ T ][ W ][ T ][ F ][ S ][ S ]       <- a bar for each day
    –   3.1   –   1.9

  Last 13 weeks                    avg 20.7 mi  ›
  Latest results             21:02, Orchard 5K  ›
  Personal records                 6 distances  ›

  ( Orchard 5K in 21:02. A strong one.         )
                 v                           <- pointer follows him
              [Ziggy]                        <- stands on the tab bar
---------------------------------------------------
        HUB                         RACES
```

- **Next start:** the existing clock, `#nextClock`, `setClock`, `tickHub` and `tickAction`, unchanged in behaviour. Centred on phones. No glow and no ghost digits behind it (builder's call: the ghost layer is part of what smudged the digits; the lamp test still plays). The race name is 18 px/800, the date line 13 px muted. On race day the clock reads "Race day" as now. With no upcoming race: "Nothing on the calendar." and the Add race button, as now, without a second Ziggy beside it.
- **Tiles:** label (10 px tracked capitals, the existing `.label` style), the number in Manrope 22 px/800 with its unit, one muted line, a 5 px meter.
  - This week: `fmt1(mi.week)`, "of your usual `fmt1(mi.weekAvg)`", meter `week / weekAvg` capped at 100%. If over: "`x` over your usual" in green. If `weekAvg` is 0: no second line and no meter.
  - This year: `fmt0(mi.ytd)`, "`n` ahead of last year" (green), "`n` behind last year" (red) or "level with last year"; meter `ytd / lytd` capped at 100%. Without last year's data: no second line and no meter.
  - The meters are decoration and hidden from screen readers; the text says the same thing.
- **The week's days** (owner's choice, 2026-11-27, to use the spare room on a large phone): under the tiles, one panel holding a strip of seven columns, one per day of the week in the order `weekStart` in `runs-model.js` defines. Each column has a bar filled in proportion to that day's distance against the week's biggest day, the day's letter, and the distance to one decimal. A past day with no run shows a dash; a day still to come shows nothing; today's letter is amber. `miles()` gains the seven daily sums; this is the one new number on the hub. The panel's only label is a line of small tracked capitals in the tile-label style (owner's choice of six treatments, because a "This week" heading stood out too much): the week's dates on the left ("Nov 23 – 29", in the device's date format) and the run count on the right ("2 runs", "1 run", nothing for none), from `runsWeek`. The strip is one image to a screen reader, labelled "This week" with the days that have a run.
- **Rows** (builder's calls, not mocked in the open state):
  - Last 13 weeks: folds out in place, the existing bars and note. Stays open across redraws as now.
  - Latest results: a link to `#races`. The strip of route cards leaves the hub; the Races page already lists every result.
  - Personal records: folds out in place into plain rows: distance badge, date, time, each a link to its race. Times are in Manrope, not dot-matrix.
  - The "Data and connection" link at the foot is deleted; `#dataLink` in the top bar already goes there.
  - With no races: the two race rows read "No races yet" on the right and do nothing.
- **Desktop, 860 px and up:** two columns. Left: the clock block, left-aligned at up to 64 px, and Ziggy under it. Right: the tiles, then the rows. Mocked once, and shown to the owner with this document.
- **Still loading:** until the runs are loaded each tile shows its label, a muted dash for the number and no meter. Until the races are loaded the two race rows show nothing on the right.
- **Failed:** a section whose code throws still shows its own note and the rest draws, as now, but the note on the hub is text only. Ziggy no longer naps beside it, so there is never a second dog on the hub.

## The top bar without the strip

Applies to every page (builder's call; mocked once, in the same image).

- The dot-matrix strip, its scrolling and its stop control are removed.
- The status is a plain line, 12 to 13 px, with a 7 px dot: green when synced, amber when paused, red on an error.
- On phones the status line is itself the refresh button: "Synced 2 min ago ↻", at least 44 px tall, with the accessible name "Refresh now". The separate Refresh button is removed at phone width so that title, status and Data fit one row on a phone. On desktop the same control sits at the right of the bar.
- During a sync it reads "Runs: 40 of 120" with no arrow and is disabled; the existing `<progress>` becomes a 3 px bar along the bottom edge of the top bar.
- An error or the rate-limit pause shows "Retry" or "Paused" in the row, and the full sentence on a second row under it, wrapped, in red or amber.
- Demo reads "Demo", plain, with no arrow and nothing to press. Before the first sync it reads "Not synced yet ↻".
- A warning (`warn` in `statusOf`, today appended to the idle text) goes on the second row in amber, like the pause, so the button's text stays short.
- `#statusText`, the polite live region written once per state, is unchanged. `statusOf` stays.
- Ziggy leaves the top bar.

## Ziggy speaks

- **Where** (owner's choices, 2026-11-27): at the bottom of the screen on whatever device is in use. The hub is a column at least as tall as the visible page between the top bar and the tab bar (`100dvh` less the two bars and the safe areas), and Ziggy's block takes the spare room above it, so he stands on the tab bar's edge and any gap sits above his bubble. When the hub is taller than the screen (a small phone, Safari, a fold-out open) nothing is pinned: he simply follows the rows, and the page scrolls. The credits footer stays below, reached by scrolling. On desktop he stays under the clock.
- **What:** his bubble spans the hub's width, with the three-quarter sprite, about 80 px tall, standing under it. A small pointer on the bubble's lower edge sits over his head. The line is 14 px, at most two lines at 440 px wide.
- **Bubble effects** (owner's choice): thrilled turns the bubble into an amber burst with dark text and three sparks around him; asleep makes it a dashed outline with muted text, a trail of two dots in place of the pointer, and drifting z's. The other moods use the plain bubble. The shape is a second signal of mood beside the pose, and it holds with reduced motion.
- **He walks** (owner's choice): the strip under the bubble is his to move along. "Wander" joins the fidgets: he trots to another spot on the strip in under 2 s (the side trot sprite, mirrored when he heads left) and sits again. The pointer slides with him, driven by the same position. He never wanders while a line is typing, and with reduced motion he stays where he is.
- **A control:** the bubble and the dog are each pressable and do the same thing: show the next line. The accessible name is the line plus "Next line" when there is more than one. With a single line they are not buttons. The bubble holds no link of its own: the rows above already lead to the races.
- **Speaking:** when a line appears, it types out over about 1.5 s while his mouth opens and closes. The bubble is laid out at its final size from the start, so nothing shifts. The full text is in the page from the first frame for screen readers, and it is not a live region.
- **After speaking:** the mood's own movement plays for about 4 s, then he holds the mood's still pose. Pressing him plays the next line.
- **Fidgets** (owner's request, 2026-11-27): while still, he moves again every so often. After a random wait of 6 to 14 s he plays one fidget picked at random from the mood's set, never the same one twice running, each 1 to 2 s long, then goes still again. The set to draw: ear flick, tail thump, head tilt, blink, sniff the ground, scratch behind the ear, yawn, look back over his shoulder, shake off. Moods limit the set: asleep only twitches an ear or a paw; worried only sighs or glances up; thrilled and happy may use any. Fidgets pause while the tab is hidden and while he is speaking, and never play with reduced motion. No single movement lasts 5 s, so nothing needs a stop control.
- **Reduced motion:** the line appears at once and he holds the still pose.
- **Redraws:** `renderHub` rebuilds the hub on every `data` event, often several times during a sync. The line being shown, how far it has typed, and whether he has settled must survive a redraw, the way focus and the open weeks panel do. If the line now showing no longer exists, he starts again from the first line. If it still exists he keeps it, even when a more important line has arrived; the new order applies from the next press or reload, so he never interrupts himself mid-sync.
- **No stored state.** Which line he is on is forgotten on reload; he starts from the most important line. The mock-up's "Nothing new since Friday" is dropped because it needs a stored marker of the last visit (builder's call).

### What he says

A pure module, `js/ziggy-says.js`, with no DOM: `ziggyLines({ mi, stats, up, sync, now })` returns the lines in order, each `{ key, mood, parts }`, where `parts` are the same `{text}` and `{text, tone}` shapes `hub-lines.js` uses today (no `{led}` parts: no dot-matrix in his line). The first line is shown first.

| # | When | Mood | Line (demo data) |
|---|---|---|---|
| 1 | A sync is running and the runs are not loaded yet | eager | "Fetching your runs from Strava." |
| 2 | The next race is today | thrilled | "Race day. Orchard 10K at 8:00 AM." |
| 3 | The latest race is a record (`r.record`) and was within 14 days | thrilled | "20:36! A new 5K record." |
| 4 | The next race is 1 to 7 days away | eager | "Orchard 10K is on Sunday." |
| 5 | The week is over the usual (`weekAvg > 0`) | happy | "22.4 miles this week, 1.7 over your usual." |
| 6 | The latest race was within 30 days and rule 3 did not fire | happy | "Orchard 5K in 21:02." |
| 7 | The year is ahead of last year | happy | "1,098 miles this year, 23 ahead of last year." |
| 8 | It is one of the last two days of the week and the week is under 60% of the usual | worried | "5 miles so far this week. Your usual is 20.7." |
| 9 | The year is behind last year | worried | "23 miles behind this date last year." |
| 10 | No run today, the week is under the usual, and rule 8 did not fire | eager | "No run yet today. Shall we?" |
| 11 | A second upcoming race exists | curious | "After that: Harbor Half, Jan 17." |
| 12 | At least one race | curious | "20 races finished, 2 on an age-group podium." |
| 13 | None of the above | asleep | "All quiet." (muted) |

- Rule 8 states two facts and never the word "behind". Rule 9 is the only "behind", and it is about the year, as the tile already says.
- Rule 2 without a start time is "Race day. Orchard 10K."
- Units follow `mi.unit`: "miles" or "km". Race names that end in their own full stop get no second one, as in `hub-lines.js`.
- When the race history is still loading, race rules are skipped; they do not say "No races".
- If the mileage or the races failed to load, their rules are skipped. If both failed he is asleep with "All quiet."
- "Your fastest 5K this year", shown in a mock-up, is not a rule: nothing in the model computes it, and it was false for the demo data.

### Ziggy's sprites

Decided by the owner over five rounds on 2026-11-27: Ziggy is redrawn as a full-colour, outlined, 16-bit style pixel character ("he should still be pixelated but can have more definition"), generated in Leonardo from the owner's photos and locked in. The amber dot-matrix dog is retired.

- **The base art** is the six-mood sheet the owner chose ("B6"), kept locally in `.claude/mockups/` (not committed) as `ziggy-b6-moods.jpg`: happy, thrilled, eager (trotting), curious, worried and asleep, all the same dog in three-quarter view. `ziggy-b2.jpg` (side profile, sitting) and `ziggy-b4.jpg` (side profile, trotting) are the same dog side-on, for the race page's finish line and the notes. It took five rounds: an earlier pick was dropped because he was too thick-set.
- **His markings** (from the photos; the owner's corrections in bold): **a narrow frame, with a slender chest and long thin legs, never thick-set**; glossy black; a **thin** white blaze down the forehead widening into a white muzzle around a black nose; white chin, throat and chest bib; white socks; white tail tip; floppy folded ears; amber-brown eyes; bright blue collar. **Tan is a small accent only**: two tiny eyebrow dots and a thin edge where black meets white on the legs (a little less on the legs than B6 shows). He must not read as a round puppy or get a broad white face.
- **A true grid.** Leonardo's output is a picture of pixel art, not pixels. Every shipped frame is redrawn on a real grid with a fixed palette of at most 16 colours, a one-pixel blue-grey outline so the black coat reads on `--night`, and a transparent background (the base art has navy baked in; the finish line sits on `--board`). Frames ship as PNG sprite sheets in the repo (the CSP already allows `img-src 'self'`), drawn only at whole-number scales with `image-rendering: pixelated`, and loaded with the same `?v=` stamp as the scripts so a new sheet is never served stale.
- **Grid size, tested 2026-11-27** by shrinking the locked happy pose to real pixels (`ziggy-on-hub.png`): at 40 px tall the thin blaze, the eyebrow dots and the tan edge smear away; at 80 px tall they survive. So the three-quarter view is drawn about 80 px tall and shown at 1× on the hub (80 CSS px). Builder's call, and a trade the owner should know: at 1× the pixels are fine, so he looks detailed more than chunky. The side views (finish line, notes) carry less face and are drawn about 40 px tall, shown at 1×; `.finish` and its offsets, sized for the old 48 × 28 dog, are refitted to that.
- **Frames to draw.** Three-quarter view: for each of the six moods a still pose, one or two idle frames and a mouth-open talking frame; plus the fidgets. Side view: sit, trot (two leg frames), nap.
- **How frames are made, and the fallback.** This is unproven: the six moods now come from one consistent sheet, but the extra frames (talking, idle, fidgets) need edits of single poses ("the same sprite, mouth open", with the pose as reference image), and that has not been tried. So before the full sheet there is a three-frame proof: the still, one talking frame and one fidget, on the grid, side by side. If Leonardo's edits drift, small changes (mouth, ears, tail, blink) are made by moving pixels on the base grid by hand, and only poses that need a new body (worried, asleep, the hop) are generated and then corrected. If those still do not look like him, those moods use head-and-tail changes on the sitting body.
- **Each mood must be recognisable from its still pose alone, at hub size.** That is what reduced motion shows and what he settles into.
- **Movements,** as the starting point: happy wags; thrilled hops with ears up, a fast wag and three sparks; eager trots on the spot and pants; curious tilts his head with ears pricked; worried hangs his head with his tail tucked; asleep is curled up with drifting z's.
- **Fidgets:** all nine in the list above are the target. At least six must be in the first release; the rest may follow.
- **Owner reviews twice before wiring:** the three-frame proof, then the finished sheets on their own page at hub size and enlarged.
- **Everywhere he appears.** The new dog replaces the old one on the race page's finish line (side trot, then side sit, with the record hops) and beside empty and unavailable notes on the Races page (side sit, nap). `ziggy(pose, scale)` keeps its job; the cell-drawing code, the four colour classes (`zg-o`, `zg-e`, `zg-w`, `zg-c`) and the `--collar` token's "only blue on the board" rule go. `.zg-note` and the `zg-hop` record hops stay. The app icon is not changed.
- **Leonardo.** The owner approved uploading the four photos as reference images on 2026-11-27. Reference images go through a local script, `leo_run.py`; confirm with the owner before using it for the later frames. Prompts describe the dog's look only: no name and nothing about the project. Photos and Leonardo's raw output are never committed; the redrawn sprite sheet is.

## One screen

The owner's phone is an iPhone 16 Pro Max (440 × 956 CSS px), and the app is mostly used from its home-screen icon. That is the size every phone mock-up and fit check uses (owner's instruction, 2026-11-27). The earlier 390 × 664 figures are superseded.

On the real page the top bar is 60 px plus the top safe area (62 px), the tab bar 56 px plus the bottom safe area (34 px), and a credits footer follows the hub, so the document always scrolls a little. "Fits one screen" therefore means:

- Connected, idle, an upcoming race set, all rows folded.
- As a home-screen app at 440 × 956: everything from the top bar to the end of Ziggy's line is visible above the tab bar with no scrolling. The footer is below and reached by scrolling.
- In Safari on the same phone (about 763 px visible; an estimate, not measured) a short scroll to reach Ziggy is accepted.

Measured on mock-ups with those bar heights (`hub-spare-room.png`, `hub-c-pinned.png`), with the day strip and the bubble above him: about 59 px to spare as a home-screen app, which is the room he walks in and the gap that pinning moves above his bubble. In Safari it runs about 38 px past the fold, so there he is a short scroll down and not pinned. The demo banner or an error row takes more. Smaller phones scroll; that is accepted. This is a build check, not a promise.

## What is removed

- `js/hub-lines.js` and `tests/hub-lines.test.js`: `startText` and `NOTHING_ON` are still needed and move with their tests; `mileLines`, `raceLines`, `hubLines` and `nextParts` go.
- From `js/ticker.js`: `tickerText`, `tickerPose`, `stripMode`, `SEP`. `statusOf` stays (move or rename the file as the builder sees fit). Matching tests in `tests/ticker.test.js`.
- From `js/main.js`: `drawTicker`, `fitTicker`, `layTicker`, the `strip` state.
- From `index.html`: the `.ticker` button and its children. From `styles.css`: the `.ticker`, `.tk-*`, `.say*`, `.next-name`, `.strip*`, `.rec-grid`, `.rec-tile` rules and whatever else is left without a user.
- `README.md`: the status-strip paragraph and the description of the hub.
- A dated note at the top of Phase 6 in `docs/superpowers/plans/2026-11-27-run-hub-legends-removal-and-look.md` that the sentences and the strip were replaced by this design.
- From `js/ziggy.js` and `styles.css`: the dot-matrix frames, `cellPaths` and the four `zg-` colour rules, replaced by the sprite sheets. `tests/ziggy.test.js` is rewritten for the new frame map.
- Version stamp v43.

## Mock-ups

The rendered mock-ups are kept locally in `.claude/mockups/` (not committed): `hub-options.png`, `ziggy-options.png`, `ziggy-moods.html`, `hub-desktop-and-topbar.png`, `ziggy-leonardo.png`, `ziggy-c-variants.png`, `ziggy-from-photos.png`, `ziggy-on-hub.png` `ziggy-blend.png`, `ziggy-speech.png`, `hub-spare-room.png`, `hub-c-pinned.png`, `week-label.png`, and the base art `ziggy-b6-moods.jpg`, `ziggy-b2.jpg` and `ziggy-b4.jpg`. `leo_run.py` there is the script that sent photos to Leonardo. The text sketch above is the durable record.

## Constraints

- No build step, no dependencies, ES modules, CSP unchanged (`font-src 'self'`; no inline script beyond the hashed import map).
- Touch targets at least 44 px. Text contrast at least 4.5:1 on `--night` and `--panel`.
- Pure logic goes in modules with `node --test` tests: the line rules (every row of the table, the skips, km, a name ending in a full stop), the tile texts, the seven daily sums, the fidget picker (never the same twice running, the mood's set only), and the sprite frame map (every named frame lies inside the sheet, and the sheet's size is a whole number of frames).
- Fonts: Manrope and Doto, already in `fonts/`.

## Left to the builder

- File and function names beyond those given.
- The exact pixel drawings, within the markings, the still-pose rule and the owner's approval of the sheet.
- Whether animation is CSS frame-swapping (as the trot is today) or script; either must stop by itself and respect reduced motion.
- The fold-out styling for records.

## Checks before it is called done

0. The three-frame proof, then the sprite sheets, each approved by the owner before anything is wired in.
1. `node --test` passes.
2. Connected through the local `mock.html` path (not `?demo`, whose banner takes a row) at 440 × 956 with the safe areas: the one-screen criterion holds and Ziggy stands on the tab bar's edge; screenshot. At 440 × 763 and at 390 × 664 he follows the rows and nothing overlaps; screenshots.
3. `?demo` at 1200 px wide: two columns; screenshot.
4. Top bar on a phone in each state: synced, syncing, error, paused; nothing overflows the row.
5. Each mood forced in turn (a test hook or edited demo data): still pose readable at hub size, movement stops within about 6 s, and over a minute at least two different fidgets play with stillness between them.
6. Reduced motion (headless Edge): no typing, no movement, lines complete.
7. Start a mock sync with a line half typed: the line does not restart on each redraw.
8. Wander: he trots to a new spot, the pointer stays over him the whole way, and with reduced motion he does not move.
9. Keyboard: Ziggy's button is reachable, shows focus, and Enter gives the next line; focus stays on it.
