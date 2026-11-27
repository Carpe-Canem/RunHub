// Ziggy's stage at the foot of the hub: the bubble he speaks from, the strip he walks on, and the one timer that
// drives him. The rules (which line, how much is typed, where he stands) are pure functions of a small state; the
// rest of this file turns that state into nodes. Nothing here is stored: a reload starts from the first line.
import { h, motionOK } from './dom.js';
import { SHEETS, HEAD } from './ziggy-frames.js';
import { sprite, setFrame } from './ziggy.js';
import {
  TYPE_MS, FIDGETS, WANDER, pickFidget, fidgetWait, steps, typedCount, carryTyped, splitParts, lengthOf, keepLine,
  canFidget, wanderTo, wanderMs,
} from './ziggy-moves.js';

const CELL = SHEETS.hub.cell[0];   // his width on the strip
const TICK = 40;                   // ms between looks at the clock while a line types
const TROT_MS = 150;               // each of the wander's two frames
const GRACE = 34;                  // ms a trip is given past its slide

// key: the line showing. i: its place in the list. typed, len: characters shown, and in the whole line.
// phase: 'typing', 'moving' (the mood's own movement), 'still', 'fidget' or 'wander'. x: his left edge on the
// strip in px, null until the strip has been measured. to: where a wander is taking him. last: the last fidget.
export const START = { key: null, i: 0, typed: 0, len: 0, phase: 'still', x: null, to: null, last: null };

// Where he stands once a trip is cut short: at its end.
const landed = (s) => (s.phase === 'wander' ? s.to : s.x);

// Line i from its first character. motion false (reduced motion): the whole line at once, and no movement.
function show(s, lines, i, motion) {
  const len = lengthOf(lines[i]);
  return { ...s, key: lines[i].key, i, len, typed: motion ? 0 : len, phase: motion ? 'typing' : 'still', x: landed(s), to: null };
}

// The hub redrew with these lines. The line he is on is kept wherever it now is in the list, and new words for
// it are swapped in under the typing; only a line that is gone sends him back to the first.
export function onLines(s, lines, motion) {
  const { i, fresh } = keepLine(lines, s.key);
  if (fresh) return show(s, lines, i, motion);
  const len = lengthOf(lines[i]);
  if (!motion) return { ...s, i, len, typed: len, phase: 'still', x: landed(s), to: null };
  return { ...s, i, len, typed: carryTyped(s.typed, s.phase !== 'typing', len) };
}

// A press on the bubble or the dog: the next line, the first after the last. With one line there is no next.
export function onPress(s, lines, motion) {
  return lines.length > 1 ? show(s, lines, (s.i + 1) % lines.length, motion) : s;
}

let el = null;      // the stage: made on the first call, the same node ever after
let say; let on; let off; let tail; let strip; let dog; let pic;
let lines = [];
let only = null;    // a fidget to play every time (the checks' hook)
let s = START;
let timer = null;   // the one timer
let t0 = 0;         // when the line would have started typing, to have got as far as it has

const mood = () => lines[s.i].mood;
const after = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
const stop = () => { clearTimeout(timer); timer = null; };
const part = (p) => (p.tone ? h('b', { class: p.tone }, p.text) : p.text);

// The bubble: a button while there is another line to ask for, a plain box when there is one.
function bubble(pressable) {
  return pressable
    ? h('button', { type: 'button', class: 'zs-say', 'data-focus': 'hub-ziggy', onclick: press }, on, off, h('span', { class: 'vh' }, ' Next line'))
    : h('div', { class: 'zs-say' }, on, off);
}

function build() {
  on = h('span', { class: 'zs-on' });
  off = h('span', { class: 'zs-off' });
  say = bubble(false);
  tail = h('span', { class: 'zs-tail', 'aria-hidden': 'true' });
  pic = sprite('hub');
  dog = h('span', { class: 'zs-dog', onclick: press }, pic,
    [1, 2, 3].map(() => h('i', { class: 'zs-spark' })), [1, 2].map(() => h('i', { class: 'zs-z' }, 'z')));
  strip = h('div', { class: 'zs-strip', 'aria-hidden': 'true' }, dog);
  el = h('div', { id: 'ziggyStage', class: 'zs' }, say, tail, strip);
  // The strip is measured when it is first laid out, and again whenever its width changes.
  new ResizeObserver(fit).observe(strip);
  document.addEventListener('visibilitychange', seen);
}

// Everything the state decides, written to the page. The frame is not: whatever is moving him sets that.
function draw() {
  const line = lines[s.i];
  Object.assign(el.dataset, { mood: line.mood, state: s.phase, line: s.key, typed: s.typed, fidget: s.last || '' });
  const { on: shown, off: hid } = splitParts(line.parts, s.typed);
  on.replaceChildren(...shown.map(part));
  off.replaceChildren(...hid.map(part));
  if (s.x === null) return;
  // The pointer is placed by the same number as the dog, in the same frame, so it is over him the whole way.
  const x = s.phase === 'wander' ? s.to : s.x;
  dog.style.left = `${x}px`;
  tail.style.left = `${x + HEAD[line.mood]}px`;
}

// The strip's width is known, or has changed: he starts in the middle, and is never left off its end.
function fit() {
  const wide = strip.clientWidth;
  if (!wide || !lines.length) return;   // the hub is not the view on screen, or he has just been reset
  const room = Math.max(0, wide - CELL);
  s = { ...s, x: s.x === null ? Math.round(room / 2) : Math.min(s.x, room), to: s.to === null ? null : Math.min(s.to, room) };
  draw();
}

// A trip is over, or cut short: nothing slides and he faces the way he was drawn.
function land() {
  for (const moved of [dog, tail]) {
    moved.style.transition = '';
    // Taking the transition away does not stop a slide that is under way; cancelling it does.
    for (const a of moved.getAnimations()) a.cancel();
  }
  pic.style.transform = '';
}

const hold = () => setFrame(pic, 'hub', mood());

function settle() {
  s = { ...s, phase: 'still', x: landed(s), to: null };
  land();
  hold();
  draw();
  wait();
}

function wait() {
  if (motionOK()) after(fidgetWait(), due);
  else stop();
}

// The frame of a repeating sequence, ms into it.
function frameAt(seq, ms) {
  let left = ms % seq.reduce((n, [, t]) => n + t, 0);
  for (const [name, t] of seq) { if (left < t) return name; left -= t; }
  return seq[0][0];
}

// A line types by the clock, not by counting ticks, so a slow tab or a redraw cannot stall it or start it again.
function type() {
  const ms = performance.now() - t0;
  s = { ...s, typed: Math.min(s.len, Math.max(s.typed, typedCount(ms, s.len))) };
  if (s.typed >= s.len) {
    s = { ...s, phase: 'moving' };
    draw();
    play('mood');
    return;
  }
  setFrame(pic, 'hub', frameAt(steps(mood(), 'talk'), ms));
  draw();
  after(TICK, type);
}

// The typing carries on from s.typed characters.
const typeOn = () => { t0 = performance.now() - ((s.typed + 0.5) / Math.max(1, s.len)) * TYPE_MS; };

// One run through a sequence of the mood's frames, then the still.
function play(move) {
  const seq = steps(mood(), move);
  const step = (k) => {
    if (k >= seq.length) { settle(); return; }
    setFrame(pic, 'hub', seq[k][0]);
    after(seq[k][1], () => step(k + 1));
  };
  step(0);
}

// A fidget has fallen due. When it may not play (the tab or the hub is out of sight, a line is typing), he
// waits again.
function due() {
  const ok = canFidget({ hidden: document.hidden, onScreen: strip.clientWidth > 0, typing: s.phase === 'typing', motion: motionOK() });
  if (!ok || s.x === null) { wait(); return; }
  const name = FIDGETS[mood()].includes(only) ? only : pickFidget(mood(), s.last);
  s = { ...s, last: name };
  if (name === 'wander') { wander(); return; }
  s = { ...s, phase: 'fidget' };
  draw();
  play(name);
}

// He trots to another spot. The dog and the pointer slide by one transition; the timer swaps his legs and ends
// the trip by the clock (a transition's own end is never heard if the view is hidden part-way).
function wander() {
  const to = Math.round(wanderTo(s.x, strip.clientWidth - CELL));
  const dx = to - s.x;
  if (!dx) { settle(); return; }
  const ms = wanderMs(dx);
  const slide = `left ${ms}ms linear`;
  dog.style.transition = slide;
  tail.style.transition = slide;
  pic.style.transform = dx < 0 ? 'scaleX(-1)' : '';
  s = { ...s, phase: 'wander', to };
  draw();
  const from = performance.now();
  const trot = () => {
    const t = performance.now() - from;
    // Two frames' grace, so the slide has drawn its last step before it is switched off.
    if (t >= ms + GRACE) { settle(); return; }
    setFrame(pic, WANDER.sheet, WANDER.frames[Math.floor(t / TROT_MS) % WANDER.frames.length]);
    after(Math.min(TROT_MS - (t % TROT_MS), ms + GRACE - t), trot);
  };
  trot();
}

// A line has just appeared: it types from its first character, or with reduced motion is simply there.
function begin() {
  stop();
  land();
  draw();
  if (s.phase !== 'typing') { hold(); return; }
  t0 = performance.now();
  type();
}

function press() {
  const next = onPress(s, lines, motionOK());
  if (next === s) return;
  s = next;
  begin();
}

// The tab was hidden or shown. Hidden: nothing runs. Shown again: a line still typing catches up, anything else
// goes back to the still, and the wait for a fidget starts afresh.
function seen() {
  if (document.hidden) { stop(); return; }
  if (!motionOK() || !lines.length) return;
  if (s.phase === 'typing') type();
  else settle();
}

// The demo was left, or this browser connected or disconnected: he starts again from the first line, in the middle.
export function resetZiggy() {
  if (!el) return;
  stop();
  land();
  s = START;
  lines = [];
}

// lines: from ziggyLines(), never empty. opts.only: a fidget of the mood's set to play every time.
export function ziggyStage(newLines, opts) {
  if (!el) build();
  if (!newLines.length) return el;
  const motion = motionOK();
  const was = s;
  lines = newLines;
  only = (opts && opts.only) || null;
  s = onLines(s, lines, motion);
  const pressable = lines.length > 1;
  if (pressable !== (say.tagName === 'BUTTON')) {
    const focused = document.activeElement === say;
    const next = bubble(pressable);
    say.replaceWith(next);
    say = next;
    if (focused) {
      // A plain box takes focus only when told it may; -1 adds no Tab stop.
      if (!pressable) say.setAttribute('tabindex', '-1');
      say.focus({ preventScroll: true });
    }
  }
  el.classList.toggle('zs-more', pressable);
  // After a reset the strip may not change width, so nothing else would place him.
  if (s.x === null) fit();
  if (s.key !== was.key) begin();
  else if (!motion) { stop(); land(); hold(); draw(); }
  else {
    if (s.phase === 'typing' && (s.len !== was.len || s.typed !== was.typed)) typeOn();
    draw();
    // Motion came back, or the tab was hidden when he last settled: the wait for a fidget starts.
    if (timer === null && !document.hidden) { if (s.phase === 'typing') type(); else settle(); }
  }
  return el;
}
