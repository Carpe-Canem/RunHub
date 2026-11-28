// What Ziggy does with a stretch of time: pick an activity, then plan it as steps the stage can play.
// Pure: no DOM, no timers. Frame names are those of the hub sheet in ziggy-frames.js.

import { FIDGETS, MIN_ROOM, MS_PER_PX, steps, wanderTo } from './ziggy-moves.js';
import { SHEETS, FRAME_MOUTH, FRAME_BALL, FRAME_TOY, FRAME_KNOT, BALL_CENTRE, PROP_MID } from './ziggy-frames.js';

export const ACT_MIN = 4000;     // an activity lasts at least this long, in ms,
export const ACT_MAX = 12000;    // and at most this

// Phase 1: the activity names for each mood and how often each is picked.
// Phase 3 (v54) adds the ball; phase 4 (v55) the chew toy and the rope.
export const ACTIVITIES = {
  happy:    { stroll: 3, dash: 2, potter: 2, ball: 3, chew: 2, tug: 2 },
  thrilled: { stroll: 3, dash: 2, potter: 2, ball: 3, chew: 2, tug: 2 },
  eager:    { stroll: 3, dash: 2, potter: 2, ball: 3, chew: 2, tug: 2 },
  curious:  { stroll: 3, dash: 2, potter: 2, ball: 3, chew: 2, tug: 2 },
  worried:  { mope: 1, fret: 1 },
  asleep:   { doze: 1 },
};

// What a worried dog does, beat by beat, and how often. 'low' and 'still' are holds of the plan's own (not fidgets):
// his head down, or just standing there worried.
const MOPE = { sigh: 3, low: 2, glance: 1 };
const FRET = { glance: 3, still: 2, sigh: 1 };

// Step = { pose: [[frame, ms], ...], flip? } | { travel: { to, ms, frames, frameMs, arc?, keep? } }, either with a prop?.
// flip: the pose is drawn mirrored (he faces left) from here on. arc: a trip in the air, this many px up at its middle.
// keep: he goes without turning round (backing up, or dragged, in a tug).
// prop: what the plaything does from the start of the step (see propPath): { held: true } in his mouth,
// { roll: { from, to, ms } } along the ground, { fly: { from: [x, h], to, ms, apex, hops, roll?, up? } } through
// the air, { slide: { from: [x, h], to: [x, h], ms } } straight there, or { lie: { x, h } } lying still. x is the
// prop's anchor on the strip (anchorOf in ziggy-frames.js), h its height above the ground, in px.
// Which plaything: the ball by default; frame: 'toy-flat' or 'toy-up' for the chew toy; rope: 'long' (from his mouth
// to past the end he faces, which way given by faces: 1 right, -1 left) or 'short' (a knot at each end).
// spin: the short rope turns as it flies. swing: a held short rope's angles, [[deg, ms], ...], played once.

const LEAD_MS = 400;      // a plan that opens with a trip first holds his still this long, so it opens on a pose
const PACE = {
  walk: { msPerPx: MS_PER_PX, max: 2600, frameMs: 150 },
  run:  { msPerPx: 2.4, max: 1200, frameMs: 90 },
};

// The frames of a trip, by mood and pace. Drawn from the happy dog (v53) and used by every mood that travels; worried
// and asleep never do. Eager keeps its own trot for its mood movement.
const WALK = ['happy-walk1', 'happy-walk2', 'happy-walk3', 'happy-walk4'];
const RUN = ['happy-run1', 'happy-run2', 'happy-run3'];
export const GAITS = Object.fromEntries(['happy', 'thrilled', 'eager', 'curious'].map((m) => [m, { walk: WALK, run: RUN }]));

export const travelMs = (dx, pace) => Math.min(PACE[pace].max, Math.round(Math.abs(dx) * PACE[pace].msPerPx));

// The entry [name, weight] drawn by weight from one number in 0..1.
function draw(entries, rnd) {
  let at = rnd() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [name, w] of entries) { at -= w; if (at < 0) return name; }
  return entries.at(-1)[0];
}

// Weighted by the mood's table; never the one just played unless it is the only one.
export function pickActivity(mood, last, rnd = Math.random) {
  const all = Object.entries(ACTIVITIES[mood]);
  const left = all.filter(([name]) => name !== last);
  return draw(left.length ? left : all, rnd);
}

const poseMs = (pose) => pose.reduce((n, [, ms]) => n + ms, 0);
const stepMs = (step) => (step.pose ? poseMs(step.pose) : step.travel.ms);

export const planMs = (list) => list.reduce((sum, step) => sum + stepMs(step), 0);

// beat: a fidget name every beat must use. One the mood lacks, or a wander, is ignored. flip: he faces left now.
// routine: for the ball, one of BALL_ROUTINES to play (the checks' hook); otherwise one is drawn.
export function planActivity(mood, name, { x, room, rnd = Math.random, beat = null, flip = false, routine = null }) {
  if (!Object.hasOwn(ACTIVITIES[mood] ?? {}, name)) throw new Error(`${mood} has no activity called "${name}"`);
  if (name === 'ball') return planBall(mood, { x, room, rnd, flip, routine });
  if (name === 'chew') return planChew(mood, { x, room, rnd, flip, routine });
  if (name === 'tug') return planTug(mood, { x, room, rnd, flip, routine });
  const beats = FIDGETS[mood].filter((f) => f !== 'wander');
  const hooked = !!beat && beats.includes(beat);
  const own = hooked ? [beat] : beats;
  const shortest = own.reduce((a, b) => (poseMs(steps(mood, b)) < poseMs(steps(mood, a)) ? b : a));
  const count = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  const plan = [];
  const start = Math.min(Math.max(0, x), Math.max(0, room));
  let at = start;
  let total = 0;
  let prev = null;    // the beat just played: another is drawn where there is one
  const add = (step) => { plan.push(step); total += stepMs(step); };
  const canMove = room >= MIN_ROOM;

  // A beat other than the one just played; the whole list when it has only the one.
  const pick = (list) => {
    const rest = list.filter((b) => b !== prev);
    const from = rest.length ? rest : list;
    return from[Math.floor(rnd() * from.length)];
  };
  const posture = (b) => {
    if (b === 'low') return [['worried-low', 700 + 100 * Math.floor(rnd() * 8)], ['worried', 300]];
    if (b === 'still') return [[mood, 600 + 100 * Math.floor(rnd() * 7)]];
    return steps(mood, b);
  };
  // A beat that does not fit what is left of ACT_MAX gives way to the shortest one; none fitting, nothing is played.
  const play = (b) => {
    let pose = posture(b);
    if (total + poseMs(pose) > ACT_MAX) { b = shortest; pose = posture(b); }
    if (total + poseMs(pose) > ACT_MAX) return false;
    add({ pose });
    prev = b;
    return true;
  };
  // A walk or a gallop to `to` (a place of the strip), or to a new one. Never one that leaves no room under ACT_MAX for the beat
  // that must follow it: a plan ends on a pose.
  const travel = (pace, to = wanderTo(at, room, rnd)) => {
    if (!canMove) return;
    const ms = travelMs(to - at, pace);
    if (ms <= 0) return;
    const lead = plan.length ? 0 : LEAD_MS;
    if (total + lead + ms + poseMs(steps(mood, shortest)) > ACT_MAX) return;
    if (lead) add({ pose: [[mood, lead]] });
    add({ travel: { to, ms, frames: [...GAITS[mood][pace]], frameMs: PACE[pace].frameMs } });
    at = to;
  };
  const breathe = (pairs) => add({ pose: Array.from({ length: pairs }, () => [['asleep-breathe', 1000], ['asleep', 1000]]).flat() });
  // Worried: a run of beats drawn by weight, never the same twice running. With a beat hook, the hook's, as before.
  const fidget = (table, hookBeats, lo, hi) => {
    if (hooked) { for (let n = hookBeats; n > 0; n--) play(beat); return; }
    for (let n = count(lo, hi); n > 0; n--) {
      const rest = Object.entries(table).filter(([b]) => b !== prev);
      play(draw(rest, rnd));
    }
  };

  switch (name) {
    case 'stroll':
      travel('walk');
      for (let n = count(1, 2); n > 0; n--) play(pick(own));
      break;
    case 'dash':
      // There and back: a gallop to a spot and then to where he started.
      travel('run');
      play(own.includes('tail') && own.length > 1 ? 'tail' : pick(own));
      if (Math.abs(start - at) >= 48) travel('run', start);
      play(pick(own));
      break;
    case 'potter':
      for (let n = count(2, 3), i = 0; i < n; i++) {
        if (i) travel('walk');
        play(pick(own));
      }
      break;
    case 'mope':
      fidget(MOPE, 3, 3, 4);
      break;
    case 'fret':
      fidget(FRET, 4, 3, 5);
      break;
    case 'doze':
      breathe(count(1, 2));
      play(pick(own));
      breathe(count(1, 2));
      play(pick(own));
      break;
  }

  // Short of the minimum (a narrow strip drops the travels): more beats.
  while (total < ACT_MIN && play(pick(own)));
  return plan;
}

// ---- The ball (v54): three routines, one drawn each time he plays. In every one the ball rolls in from the end of
// the strip he faces, he noses it and picks it up, plays, then drops it and noses it off the strip again, and ends
// on his still. pounce: a toss, a play bow, a pounce and a pin. fetch: a long toss with bounces, a gallop out and
// home with it. catch: he flicks it up, watches it bounce, hops on it (in place where there is no room to move).
export const BALL_ROUTINES = ['pounce', 'fetch', 'catch'];
export const POUNCE_ARC = 16;    // px he is off the ground at the middle of the long pounce
const HOP_ARC = 10;              // and of the hop in 'catch'
const CELL = SHEETS.hub.cell[0];
const CELL_H = SHEETS.hub.cell[1];
const BALL_OFF = 12;             // a ball centred this far past the end of the strip is out of sight
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// The ball's bottom above the ground when its centre is at row y of his cell.
const heldH = (y) => CELL_H - 1 - y - (SHEETS.props.cell[1] - 1 - BALL_CENTRE[1]);

function planBall(mood, { x, room, rnd, flip, routine }) {
  const W = room + CELL;
  const canMove = room >= MIN_ROOM;
  let at = clamp(Math.round(x), 0, Math.max(0, room));
  // He plays toward the side with more room; on a strip too narrow to move on, the way he faces already.
  let left = canMove ? at > room / 2 : flip;
  const mir = (cx) => (left ? CELL - 1 - cx : cx);
  const ballAt = (dogX, frame) => Math.round(dogX + mir(FRAME_BALL[frame]));
  const mouth = () => { const [mx, my] = FRAME_MOUTH['happy-carry']; return [Math.round(at + mir(mx)), heldH(my)]; };
  const ahead = (px) => clamp(at + (left ? -px : px), 0, room);
  const leap = (to, arc) => ({ travel: { to, ms: Math.max(380, Math.round(Math.abs(to - at) * 2.4)), frames: ['happy-pounce'], frameMs: 40, arc } });
  const gallop = (to) => ({ travel: { to, ms: travelMs(to - at, 'run'), frames: [...RUN], frameMs: PACE.run.frameMs } });
  // Watching the ball: his own still, with a blink in it.
  const watch = (ms) => { const a = Math.round(ms * 0.45); return [[mood, a], [`${mood}-blink`, 150], [mood, ms - a - 150]]; };
  const plan = [];

  // In: it rolls to his nose from the end he faces, he noses it and picks it up.
  const nose = ballAt(at, 'happy-nudge1');
  const from = left ? -BALL_OFF : W + BALL_OFF;
  const inMs = clamp(Math.round(Math.abs(nose - from) * 2.6), 500, 1400);
  plan.push({ pose: [[mood, inMs]], flip: left, prop: { roll: { from, to: nose, ms: inMs } } });
  plan.push({ pose: [['happy-nudge1', 300]] });
  plan.push({ pose: [['happy-carry', 400]], prop: { held: true } });

  let which = BALL_ROUTINES.includes(routine) ? routine : BALL_ROUTINES[Math.min(2, Math.floor(rnd() * 3))];
  const pounceTo = ahead(80 + Math.round(rnd() * 100));
  const fetchTo = ahead(140 + Math.round(rnd() * 120));
  if (which === 'pounce' && (!canMove || Math.abs(pounceTo - at) < 48)) which = 'catch';
  if (which === 'fetch' && (!canMove || Math.abs(fetchTo - at) < 60)) which = 'catch';

  if (which === 'pounce') {
    const to = ballAt(pounceTo, 'happy-pin');
    plan.push({ pose: [['happy-carry', 120], [mood, 600]], prop: { fly: { from: mouth(), to, ms: 720, apex: 40, hops: [9, 3] } } });
    plan.push({ pose: [['happy-bow', 900]] });
    plan.push(leap(pounceTo, POUNCE_ARC));
    at = pounceTo;
    plan.push({ pose: [['happy-pin', 650]] });
    plan.push({ pose: [['happy-carry', 380]], prop: { held: true } });
  } else if (which === 'fetch') {
    const home = at;
    const to = ballAt(fetchTo, 'happy-nudge1');
    plan.push({ pose: [['happy-carry', 100], ...watch(1600)], prop: { fly: { from: mouth(), to, ms: 1700, apex: 48, hops: [24, 11, 4], roll: true } } });
    plan.push(gallop(fetchTo));
    at = fetchTo;
    plan.push({ pose: [['happy-nudge1', 320]] });
    plan.push({ pose: [['happy-carry', 400]], prop: { held: true } });
    left = !left;
    plan.push({ pose: [['happy-carry', 260]], flip: left });
    plan.push(gallop(home));
    at = home;
  } else {
    const hopTo = canMove ? ahead(118 - FRAME_BALL['happy-pin']) : at;
    const hop = Math.abs(hopTo - at) >= 24;
    const to = hop ? ballAt(hopTo, 'happy-pin') : ballAt(at, 'happy-nudge1');
    plan.push({ pose: [['happy-nudge2', 160], ...watch(1540)], prop: { fly: { from: mouth(), to, ms: 1700, apex: 60, hops: [30, 16, 7, 2], up: true } } });
    if (hop) {
      plan.push({ pose: [['happy-bow', 260]] });
      plan.push(leap(hopTo, HOP_ARC));
      at = hopTo;
      plan.push({ pose: [['happy-pin', 600]] });
    } else plan.push({ pose: [['happy-nudge1', 320]] });
    plan.push({ pose: [['happy-carry', 400]], prop: { held: true } });
  }

  // Out: he drops it at his nose and noses it off the end he faces, then stands and watches it go.
  const drop = ballAt(at, 'happy-nudge1');
  plan.push({ pose: [['happy-carry', 120], ['happy-nudge1', 260]], prop: { fly: { from: mouth(), to: drop, ms: 380, apex: 0, hops: [5, 2] } } });
  const off = left ? -BALL_OFF : W + BALL_OFF;
  const outMs = clamp(Math.round(Math.abs(off - drop) * 2.2), 400, 1400);
  plan.push({ pose: [['happy-nudge2', 220], [mood, outMs]], prop: { roll: { from: drop, to: off, ms: outMs + 200 } } });
  return plan;
}

// ---- The chew toy and the rope (v55, the owner's picks of 2026-11-28). As with the ball, one routine is drawn each
// time, the plaything comes in from off the strip and leaves it again, and he ends on his still.
// chew: gnaw (it skids in, he walks to it, lies down and chews, then noses it off), spring (it is lobbed in over him,
// he pounces on it and chews, then flings it off), bring (he fetches it, carries it back, lies down and chews, then
// carries it to the end of the strip and drops it over). tug: tugger (a rope slides in, he grabs it and someone off
// the strip pulls the other end, then yanks it away), fling (a short rope lands, he pounces, shakes it, flings it off).
export const CHEW_ROUTINES = ['gnaw', 'spring', 'bring'];
// The held tug rope runs at a slant to a far end that stays put: this far past the end of the strip he faces, and
// this high off the ground (v56, the owner's pick over a level rope).
export const ROPE_FAR = 60;
export const ROPE_FAR_H = 20;
// The rope from a to b in whole-pixel steps: [x, y] of its middle row for every column, y on the straight line
// between them rounded, so the picture is never turned or scaled.
export function ropeSteps([x0, y0], [x1, y1]) {
  const n = Math.abs(Math.round(x1) - Math.round(x0)), d = x1 < x0 ? -1 : 1;
  return Array.from({ length: n + 1 }, (_, i) => [Math.round(x0) + d * i, Math.round(y0 + ((y1 - y0) * i) / (n || 1))]);
}
export const TUG_ROUTINES = ['tugger', 'fling'];
const TOY_REST = 105;    // the toy lies this far into his cell (past his paws) before he noses it between them
const NOSE = FRAME_BALL['happy-nudge1'];
const KNOT_H = 5;        // a rope lying on the ground: its knots' centres are this high
const toyH = (frame) => CELL_H - 1 - FRAME_MOUTH[frame][1] - (15 - PROP_MID['toy-flat'][1]);

// Everything the toy and rope routines share: where he is, which way he faces, and the steps he can take.
function playground(mood, { x, room, rnd, flip }) {
  const g = { mood, room, rnd, W: room + CELL, canMove: room >= MIN_ROOM, plan: [] };
  g.at = clamp(Math.round(x), 0, Math.max(0, room));
  g.left = g.canMove ? g.at > room / 2 : flip;
  g.mir = (cx) => (g.left ? CELL - 1 - cx : cx);
  g.dir = () => (g.left ? -1 : 1);
  g.ahead = (px) => clamp(g.at + g.dir() * px, 0, room);
  g.off = () => (g.left ? -BALL_OFF * 2 : g.W + BALL_OFF * 2);       // past the end he faces
  g.behind = () => (g.left ? g.W + BALL_OFF * 2 : -BALL_OFF * 2);    // past the end behind him
  g.watch = (ms) => { const a = Math.round(ms * 0.45); return [[mood, a], [`${mood}-blink`, 150], [mood, ms - a - 150]]; };
  g.pose = (pose, more = {}) => { g.plan.push({ pose, ...more }); };
  g.walk = (to) => { if (to !== g.at) g.plan.push({ travel: { to, ms: travelMs(to - g.at, 'walk'), frames: [...WALK], frameMs: PACE.walk.frameMs } }); g.at = to; };
  g.leap = (to, arc) => { g.plan.push({ travel: { to, ms: Math.max(380, Math.round(Math.abs(to - g.at) * 2.4)), frames: ['happy-pounce'], frameMs: 40, arc } }); g.at = to; };
  g.turn = (ms) => { g.left = !g.left; g.pose([['happy-carry', ms]], { flip: g.left }); };
  return g;
}

// A run of chews: the head down to the toy and up, a pause now and then, ending head up. pairs: how many.
function chews(rnd, pairs) {
  const out = [];
  const stop = 1 + Math.floor(rnd() * Math.max(1, pairs - 1));
  for (let i = 0; i < pairs; i++) {
    out.push(['happy-chew1', i === stop ? 650 + 50 * Math.floor(rnd() * 5) : 220 + 20 * Math.floor(rnd() * 3)], ['happy-chew2', 200 + 20 * Math.floor(rnd() * 3)]);
  }
  out.push(['happy-chew1', 260]);
  return out;
}
// Fewer chews until the plan fits ACT_MAX (never under two pairs).
function trim(plan, step) {
  while (planMs(plan) > ACT_MAX && step.pose.length > 5) step.pose.splice(-3, 2);
}

function planChew(mood, opts) {
  const g = playground(mood, opts);
  const { rnd } = g;
  let which = CHEW_ROUTINES.includes(opts.routine) ? opts.routine : CHEW_ROUTINES[Math.min(2, Math.floor(rnd() * 3))];
  const springTo = g.ahead(80 + Math.round(rnd() * 100));
  const bringTo = g.ahead(90 + Math.round(rnd() * 60));
  if (which === 'spring' && (!g.canMove || Math.abs(springTo - g.at) < 48)) which = 'gnaw';
  if (which === 'bring' && (!g.canMove || Math.abs(bringTo - g.at) < 60)) which = 'gnaw';
  const toyAt = (where) => Math.round(g.at + g.mir(where === 'rest' ? TOY_REST : FRAME_TOY['happy-chew1']));
  const inside = (px) => clamp(px, 8, g.W - 8);
  const mouth = (frame) => [Math.round(g.at + g.mir(FRAME_MOUTH[frame][0])), toyH(frame)];
  const flat = (x) => ({ lie: { x, h: 0 }, frame: 'toy-flat' });
  let chewing = null;
  const chew = (pairs) => { chewing = { pose: chews(rnd, pairs), prop: { lie: { x: toyAt('paws'), h: 0 }, frame: 'toy-up' } }; g.plan.push(chewing); };

  if (which === 'gnaw') {
    const lieAt = g.canMove ? g.ahead(50 + Math.round(rnd() * 90)) : g.at;
    const rest = inside(Math.round(lieAt + g.mir(TOY_REST)));
    const from = g.off();
    const inMs = clamp(Math.round(Math.abs(rest - from) * 2.6), 500, 1400);
    g.pose([[mood, inMs]], { flip: g.left, prop: { roll: { from, to: rest, ms: inMs }, frame: 'toy-flat' } });
    g.walk(lieAt);
    g.pose([['happy-bow', 380], ['happy-chew1', 300]]);
    g.pose([['happy-chew1', 300]], { prop: { roll: { from: rest, to: toyAt('paws'), ms: 300 }, frame: 'toy-flat' } });
    chew(3 + Math.floor(rnd() * 3));
    g.pose([['happy-bow', 260]], { prop: flat(toyAt('paws')) });
    // He noses it off the end he faces.
    const off = g.off();
    const outMs = clamp(Math.round(Math.abs(off - toyAt('paws')) * 2.2), 400, 1300);
    g.pose([['happy-nudge1', 240], ...g.watch(outMs + 300)], { prop: { roll: { from: toyAt('paws'), to: off, ms: outMs }, frame: 'toy-flat' } });
  } else if (which === 'spring') {
    const land = Math.round(springTo + g.mir(FRAME_BALL['happy-pin']));
    g.pose(g.watch(1000), { flip: g.left, prop: { fly: { from: [g.behind(), 40], to: land, ms: 1000, apex: 50, hops: [8, 3] }, frame: 'toy-flat' } });
    g.pose([['happy-bow', 750]]);
    g.leap(springTo, POUNCE_ARC);
    g.pose([['happy-pin', 350]]);
    g.pose([['happy-chew1', 300]], { prop: { roll: { from: land, to: toyAt('paws'), ms: 300 }, frame: 'toy-flat' } });
    chew(3 + Math.floor(rnd() * 3));
    g.pose([['happy-hold', 700]], { prop: { held: true, frame: 'toy-flat' } });
    g.pose([['happy-hold', 120], ['happy-chew1', 300], ['happy-bow', 260], ...g.watch(600)],
      { prop: { fly: { from: mouth('happy-hold'), to: g.off(), ms: 1200, apex: 46 }, frame: 'toy-flat' } });
  } else {
    const home = g.at;
    const drop = Math.round(bringTo + g.mir(NOSE));
    g.pose(g.watch(900), { flip: g.left, prop: { fly: { from: [g.behind(), 40], to: drop, ms: 900, apex: 40, hops: [5] }, frame: 'toy-flat' } });
    g.walk(bringTo);
    g.pose([['happy-nudge1', 260]]);
    g.pose([['happy-carry', 300]], { prop: { held: true, frame: 'toy-flat' } });
    g.turn(200);
    g.walk(home);
    g.pose([['happy-hold', 1000]]);
    chew(2 + Math.floor(rnd() * 2));
    g.pose([['happy-bow', 220]], { prop: flat(toyAt('paws')) });
    g.pose([['happy-nudge1', 240]]);
    g.pose([['happy-carry', 250]], { prop: { held: true, frame: 'toy-flat' } });
    // To the end he faces and over it, if there is time; else he drops it at his nose and noses it off.
    const end = g.left ? 0 : g.room;
    const walkMs = travelMs(end - g.at, 'walk');
    if (planMs(g.plan) + walkMs + 1000 <= ACT_MAX) {
      g.walk(end);
      g.pose([['happy-carry', 200], ...g.watch(700)], { prop: { fly: { from: mouth('happy-carry'), to: g.off(), ms: 600, apex: 4 }, frame: 'toy-flat' } });
    } else {
      const nose = Math.round(g.at + g.mir(NOSE));
      g.pose([['happy-carry', 120], ['happy-nudge1', 260]], { prop: { fly: { from: mouth('happy-carry'), to: nose, ms: 380, apex: 0, hops: [4] }, frame: 'toy-flat' } });
      const off = g.off();
      const outMs = clamp(Math.round(Math.abs(off - nose) * 2.2), 400, 1300);
      g.pose([['happy-nudge2', 220], ...g.watch(outMs + 200)], { prop: { roll: { from: nose, to: off, ms: outMs }, frame: 'toy-flat' } });
    }
  }
  if (chewing) trim(g.plan, chewing);
  return g.plan;
}

function planTug(mood, opts) {
  const g = playground(mood, opts);
  const { rnd } = g;
  const which = TUG_ROUTINES.includes(opts.routine) ? opts.routine : TUG_ROUTINES[Math.floor(rnd() * 2) % 2];
  const knotAt = (frame) => [Math.round(g.at + g.mir(FRAME_KNOT[frame][0])), CELL_H - 1 - FRAME_KNOT[frame][1]];

  if (which === 'tugger') {
    const faces = g.dir();
    const long = (more) => ({ rope: 'long', faces, ...more });
    const nose = knotAt('happy-nudge1')[0];
    const from = g.off();
    const inMs = clamp(Math.round(Math.abs(nose - from) * 2.4), 600, 1400);
    g.pose(g.watch(inMs + 300), { flip: g.left, prop: long({ roll: { from, to: nose, ms: inMs, h: KNOT_H } }) });
    g.pose([['happy-bow', 600]]);
    g.pose([['happy-nudge1', 220]], { prop: long({ held: true }) });
    // The tug: pulled forward a step, braced back, a shake, and back again. He goes back without turning round, where
    // there is room behind him; where there is none he braces on the spot.
    const shove = (px, frame, ms) => {
      const to = g.at - faces * px;
      if (g.canMove && to >= 0 && to <= g.room) { g.plan.push({ travel: { to, ms, frames: [frame], frameMs: 40, keep: true } }); g.at = to; } else g.pose([[frame, ms]]);
    };
    g.pose([['happy-tug1', 350]]);
    shove(10, 'happy-tug2', 450);
    shove(-14, 'happy-tug1', 300);
    g.pose([['happy-tug3', 200], ['happy-tug1', 160], ['happy-tug3', 200], ['happy-tug1', 160]]);
    shove(12, 'happy-tug2', 600);
    if (rnd() < 0.6) { shove(-10, 'happy-tug1', 300); shove(8, 'happy-tug2', 650); }
    // Yanked away: the knot leaves his mouth and the rope runs off the end it came from.
    const k = knotAt('happy-tug2');
    g.pose([['happy-tug2', 120], ...g.watch(1000)], { prop: long({ slide: { from: k, to: [g.off() + faces * 40, KNOT_H], ms: 450 } }) });
  } else {
    const leapTo = g.canMove ? g.ahead(60 + Math.round(rnd() * 60)) : g.at;
    const lie = Math.round(leapTo + g.mir(FRAME_KNOT['happy-nudge1'][0]) + g.dir() * 15);
    const short = (more) => ({ rope: 'short', ...more });
    g.pose(g.watch(1000), { flip: g.left, prop: short({ fly: { from: [g.behind(), 50], to: lie, ms: 1000, apex: 46, hops: [6, 2], rest: KNOT_H }, spin: true }) });
    if (leapTo !== g.at) { g.pose([['happy-bow', 600]]); g.leap(leapTo, 12); } else g.pose([['happy-bow', 500]]);
    g.pose([['happy-nudge1', 260]]);
    g.pose([['happy-carry', 300]], { prop: short({ held: true, swing: [[90, 300]] }) });
    const swing = [30, 120, 0, 150, 60, 120, 30, 90];
    g.pose(swing.map((_, i) => [i % 2 ? 'happy-carry' : 'happy-tug3', 150]), { prop: short({ held: true, swing: swing.map((d) => [d, 150]) }) });
    const k = knotAt('happy-tug3');
    g.pose([['happy-tug3', 160], ...g.watch(900)], { prop: short({ fly: { from: [k[0] + g.dir() * 15, k[1]], to: g.off() + g.dir() * 30, ms: 700, apex: 30 }, spin: true }) });
  }
  return g.plan;
}

// ---- Where the ball is through one prop step: [{ t, x, h, frame }] every PROP_TICK ms and at its end. Pure, so the
// stage turns it into one animation and the tests can walk it. A roll slows to a stop; a flight goes up to its
// apex and down, then the hops, each lower, then (roll) the rest of the way along the ground.
export const PROP_TICK = 33;
const ROLL_PX = (Math.PI * 13) / 8;   // px rolled per frame: four frames turn the 13 px ball half way round
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const rollFrame = (dist, dir) => {
  const i = Math.floor(Math.abs(dist) / ROLL_PX) % 4;
  return `ball-roll${(dir < 0 ? 3 - i : i) + 1}`;
};

// A spinning short rope turns a step (30 degrees) every this many ms.
const SPIN_MS = 70;
export const SPIN = ['short0', 'short30', 'short60', 'short90', 'short120', 'short150'];

export function propPath(prop) {
  const out = propPoints(prop);
  if (prop.frame) for (const p of out) p.frame = prop.frame;
  else if (prop.spin) out.forEach((p, i) => { p.frame = i === out.length - 1 ? 'short0' : SPIN[Math.floor(p.t / SPIN_MS) % SPIN.length]; });
  else if (prop.rope === 'long') for (const p of out) p.frame = 'rope';
  else if (prop.rope === 'short') for (const p of out) p.frame = 'short0';
  return out;
}

function propPoints(prop) {
  const out = [];
  const each = (ms, at) => { for (let t = 0; ; t = Math.min(ms, t + PROP_TICK)) { out.push({ t, ...at(t / ms) }); if (t >= ms) break; } };
  if (prop.lie) return [{ t: 0, x: Math.round(prop.lie.x), h: Math.round(prop.lie.h ?? 0), frame: 'ball-roll1' }];
  if (prop.slide) {
    const { from: [x0, h0], to: [x1, h1], ms } = prop.slide;
    each(ms, (k) => { const e = k * k; return { x: Math.round(x0 + (x1 - x0) * e), h: Math.round(h0 + (h1 - h0) * e), frame: 'ball-air' }; });
    return out;
  }
  if (prop.roll) {
    const { from, to, ms } = prop.roll;
    const h = prop.roll.h ?? 0;
    each(ms, (k) => { const x = from + (to - from) * easeOut(k); return { x: Math.round(x), h, frame: rollFrame(x - from, to - from) }; });
    return out;
  }
  const { from: [x0, h0], to, ms, apex = 0, hops = [], roll = false, up = false, rest = 0 } = prop.fly;
  const top = Math.max(h0, apex);
  const parts = [{ kind: 'fly', t1: Math.sqrt(Math.max(1, top - h0)), t2: Math.sqrt(Math.max(1, top)), top }];
  parts[0].w = parts[0].t1 + parts[0].t2;
  for (const hh of hops) parts.push({ kind: 'hop', w: 2 * Math.sqrt(hh), top: hh });
  if (roll) parts.push({ kind: 'roll', w: 6 });
  const total = parts.reduce((n, p) => n + p.w, 0);
  // The ends of the flight and of each hop, as shares of the whole, where a hard landing squashes it.
  const lands = []; let sum = 0;
  for (const p of parts) { sum += p.w; if (p.kind !== 'roll' && p.top > 8) lands.push(sum / total); }
  const first = parts[0].w / total;
  // the share of the way covered by the first flight (all of it when there is nothing after it)
  const lob = up || parts.length === 1 ? 1 : roll ? 0.62 : 0.8;
  const span = to - x0;
  each(ms, (k) => {
    const x = k <= first ? x0 + span * lob * (k / first) : x0 + span * (lob + (1 - lob) * easeOut((k - first) / (1 - first)));
    let at = k * total, i = 0;
    while (i < parts.length - 1 && at > parts[i].w) { at -= parts[i].w; i++; }
    const p = parts[i], kk = Math.min(1, at / p.w);
    let h = 0;
    if (p.kind === 'fly') {
      const tt = kk * p.w;
      h = tt < p.t1 ? p.top - (p.top - h0) * ((p.t1 - tt) / p.t1) ** 2 : p.top * (1 - ((tt - p.t1) / p.t2) ** 2);
    } else if (p.kind === 'hop') h = 4 * p.top * kk * (1 - kk);
    h = Math.max(0, Math.round(h)) + Math.round(rest * Math.min(1, k / first));
    const squash = h <= 1 && lands.some((l) => Math.abs(l - k) * ms < 40);
    return { x: Math.round(x), h, frame: squash ? 'ball-squash' : h > 1 ? 'ball-air' : rollFrame(x - x0, span) };
  });
  return out;
}
