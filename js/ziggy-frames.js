// Where each of Ziggy's frames sits in his sprite sheets. Pure: the build script and the page both read it.
// A frame's index is its place in `frames`: column i % cols, row floor(i / cols).

export const SHEETS = {
  hub: {
    cell: [96, 88], cols: 8,
    frames: [
      'happy', 'happy-talk', 'happy-wag', 'happy-blink', 'happy-ear', 'happy-yawn', 'happy-shake1', 'happy-shake2',
      'happy-tilt', 'thrilled', 'thrilled-talk', 'thrilled-wag', 'thrilled-blink', 'thrilled-ear', 'eager', 'eager-talk',
      'eager-trot', 'eager-blink', 'eager-ear', 'eager-tail', 'curious', 'curious-talk', 'curious-tilt', 'curious-blink',
      'curious-ear', 'worried', 'worried-talk', 'worried-low', 'worried-glance', 'asleep', 'asleep-breathe', 'asleep-ear',
      'asleep-paw', 'happy-sniff1', 'happy-sniff2', 'happy-look1', 'happy-look2', 'happy-scratch1', 'happy-scratch2',
      'happy-walk1', 'happy-walk2', 'happy-walk3', 'happy-walk4', 'happy-run1', 'happy-run2', 'happy-run3', 'happy-bow',
      'happy-pounce', 'happy-pin', 'happy-carry', 'happy-nudge1', 'happy-nudge2', 'happy-chew1', 'happy-chew2',
      'happy-hold', 'happy-tug1', 'happy-tug2', 'happy-tug3',
      // v57, rest: the lie and its blink, the flat nap and its breath, the dreaming paws, the roll onto his back and
      // its wiggle, and the worried head-low walk.
      'happy-lie', 'happy-lie-blink', 'happy-nap1', 'happy-nap2', 'happy-dream1', 'happy-dream2', 'happy-roll1',
      'happy-roll2', 'happy-roll3', 'worried-pace1', 'worried-pace2', 'worried-pace3', 'worried-pace4',
    ],
  },
  side: { cell: [48, 40], cols: 4, frames: ['sit', 'trot1', 'trot2', 'nap'] },
  // The things he plays with, in colours of their own (the dog's palette is full).
  props: {
    cell: [16, 16], cols: 6, palette: 'props-palette.txt',
    // v57: the z's over him while he sleeps, small, medium and large, each drawn from the cell's top left.
    frames: ['ball-roll1', 'ball-roll2', 'ball-roll3', 'ball-roll4', 'ball-squash', 'ball-air', 'toy-flat', 'toy-up', 'knot',
      'zee-s', 'zee-m', 'zee-l'],
  },
  // The bark stickers (v58): his barks as pixel letters in white with his blue-grey outline, each drawn from the cell's
  // top left (BARK_SIZE says how much of the cell it fills).
  barks: {
    cell: [40, 10], cols: 4, palette: 'props-palette.txt',
    frames: ['woof', 'arf', 'yip', 'awoo', 'zoom', 'ruff', 'bark', 'hmm', 'sniff', 'ooh', 'huff', 'mm'],
  },
  // The long rope (v55): from the knot in his mouth to past the end of the strip, one piece so it is never scaled
  // or turned. Its knot end is on the left.
  rope: { cell: [1024, 5], cols: 1, palette: 'props-palette.txt', frames: ['rope'] },
  // The short rope with a knot at each end, turned clockwise by the angle in its name about the cell's centre.
  ropes: {
    cell: [48, 48], cols: 6, palette: 'props-palette.txt',
    frames: ['short0', 'short30', 'short60', 'short90', 'short120', 'short150'],
  },
};

function sheetOf(sheet) {
  if (!Object.hasOwn(SHEETS, sheet)) throw new Error(`no sprite sheet called "${sheet}"`);
  return SHEETS[sheet];
}

// { x, y, w, h } in sheet pixels.
export function framePos(sheet, name) {
  const { cell: [w, h], cols, frames } = sheetOf(sheet);
  const i = frames.indexOf(name);
  if (i < 0) throw new Error(`no frame called "${name}" in the ${sheet} sheet`);
  return { x: (i % cols) * w, y: Math.floor(i / cols) * h, w, h };
}

// { w, h }: cols cells wide, and a whole number of rows high (one row even when the sheet is empty).
export function sheetSize(sheet) {
  const { cell: [w, h], cols, frames } = sheetOf(sheet);
  return { w: cols * w, h: Math.max(1, Math.ceil(frames.length / cols)) * h };
}

// The sheet's address, with the same ?v= as this module so a new sheet is never served stale.
export function sheetUrl(sheet, base = import.meta.url) {
  sheetOf(sheet);
  const url = new URL(`../sprites/ziggy-${sheet}.png`, base);
  url.search = new URL(base).search;
  return url.href;
}

// For each mood's still, the x in the cell (px from its left) of the top of his head, read off the grid.
// The bubble's pointer aims there. Asleep is curled up, so its point is the blaze, not the top of his back.
export const HEAD = { happy: 62, thrilled: 63, eager: 73, curious: 55, worried: 31, asleep: 25 };

// Frames whose head sits more than 4 px from their mood's still: the middle of the topmost row of the grid, rounded up
// (the same rule that gives the stills above). Every other frame uses its mood's HEAD.
export const FRAME_HEAD = {
  'happy-look1': 55, 'happy-look2': 51,
  'happy-walk1': 68, 'happy-walk2': 69, 'happy-walk3': 68, 'happy-walk4': 68,
  'happy-run1': 76, 'happy-run2': 76, 'happy-run3': 76,
  // Head down at the ball: the top row there is his back or tail, so these are read off the head itself.
  'happy-pin': 56, 'happy-carry': 67, 'happy-nudge1': 71, 'happy-nudge2': 73,
  // v55: lying to chew, and the tug (the crouch read in front of his raised tail; the pull-back and the shake by eye,
  // as the top row there is an ear).
  'happy-chew1': 74, 'happy-chew2': 74, 'happy-hold': 75, 'happy-tug1': 70, 'happy-tug2': 28, 'happy-tug3': 55,
  // v57: lying down (read off the head; on his back, by eye), and the worried walk with its head out in front.
  'happy-lie': 71, 'happy-lie-blink': 71, 'happy-nap1': 76, 'happy-nap2': 76, 'happy-dream1': 76, 'happy-dream2': 76,
  'happy-roll1': 78, 'happy-roll2': 80, 'happy-roll3': 80,
  'worried-pace1': 22, 'worried-pace2': 22, 'worried-pace3': 22, 'worried-pace4': 22,
};

// The z's while he sleeps (v57, the owner's pick Z3): the top row of his head in the frames he sleeps in, so the z's
// start just over it whichever way he lies. The asleep frames all share the curl's.
export const SLEEP_TOP = {
  asleep: 45, 'asleep-breathe': 45, 'asleep-paw': 45, 'asleep-ear': 45,
  'happy-nap1': 56, 'happy-nap2': 56, 'happy-dream1': 54, 'happy-dream2': 56,
  'happy-roll1': 47, 'happy-roll2': 46, 'happy-roll3': 46,
};
// Each z: its frame, its width, and where its top left sits from his head's top: px away from his face, px up.
export const ZEES = [['zee-s', 5, 8, 12], ['zee-m', 7, 14, 22], ['zee-l', 9, 21, 34]];

// The ball (props sheet): its centre sits at this point of its 16 × 16 cell, and its bottom on the cell's last row.
export const BALL_CENTRE = [8, 9];

// Where the ball's centre is when it is in his mouth, in cell px: the carry pose's own ball, and for the walk and the
// gallop the same place under each frame's nose. Only these frames may show him holding it.
export const FRAME_MOUTH = {
  'happy-carry': [74, 45],
  'happy-walk1': [77, 45], 'happy-walk2': [77, 45], 'happy-walk3': [77, 45], 'happy-walk4': [77, 45],
  'happy-run1': [85, 46], 'happy-run2': [85, 55], 'happy-run3': [85, 44],
  'happy-hold': [82, 55],   // v55: lying with the toy across his mouth
};

// The point of a held prop's frame that goes at his mouth (FRAME_MOUTH): the ball's middle, the toy's.
export const PROP_MID = { 'ball-air': BALL_CENTRE, 'toy-flat': [8, 12] };

// Where a prop's frame is anchored, in its own cell: the point put at a place on the strip (x, and h px above the
// ground) or at a point of his cell. The ball and the toy: their middle and their bottom row (so h 0 is on the
// ground); the knot and the short rope: their centre. Every ball frame is anchored as BALL_CENTRE's x.
const PROP_ANCHOR = { 'toy-flat': [8, 15], 'toy-up': [7, 15], knot: [8, 9] };
export const anchorOf = (frame) => PROP_ANCHOR[frame] ?? (frame.startsWith('short') ? [24, 24] : [BALL_CENTRE[0], 15]);

// Where the toy stands between his paws as he chews, as the x of its middle in cell px (v55).
export const FRAME_TOY = { 'happy-chew1': 84, 'happy-chew2': 84 };

// Where the rope's knot is when it is in his mouth (or, nudge1, at his nose on the ground): its centre in cell px.
// Only these frames may show him holding the rope (v55).
export const FRAME_KNOT = {
  'happy-tug1': [87, 66], 'happy-tug2': [36, 42], 'happy-tug3': [72, 43], 'happy-carry': [74, 45], 'happy-nudge1': [91, 82],
  'happy-walk1': [77, 45], 'happy-walk2': [77, 45], 'happy-walk3': [77, 45], 'happy-walk4': [77, 45],
};

// The short rope's knots are this far apart, centre to centre.
export const SHORT_LEN = 30;
// The short rope frame for an angle (0 to 150 in 30s, turned clockwise), and where its cell's top-left goes for its
// back knot to sit at a point: the rope then runs forward (0), down (90) or back under him (150).
export const shortFrame = (deg) => `short${deg}`;
export function shortFrom(deg) {
  const a = (deg * Math.PI) / 180;
  return [-Math.round(24 - (SHORT_LEN / 2) * Math.cos(a)), -Math.round(24 - (SHORT_LEN / 2) * Math.sin(a))];
}

// Where the ball lies on the ground in front of him, as the x of its centre in cell px: before his paws in the
// bow, under them in the pin, at his nose in the nudge.
export const FRAME_BALL = { 'happy-bow': 96, 'happy-pin': 70, 'happy-nudge1': 90, 'happy-nudge2': 91 };

// Frames drawn this many px above the ground (the grids all stand on the bottom row): in the gallop he leaves the
// ground as he gathers and tucks, and his walk bobs on the passing steps. The owner's pick C, 2026-11-28.
export const FRAME_LIFT = { 'happy-walk2': 1, 'happy-walk4': 1, 'happy-run1': 2, 'happy-run2': 6 };

export const liftOf = (frame) => FRAME_LIFT[frame] ?? 0;

// The x of the top of his head in a frame (px from the cell's left); mirrored when he is drawn flipped.
export function headAt(frame, flipped) {
  const x = FRAME_HEAD[frame] ?? HEAD[frame.split('-')[0]];
  return flipped ? SHEETS.hub.cell[0] - 1 - x : x;
}

// The worried and asleep frames are drawn facing left, the rest facing right.
export function facesLeft(frame) {
  return /^(worried|asleep)/.test(frame);
}

// Each bark's own size [w, h] in px (the rest of its cell is clear), so a sticker can be put against a place by its edge.
export const BARK_SIZE = {
  woof: [34, 10], arf: [25, 10], yip: [40, 10], awoo: [34, 10], zoom: [34, 10], ruff: [32, 10], bark: [32, 10],
  hmm: [33, 10], sniff: [40, 10], ooh: [29, 10], huff: [38, 10], mm: [28, 10],
};

// A bark sticker's top left on the strip (v58): in front of his face, 22 px past his head point on the side he faces
// (the frame's own way, turned when he is drawn flipped), 4 px below the strip's top. Where that would leave the strip
// (width wide) it goes behind his head instead, 4 px clear of his edge. dogLeft: his left edge on the strip.
export function barkPlace(bark, frame, flipped, dogLeft, wide) {
  const [w] = BARK_SIZE[bark];
  const left = facesLeft(frame) !== flipped;
  const head = dogLeft + headAt(frame, flipped);
  let x = left ? head - 22 - w : head + 22;
  if (x < 0 || x + w > wide) x = left ? dogLeft + SHEETS.hub.cell[0] + 4 : dogLeft - w - 4;
  return { left: x, top: 4 };
}
