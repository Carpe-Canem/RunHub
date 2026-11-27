// Ziggy, the board's dog: full-colour pixel sprites. Each one is a window the size of one frame, with the whole
// sheet behind it; showing another frame moves the sheet. Decoration only, so hidden from screen readers.
import { h } from './dom.js';
import { SHEETS, framePos, sheetSize, sheetUrl } from './ziggy-frames.js';

const SIDE = { trot: ['trot1', 'trot2'], nap: ['nap'] };

// The side sheet's frames for a pose: 'trot', 'nap', and anything else sits.
export const poseFrames = (pose) => (Object.hasOwn(SIDE, pose) ? [...SIDE[pose]] : ['sit']);

// Where the sheet goes to show a frame, as a background-position.
function shift(sheet, name, scale) {
  const { x, y } = framePos(sheet, name);
  return `${-x * scale}px ${-y * scale}px`;
}

// A frame-sized window on a sheet, showing its first frame. scale: a whole number of screen px per drawn px.
export function sprite(sheet, scale = 1) {
  const { w, h: high } = sheetSize(sheet);
  const [cw, ch] = SHEETS[sheet].cell;
  const size = scale === 1 ? '' : `width:${cw * scale}px;height:${ch * scale}px;`;
  return h('span', {
    class: `zg zg-${sheet}`, 'aria-hidden': 'true', 'data-scale': scale === 1 ? null : scale,
    style: `${size}background-image:url("${sheetUrl(sheet)}");background-size:${w * scale}px ${high * scale}px`,
  });
}

export function setFrame(el, sheet, name) {
  el.style.backgroundPosition = shift(sheet, name, +el.dataset.scale || 1);
}

// The side dog. pose: 'trot', 'sit' or 'nap'. The trot's second frame is swapped in by CSS, so reduced motion
// stills it on the first.
export function ziggy(pose, scale = 1) {
  const [first, second] = poseFrames(pose);
  const el = sprite('side', scale);
  el.classList.add(`zg-${second ? 'trot' : first}`);
  setFrame(el, 'side', first);
  if (second) el.style.setProperty('--f2', shift('side', second, scale));
  return el;
}

// A note with Ziggy beside it: sitting by an empty list, napping by something that is not available.
export const withZiggy = (pose, node, scale = 1) => h('div', { class: 'zg-note' }, ziggy(pose, scale), node);
