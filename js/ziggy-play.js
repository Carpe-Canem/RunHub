// What Ziggy does with a stretch of time: pick an activity, then plan it as steps the stage can play.
// Pure: no DOM, no timers. Frame names are those of the hub sheet in ziggy-frames.js.

import { FIDGETS, MIN_ROOM, MS_PER_PX, steps, wanderTo } from './ziggy-moves.js';
import { SHEETS, FRAME_MOUTH, FRAME_BALL, BALL_CENTRE } from './ziggy-frames.js';

export const ACT_MIN = 4000;     // an activity lasts at least this long, in ms,
export const ACT_MAX = 12000;    // and at most this

// Phase 1: the activity names for each mood and how often each is picked.
// Phase 3 (v54) adds the ball.
export const ACTIVITIES = {
  happy:    { stroll: 3, dash: 2, potter: 2, ball: 3 },
  thrilled: { stroll: 3, dash: 2, potter: 2, ball: 3 },
  eager:    { stroll: 3, dash: 2, potter: 2, ball: 3 },
  curious:  { stroll: 3, dash: 2, potter: 2, ball: 3 },
  worried:  { mope: 1, fret: 1 },
  asleep:   { doze: 1 },
};

// What a worried dog does, beat by beat, and how often. 'low' and 'still' are holds of the plan's own (not fidgets):
// his head down, or just standing there worried.
const MOPE = { sigh: 3, low: 2, glance: 1 };
const FRET = { glance: 3, still: 2, sigh: 1 };

// Step = { pose: [[frame, ms], ...], flip? } | { travel: { to, ms, frames, frameMs, arc? } }, either with a prop?.
// flip: the pose is drawn mirrored (he faces left) from here on. arc: a trip in the air, this many px up at its middle.
// prop: what the ball does from the start of the step (see propPath): { held: true } in his mouth,
// { roll: { from, to, ms } } along the ground, or { fly: { from: [x, h], to, ms, apex, hops, roll?, up? } } through
// the air. x is the ball's centre on the strip, h its bottom above the ground, in px.

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

export function propPath(prop) {
  const out = [];
  const each = (ms, at) => { for (let t = 0; ; t = Math.min(ms, t + PROP_TICK)) { out.push({ t, ...at(t / ms) }); if (t >= ms) break; } };
  if (prop.roll) {
    const { from, to, ms } = prop.roll;
    each(ms, (k) => { const x = from + (to - from) * easeOut(k); return { x: Math.round(x), h: 0, frame: rollFrame(x - from, to - from) }; });
    return out;
  }
  const { from: [x0, h0], to, ms, apex = 0, hops = [], roll = false, up = false } = prop.fly;
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
  const lob = up ? 1 : roll ? 0.62 : 0.8;   // the share of the way covered by the first flight
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
    h = Math.max(0, Math.round(h));
    const squash = h <= 1 && lands.some((l) => Math.abs(l - k) * ms < 40);
    return { x: Math.round(x), h, frame: squash ? 'ball-squash' : h > 1 ? 'ball-air' : rollFrame(x - x0, span) };
  });
  return out;
}
