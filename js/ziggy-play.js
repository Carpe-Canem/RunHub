// What Ziggy does with a stretch of time: pick an activity, then plan it as steps the stage can play.
// Pure: no DOM, no timers. Frame names are those of the hub sheet in ziggy-frames.js.

import { FIDGETS, steps, wanderTo } from './ziggy-moves.js';

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

// Step = { pose: [[frame, ms], ...] } | { travel: { to, ms, frames, frameMs } }

const MIN_ROOM = 96;      // on a narrower strip he stays put (as in ziggy-moves)
const LEAD_MS = 400;      // a plan that opens with a trot first holds his still this long, so it opens on a pose
const PACE = {
  walk: { msPerPx: 5.5, max: 2600, frameMs: 150 },
  run:  { msPerPx: 2.4, max: 1200, frameMs: 90 },
};
const TROT = ['eager', 'eager-trot'];

export const travelMs = (dx, pace) => Math.min(PACE[pace].max, Math.round(Math.abs(dx) * PACE[pace].msPerPx));

// Weighted by the mood's table; never the one just played unless it is the only one.
export function pickActivity(mood, last, rnd = Math.random) {
  const all = Object.entries(ACTIVITIES[mood]);
  const left = all.filter(([name]) => name !== last);
  const from = left.length ? left : all;
  let at = rnd() * from.reduce((sum, [, w]) => sum + w, 0);
  for (const [name, w] of from) { at -= w; if (at < 0) return name; }
  return from.at(-1)[0];
}

export function planMs(list) {
  return list.reduce((sum, s) => sum + (s.pose ? s.pose.reduce((n, [, ms]) => n + ms, 0) : s.travel.ms), 0);
}

const poseMs = (pose) => pose.reduce((n, [, ms]) => n + ms, 0);

// beat: a fidget name every beat must use. One the mood lacks, or a wander, is ignored.
export function planActivity(mood, name, { x, room, rnd = Math.random, beat = null }) {
  if (!Object.hasOwn(ACTIVITIES[mood] ?? {}, name)) throw new Error(`${mood} has no activity called "${name}"`);
  const beats = FIDGETS[mood].filter((f) => f !== 'wander');
  const own = beat && beats.includes(beat) ? [beat] : beats;
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const count = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const fixed = (...order) => order.map((b) => (own.length === 1 ? own[0] : b));   // a beat hook overrides the order

  const plan = [];
  let at = Math.min(Math.max(0, x), Math.max(0, room));
  let total = 0;
  const add = (step) => { plan.push(step); total += planMs([step]); };
  const canMove = room >= MIN_ROOM;

  const travel = (pace) => {
    if (!canMove) return;
    const to = wanderTo(at, room, rnd);
    const ms = travelMs(to - at, pace);
    if (ms <= 0) return;
    if (!plan.length) add({ pose: [[mood, LEAD_MS]] });
    add({ travel: { to, ms, frames: [...TROT], frameMs: PACE[pace].frameMs } });
    at = to;
  };
  const play = (b) => {
    const pose = steps(mood, b);
    if (total + poseMs(pose) > ACT_MAX) return false;
    add({ pose });
    return true;
  };
  const breathe = (pairs) => add({ pose: Array.from({ length: pairs }, () => [['asleep-breathe', 1000], ['asleep', 1000]]).flat() });

  switch (name) {
    case 'stroll':
      travel('walk');
      for (let n = count(1, 2); n > 0; n--) play(pick(own));
      break;
    case 'dash':
      travel('run');
      play(own.includes('tail') && own.length > 1 ? 'tail' : pick(own));
      travel('run');
      play(pick(own));
      break;
    case 'potter':
      for (let n = count(2, 3), i = 0; i < n; i++) {
        if (i) travel('walk');
        play(pick(own));
      }
      break;
    case 'mope':
      for (const b of fixed('sigh', 'glance', 'sigh')) play(b);
      break;
    case 'fret':
      for (const b of fixed('glance', 'sigh', 'glance', 'glance')) play(b);
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
