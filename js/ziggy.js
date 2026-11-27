// Ziggy, the board's dog: a dot-matrix sprite, 24 cells by 14, facing right.
// Cells: . off, o coat (half lit), e ear (dimmer), # white (fully lit), c collar (the only blue on the board).
// The muzzle has one white cell behind the nose and no more.
import { h, svg } from './dom.js';

export const W = 24;
export const H = 14;

const TROT = [
  '..#.....................',
  '.#.............oo.......',
  '.o............ooooo.....',
  '.o............oeeo.ooo..',
  '..o...........ooeooooo#o',
  '..o..........oooooooo#..',
  '...oooooooooocc##.......',
  '...ooooooooooo##........',
  '...ooooooooooo#.........',
  '...oooo....oooo.........',
  '....oo......oo..........',
  '...o..o....o..o.........',
  '..o....o..o....o........',
  '.#......##......#.......',
];
const TROT_LEGS_IN = [
  '.....oo....oo...........',
  '......oo..oo............',
  '.......#..#.............',
];
const SIT = [
  '........................',
  '...............oo.......',
  '..............ooooo.....',
  '..............oeeo.ooo..',
  '..............ooeooooo#o',
  '.............oooooooo#..',
  '............occ##.......',
  '...........oooo##.......',
  '..........ooooo##.......',
  '.........oooooooo.......',
  '........oooooo.oo.......',
  '.......ooooooo.oo.......',
  '.#....oooooooo.oo.......',
  '..oooooooo###..##.......',
];
const EMPTY = '.'.repeat(W);
const NAP = [
  ...new Array(10).fill(EMPTY),
  '......ooooooo...oo......',
  '....ooooooooooooeeoo....',
  '...oooooooooooooeoooo#o.',
  '#ooooooooo###ooo.####...',
];

export const FRAMES = { trot1: TROT, trot2: [...TROT.slice(0, 11), ...TROT_LEGS_IN], sit: SIT, nap: NAP };

const DOT = 0.84;   // a lit cell, in cells: the rest is the gap between dots
const INSET = ((1 - DOT) / 2).toFixed(2).slice(1);   // ".08"

// Path data per kind of cell ({o, e, '#', c}) for rows from..to: one small square per lit cell.
export function cellPaths(rows, from = 0, to = rows.length) {
  const d = {};
  for (let y = from; y < to; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const k = rows[y][x];
      if (k !== '.') d[k] = `${d[k] || ''}M${x}${INSET} ${y}${INSET}h${DOT}v${DOT}h-${DOT}z`;
    }
  }
  return d;
}

const CLS = { o: 'zg-o', e: 'zg-e', '#': 'zg-w', c: 'zg-c' };
const layer = (rows, from, to, cls) => svg('g', { class: cls },
  Object.entries(cellPaths(rows, from, to)).map(([k, d]) => svg('path', { class: CLS[k], d })));

// pose: 'trot', 'sit' or 'nap'. cell: the size of one cell in px. Decoration only, so hidden from screen readers.
// The trot's two leg frames are swapped by CSS, so reduced motion stills them.
export function ziggy(pose, cell = 2) {
  const p = pose === 'trot' || pose === 'nap' ? pose : 'sit';
  const kids = p === 'trot'
    ? [layer(TROT, 0, 11), layer(TROT, 11, H, 'zg-f1'), layer(FRAMES.trot2, 11, H, 'zg-f2')]
    : [layer(FRAMES[p], 0, H)];
  return svg('svg', { class: `zg zg-${p}`, viewBox: `0 0 ${W} ${H}`, width: W * cell, height: H * cell, 'aria-hidden': 'true', focusable: 'false' }, kids);
}

// A note with Ziggy beside it: sitting by an empty list, napping by something that is not available.
export const withZiggy = (pose, node, cell = 2) => h('div', { class: 'zg-note' }, ziggy(pose, cell), node);
