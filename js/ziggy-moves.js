// How Ziggy moves: the fidget picker, the frame sequences, and the arithmetic of typing and wandering.
// Pure: no DOM, no timers. Frame names are those of the hub sheet in ziggy-frames.js.

export const TYPE_MS = 1500;    // a line types out over this
export const TALK_MS = 130;     // mouth open, mouth shut
export const MOOD_MS = 3200;    // the mood's own movement after speaking, at most: with the typing, under 5 s

export const FIDGETS = {
  happy:    ['blink', 'ear', 'tail', 'yawn', 'shake', 'tilt', 'wander'],
  thrilled: ['blink', 'ear', 'tail', 'wander'],
  eager:    ['blink', 'ear', 'tail', 'wander'],
  curious:  ['blink', 'ear', 'tilt', 'wander'],
  worried:  ['sigh', 'glance'],
  asleep:   ['ear', 'paw'],
};

// A wander is not a frame sequence: the stage moves him and swaps these two frames.
export const WANDER = { sheet: 'hub', frames: ['eager', 'eager-trot'], scale: 1 };

const MARGIN = 48;      // a wander goes at least this far
const MIN_ROOM = 96;    // on a narrower strip he stays put
const MS_PER_PX = 5.5;
const WANDER_MAX = 1900;

// rnd is a number from 0 up to 1, mapped straight onto the choices left, so there is no drawing again.
export function pickFidget(mood, last, rnd = Math.random) {
  const choices = FIDGETS[mood].filter((f) => f !== last);
  return choices[Math.floor(rnd() * choices.length)];
}

export const fidgetWait = (rnd = Math.random) => 6000 + Math.floor(rnd() * 8001);

const times = (n, ...pair) => Array.from({ length: n }, () => pair).flat();
const breathe = (ms) => times(2, ['asleep-breathe', ms], ['asleep', ms]);
const talk = (m) => [[m, TALK_MS], [`${m}-talk`, TALK_MS]];
const blink = (m) => [[m, 400], [`${m}-blink`, 120], [m, 220], [`${m}-blink`, 120], [m, 400]];
const ear = (m) => [[m, 300], [`${m}-ear`, 200], [m, 150], [`${m}-ear`, 200], [m, 350]];
const tail = (m) => times(4, [m === 'eager' ? 'eager-tail' : `${m}-wag`, 150], [m, 150]);
const tilt = (m) => [[`${m}-tilt`, 1100], [m, 300]];

// The sequences and timings the owner approved on the sprite sheets' review page, the mood movements since cut
// shorter (fewer repeats, same rhythm) so that typing and movement together stay under 5 s.
const MOVES = {
  happy: {
    talk: talk('happy'), mood: times(6, ['happy-wag', 250], ['happy', 250]),
    blink: blink('happy'), ear: ear('happy'), tail: tail('happy'), tilt: tilt('happy'),
    yawn: [['happy', 200], ['happy-yawn', 1000], ['happy', 300]],
    shake: [...times(6, ['happy-shake1', 90], ['happy-shake2', 90]), ['happy', 200]],
  },
  thrilled: {
    talk: talk('thrilled'), mood: times(13, ['thrilled-wag', 120], ['thrilled', 120]),
    blink: blink('thrilled'), ear: ear('thrilled'), tail: tail('thrilled'),
  },
  eager: {
    talk: talk('eager'), mood: times(10, ['eager-trot', 150], ['eager', 150]),
    blink: blink('eager'), ear: ear('eager'), tail: tail('eager'),
  },
  curious: {
    talk: talk('curious'),
    mood: [['curious-tilt', 900], ['curious', 500], ['curious-tilt', 900], ['curious', 300]],
    blink: blink('curious'), ear: ear('curious'), tilt: tilt('curious'),
  },
  worried: {
    talk: talk('worried'), mood: [['worried-low', 1200], ['worried', 500], ['worried-low', 1200], ['worried', 300]],
    sigh: [['worried-low', 1300], ['worried', 300]],
    glance: [['worried-glance', 1100], ['worried', 300]],
  },
  // A sleeping dog that talks reads wrong: while his line types he breathes.
  asleep: {
    talk: breathe(1000), mood: breathe(800),
    ear: [['asleep-ear', 150], ['asleep', 150], ['asleep-ear', 150], ['asleep', 600]],
    paw: [['asleep-paw', 180], ['asleep', 180], ['asleep-paw', 180], ['asleep', 500]],
  },
};

// [[frame, ms], ...] for 'talk' (one cycle, repeated while the line types), 'mood' or a fidget but 'wander'.
export function steps(mood, move) {
  if (!Object.hasOwn(MOVES, mood) || !Object.hasOwn(MOVES[mood], move)) throw new Error(`${mood} has no move called "${move}"`);
  return MOVES[mood][move].map((step) => [...step]);
}

// Characters shown, ms into the typing.
export const typedCount = (ms, len) => Math.floor(len * Math.min(1, Math.max(0, ms / TYPE_MS)));

// The typed count after the same line's words changed: a finished line stays whole, a part-typed one carries on.
export const carryTyped = (typed, wasDone, newLen) => (wasDone ? newLen : Math.min(typed, newLen));

// The parts cut after n characters. Each piece keeps its part's tone; no piece is empty.
export function splitParts(parts, n) {
  const on = []; const off = [];
  let left = Math.max(0, n);
  for (const p of parts) {
    if (left >= p.text.length) on.push(p);
    else if (left <= 0) off.push(p);
    else { on.push({ ...p, text: p.text.slice(0, left) }); off.push({ ...p, text: p.text.slice(left) }); }
    left -= p.text.length;
  }
  return { on, off };
}

// Where the line being shown is in a new list. fresh: it is gone, so he starts again from the first line.
export function keepLine(lines, key) {
  const i = lines.findIndex((l) => l.key === key);
  return i < 0 ? { i: 0, fresh: true } : { i, fresh: false };
}

export const canFidget = ({ hidden, onScreen, typing, motion }) => !hidden && !!onScreen && !typing && !!motion;

// A new left edge in 0..room, at least MARGIN from x. One draw is spread over the stretch left of him and the
// stretch right of him.
export function wanderTo(x, room, rnd = Math.random) {
  if (room < MIN_ROOM) return x;
  const from = Math.min(room, Math.max(0, x));   // the strip may have narrowed under him
  const left = Math.max(0, from - MARGIN);
  const right = Math.max(0, room - from - MARGIN);
  const hasLeft = from >= MARGIN;
  const hasRight = from + MARGIN <= room;
  // Both stretches can be single points (room 96, standing in the middle).
  if (left + right === 0) return hasLeft && (!hasRight || rnd() < 0.5) ? 0 : room;
  const at = rnd() * (left + right);
  return hasLeft && (at < left || !hasRight) ? Math.min(at, left) : from + MARGIN + (at - left);
}

// ms to trot that far, under 2 s however wide the strip.
export const wanderMs = (dx) => Math.min(WANDER_MAX, Math.round(Math.abs(dx) * MS_PER_PX));
