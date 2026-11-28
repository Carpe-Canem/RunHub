// What Ziggy does with a stretch of time: pick an activity, then plan it as steps the stage can play.
// Pure: no DOM, no timers. Frame names are those of the hub sheet in ziggy-frames.js.

import { FIDGETS, MIN_ROOM, MS_PER_PX, TROT, steps, wanderTo } from './ziggy-moves.js';

export const ACT_MIN = 4000;     // an activity lasts at least this long, in ms,
export const ACT_MAX = 12000;    // and at most this

// Phase 1: the activity names for each mood and how often each is picked.
export const ACTIVITIES = {
  happy:    { stroll: 3, dash: 2, potter: 2 },
  thrilled: { stroll: 3, dash: 2, potter: 2 },
  eager:    { stroll: 3, dash: 2, potter: 2 },
  curious:  { stroll: 3, dash: 2, potter: 2 },
  worried:  { mope: 1, fret: 1 },
  asleep:   { doze: 1 },
};

// What a worried dog does, beat by beat, and how often. 'low' and 'still' are holds of the plan's own (not fidgets):
// his head down, or just standing there worried.
const MOPE = { sigh: 3, low: 2, glance: 1 };
const FRET = { glance: 3, still: 2, sigh: 1 };

// Step = { pose: [[frame, ms], ...] } | { travel: { to, ms, frames, frameMs } }

const LEAD_MS = 400;      // a plan that opens with a trot first holds his still this long, so it opens on a pose
const PACE = {
  walk: { msPerPx: MS_PER_PX, max: 2600, frameMs: 150 },
  run:  { msPerPx: 2.4, max: 1200, frameMs: 90 },
};

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

// beat: a fidget name every beat must use. One the mood lacks, or a wander, is ignored.
export function planActivity(mood, name, { x, room, rnd = Math.random, beat = null }) {
  if (!Object.hasOwn(ACTIVITIES[mood] ?? {}, name)) throw new Error(`${mood} has no activity called "${name}"`);
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
  // A trot to `to` (a place of the strip), or to a new one. Never one that leaves no room under ACT_MAX for the beat
  // that must follow it: a plan ends on a pose.
  const travel = (pace, to = wanderTo(at, room, rnd)) => {
    if (!canMove) return;
    const ms = travelMs(to - at, pace);
    if (ms <= 0) return;
    const lead = plan.length ? 0 : LEAD_MS;
    if (total + lead + ms + poseMs(steps(mood, shortest)) > ACT_MAX) return;
    if (lead) add({ pose: [[mood, lead]] });
    add({ travel: { to, ms, frames: [...TROT], frameMs: PACE[pace].frameMs } });
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
      // There and back: the same trot, faster, to a spot and then to where he started.
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
