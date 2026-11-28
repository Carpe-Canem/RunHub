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
      'happy-pounce', 'happy-pin', 'happy-carry', 'happy-nudge1', 'happy-nudge2',
    ],
  },
  side: { cell: [48, 40], cols: 4, frames: ['sit', 'trot1', 'trot2', 'nap'] },
  // The things he plays with, in colours of their own (the dog's palette is full).
  props: {
    cell: [16, 16], cols: 6, palette: 'props-palette.txt',
    frames: ['ball-roll1', 'ball-roll2', 'ball-roll3', 'ball-roll4', 'ball-squash', 'ball-air'],
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
};

// The ball (props sheet): its centre sits at this point of its 16 × 16 cell, and its bottom on the cell's last row.
export const BALL_CENTRE = [8, 9];

// Where the ball's centre is when it is in his mouth, in cell px: the carry pose's own ball, and for the walk and the
// gallop the same place under each frame's nose. Only these frames may show him holding it.
export const FRAME_MOUTH = {
  'happy-carry': [74, 45],
  'happy-walk1': [77, 45], 'happy-walk2': [77, 45], 'happy-walk3': [77, 45], 'happy-walk4': [77, 45],
  'happy-run1': [85, 46], 'happy-run2': [85, 55], 'happy-run3': [85, 44],
};

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
