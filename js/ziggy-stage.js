// Ziggy's stage at the foot of the hub: the bubble he speaks from, the strip he walks on, and the one timer that
// drives him. The rules (which line, how much is typed, where he stands) are pure functions of a small state; the
// rest of this file turns that state into nodes. Nothing here is stored: a reload starts from the first line.
import { h, motionOK } from './dom.js';
import {
  SHEETS, FRAME_MOUTH, FRAME_KNOT, PROP_MID, anchorOf, shortFrom, shortFrame, framePos, headAt, facesLeft, liftOf,
} from './ziggy-frames.js';
import { sprite, setFrame } from './ziggy.js';
import {
  TYPE_MS, FIDGETS, steps, typedCount, carryTyped, splitParts, lengthOf, keepLine, canFidget,
} from './ziggy-moves.js';
import { ACTIVITIES, BALL_ROUTINES, CHEW_ROUTINES, TUG_ROUTINES, pickActivity, planActivity, propPath } from './ziggy-play.js';

const CELL = SHEETS.hub.cell[0];   // his width on the strip
const TICK = 40;                   // ms between looks at the clock while a line types
const GRACE = 34;                  // ms a trip is given past its slide
const ROUTINES = [...BALL_ROUTINES, ...CHEW_ROUTINES, ...TUG_ROUTINES];
const KNOT_AT = anchorOf('knot');  // the knot's centre in its cell
const LINE_W = SHEETS.rope.cell[0];

// key: the line showing. i: its place in the list. typed, len: characters shown, and in the whole line.
// phase: 'typing', 'moving' (the mood's own movement), 'play' (a pose of an activity), 'wander' (a trip of one)
// or 'still' (Reduce Motion). x: his left edge on the strip in px, null until the strip has been measured.
// to: where a trip is taking him. flip: drawn mirrored, after a trip against the way his frames face, until the
// next line. act: the activity he is playing.
export const START = { key: null, i: 0, typed: 0, len: 0, phase: 'still', x: null, to: null, flip: false, act: null };

// Where he stands once a trip is cut short: at its end.
const landed = (s) => (s.phase === 'wander' ? s.to : s.x);

// Line i from its first character. motion false (reduced motion): the whole line at once, and no movement.
function show(s, lines, i, motion) {
  const len = lengthOf(lines[i]);
  return {
    ...s, key: lines[i].key, i, len, typed: motion ? 0 : len, phase: motion ? 'typing' : 'still', x: landed(s), to: null,
    flip: false, act: null,
  };
}

// The hub redrew with these lines. The line he is on is kept wherever it now is in the list, and new words for
// it are swapped in under the typing; only a line that is gone sends him back to the first.
export function onLines(s, lines, motion) {
  const { i, fresh } = keepLine(lines, s.key);
  if (fresh) return show(s, lines, i, motion);
  const len = lengthOf(lines[i]);
  if (!motion) return { ...s, i, len, typed: len, phase: 'still', x: landed(s), to: null, flip: false, act: null };
  return { ...s, i, len, typed: carryTyped(s.typed, s.phase !== 'typing', len) };
}

// A press on the bubble or the dog: the next line, the first after the last. With one line there is no next.
export function onPress(s, lines, motion) {
  return lines.length > 1 ? show(s, lines, (s.i + 1) % lines.length, motion) : s;
}

let el = null;      // the stage: made on the first call, the same node ever after
let say; let on; let off; let tail; let strip; let dog; let pic; let layer; let ball; let knot; let line; let hang; let short;
let lines = [];
let only = null;    // a fidget to make every beat (the checks' hook)
let activity = null; // an activity to play every time (the checks' hook)
let played = null;  // the last activity, so the next is another
let aim = null;     // the pointer's offset from his left edge: the head of the frame showing, fixed for a trip
let s = START;
let timer = null;   // the one timer
let t0 = 0;         // when the line would have started typing, to have got as far as it has
let shown = null;   // the frame he is showing
let playing = null; // the plaything out: 'ball', 'toy', 'rope-long' or 'rope-short' (on the strip or in his mouth)
let holding = null; // the same while it is in his mouth (inside his sprite, so it flips and lifts with him)
let heldFrame = 'ball-air';
let wide = null;    // the strip's width when last measured

const mood = () => lines[s.i].mood;
const after = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
const stop = () => { clearTimeout(timer); timer = null; };
const part = (p) => (p.tone ? h('b', { class: p.tone }, p.text) : p.text);
const room = () => Math.max(0, strip.clientWidth - CELL);

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
  // The ball plays in a layer of its own that clips at the strip's ends, so it can roll in and out of sight.
  ball = sprite('props');
  ball.classList.add('zs-ball');
  // The rope: a knot, the long line that runs off the strip, and the short rope (hung from a point in his mouth).
  knot = sprite('props');
  knot.classList.add('zs-ball');
  line = sprite('rope');
  line.classList.add('zs-line');
  short = sprite('ropes');
  short.classList.add('zs-ball');
  hang = h('span', { class: 'zs-hang' });
  layer = h('span', { class: 'zs-props' });
  strip = h('div', { class: 'zs-strip', 'aria-hidden': 'true' }, layer, dog);
  el = h('div', { id: 'ziggyStage', class: 'zs' }, say, tail, strip);
  // The strip is measured when it is first laid out, and again whenever its width changes.
  new ResizeObserver(fit).observe(strip);
  document.addEventListener('visibilitychange', seen);
}

// Everything the state decides, written to the page. The frame is not: whatever is moving him sets that.
function draw() {
  const line = lines[s.i];
  Object.assign(el.dataset, { mood: line.mood, state: s.phase, line: s.key, typed: s.typed, activity: s.act || '', prop: holding ? 'held' : playing || '' });
  const { on: shown, off: hid } = splitParts(line.parts, s.typed);
  on.replaceChildren(...shown.map(part));
  off.replaceChildren(...hid.map(part));
  if (s.x === null) return;
  // The pointer is placed by the same number as the dog, in the same frame, so it is over him the whole way.
  const x = s.phase === 'wander' ? s.to : s.x;
  dog.style.left = `${x}px`;
  tail.style.left = `${x + (aim ?? headAt(line.mood, s.flip))}px`;
}

// Every frame he shows goes through here. Outside a trip the pointer follows his head at once; on a trip its
// offset was fixed when the trip began, so its slide is never started again.
// up: px more off the ground than the frame's own lift (a pounce's arc).
function frame(name, up = 0) {
  shown = name;
  setFrame(pic, 'hub', name);
  const lift = liftOf(name) + up;
  pic.style.transform = [s.flip ? 'scaleX(-1)' : '', lift ? `translateY(-${lift}px)` : ''].filter(Boolean).join(' ');
  if (holding) mouthProp(name);
  if (s.phase === 'wander') return;
  aim = headAt(name, s.flip);
  if (s.x !== null) tail.style.left = `${s.x + aim}px`;
}

const hold = () => frame(mood());

// The plaything in his mouth: placed in his cell, so his flip and lift carry it. The ball and the toy by their
// middle at FRAME_MOUTH; the rope by its knot at FRAME_KNOT (the long rope's line is on the strip: placeLine).
function mouthProp(name) {
  if (holding === 'rope-long') {
    const [kx, ky] = FRAME_KNOT[name] ?? FRAME_KNOT['happy-tug1'];
    Object.assign(knot.style, { left: `${kx - KNOT_AT[0]}px`, top: `${ky - KNOT_AT[1]}px`, bottom: 'auto' });
    placeLine(name);
    return;
  }
  if (holding === 'rope-short') {
    const [kx, ky] = FRAME_KNOT[name] ?? FRAME_KNOT['happy-carry'];
    Object.assign(hang.style, { left: `${kx}px`, top: `${ky}px` });
    return;
  }
  const [mx, my] = FRAME_MOUTH[name] ?? FRAME_MOUTH['happy-carry'];
  const [cx, cy] = PROP_MID[heldFrame];
  Object.assign(ball.style, { left: `${mx - cx}px`, top: `${my - cy}px`, bottom: 'auto' });
  setFrame(ball, 'props', heldFrame);
}

// The long rope's line runs from the knot in his mouth past the end of the strip he faces. It lies in the props
// layer (which clips at the strip's ends), placed by the same left as he is, so on a trip it slides with him.
function placeLine(name, x = s.phase === 'wander' ? s.to : s.x) {
  const [kx, ky] = FRAME_KNOT[name] ?? FRAME_KNOT['happy-tug1'];
  const knotX = x + (s.flip ? CELL - 1 - kx : kx);
  const up = SHEETS.hub.cell[1] - 1 - ky + liftOf(name);
  Object.assign(line.style, { left: `${s.flip ? knotX - LINE_W + 1 : knotX}px`, bottom: `${up - 2}px` });
}

// Where a prop frame's cell goes for its anchor to be at x, h px above the ground.
function anchored({ x, h: up, frame: f }) {
  const sheet = f.startsWith('short') ? 'ropes' : 'props';
  const [ax, ay] = anchorOf(f);
  const { x: fx, y: fy, h: ch } = framePos(sheet, f);
  return { left: `${x - ax}px`, bottom: `${up - (ch - 1 - ay)}px`, backgroundPosition: `${-fx}px ${-fy}px` };
}

// One animation along a prop path, ending where the path does (the place is also written to its style, so it stays
// there once the animation is over).
// dx, dy: px added to every place (the long rope's line, from its knot), keeping its own picture when bg is false.
function along(node, path, { dx = 0, dy = 0, bg = true } = {}) {
  const ms = Math.max(1, path.at(-1).t);
  const at = (pt) => {
    const { backgroundPosition, ...a } = anchored(pt);
    return { left: `${parseFloat(a.left) + dx}px`, bottom: `${parseFloat(a.bottom) + dy}px`, ...(bg ? { backgroundPosition } : {}) };
  };
  Object.assign(node.style, { top: 'auto', ...at(path.at(-1)) });
  if (path.length > 1) node.animate(path.map((pt) => ({ ...at(pt), offset: pt.t / ms, easing: 'steps(1, end)' })), { duration: ms });
}

// What the plaything does from the start of a step: into his mouth, or along a path on the strip.
function prop(p) {
  for (const n of [ball, knot, line, hang, short]) for (const a of n.getAnimations()) a.cancel();
  const kind = p.rope ? `rope-${p.rope}` : p.frame ? 'toy' : 'ball';
  if (kind !== 'ball' && kind !== 'toy') ball.remove();
  if (kind !== 'rope-long') { line.remove(); knot.remove(); }
  if (kind !== 'rope-short') { hang.remove(); short.remove(); }
  playing = kind;
  if (p.held) {
    holding = kind;
    heldFrame = p.frame ?? 'ball-air';
    if (kind === 'rope-long') { pic.append(knot); layer.append(line); setFrame(knot, 'props', 'knot'); }
    else if (kind === 'rope-short') { hang.append(short); pic.append(hang); swingRope(p.swing ?? [[90, 1]]); }
    else pic.append(ball);
    mouthProp(shown);
    return;
  }
  holding = null;
  const path = propPath(p);
  if (kind === 'rope-long') {
    // The knot leads and the line trails off the strip behind it, the way he faces.
    layer.append(line, knot);
    setFrame(knot, 'props', 'knot');
    along(knot, path.map((pt) => ({ ...pt, frame: 'knot' })));
    const cellH = SHEETS.props.cell[1];
    along(line, path.map((pt) => ({ ...pt, frame: 'knot' })), { dx: p.faces < 0 ? KNOT_AT[0] - LINE_W + 1 : KNOT_AT[0], dy: cellH - 1 - KNOT_AT[1] - 2, bg: false });
    return;
  }
  const node = kind === 'rope-short' ? short : ball;
  Object.assign(node.style, { transform: '' });
  layer.append(node);
  along(node, path);
}

// The short rope in his mouth turns through its angles, [[deg, ms], ...], as one animation; its back knot stays
// on the point it hangs from.
function swingRope(swing) {
  const at = (deg) => {
    const [dx, dy] = shortFrom(deg);
    const { x: fx, y: fy } = framePos('ropes', shortFrame(deg));
    return { left: `${dx}px`, top: `${dy}px`, bottom: 'auto', backgroundPosition: `${-fx}px ${-fy}px` };
  };
  Object.assign(short.style, at(swing.at(-1)[0]));
  const ms = swing.reduce((n, [, t]) => n + t, 0);
  if (swing.length < 2) { Object.assign(short.style, at(swing[0][0])); return; }
  let t = 0;
  const frames = swing.map(([deg, d]) => { const k = { ...at(deg), offset: t / ms, easing: 'steps(1, end)' }; t += d; return k; });
  short.animate([...frames, { ...at(swing.at(-1)[0]), offset: 1 }], { duration: ms });
}

// The plaything goes: put away mid-play (he is interrupted) or between activities.
function putAway() {
  for (const n of [ball, knot, line, hang, short]) { for (const a of n.getAnimations()) a.cancel(); n.remove(); }
  line.style.transition = '';
  holding = null;
  playing = null;
}

// May he play now? Not while the tab or the hub is out of sight, a line is typing, or motion is reduced.
const may = () => s.x !== null
  && canFidget({ hidden: document.hidden, onScreen: strip.clientWidth > 0, typing: s.phase === 'typing', motion: motionOK() });

// The strip's width is known, or has changed: he starts in the middle, and is never left off its end. When it
// has width again after being out of sight, and nothing is running, he picks up with a fresh activity.
function fit() {
  const was = wide;
  wide = strip.clientWidth;
  if (!wide || !lines.length) return;   // the hub is not the view on screen, or he has just been reset
  const r = room();
  s = { ...s, x: s.x === null ? Math.round(r / 2) : Math.min(s.x, r), to: s.to === null ? null : Math.min(s.to, r) };
  draw();
  // The strip changed width under a plaything in play: its path was planned for the old one, so he starts afresh.
  if (playing && was !== null && was !== wide && timer !== null && s.phase !== 'typing') {
    stop(); land(); next();
    return;
  }
  if (timer === null && motionOK() && !document.hidden && s.phase !== 'typing') { land(); next(); }
}

// He is interrupted (a new line, a press, a reset, Reduce Motion, the tab shown again): nothing slides, he stands
// where a trip would have taken him, and he faces the way he was drawn.
function land() {
  for (const moved of [dog, tail, line]) {
    moved.style.transition = '';
    // Taking the transition away does not stop a slide that is under way; cancelling it does.
    for (const a of moved.getAnimations()) a.cancel();
  }
  pic.style.transform = '';
  aim = null;
  putAway();
  s = { ...s, flip: false, x: landed(s), to: null, phase: s.phase === 'wander' ? 'play' : s.phase };
}

// Reduce Motion: the mood's still, and nothing runs.
function still() {
  stop();
  land();
  s = { ...s, phase: 'still', act: null };
  hold();
  draw();
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
    pose(steps(mood(), 'mood'), next);
    return;
  }
  frame(frameAt(steps(mood(), 'talk'), ms));
  draw();
  after(TICK, type);
}

// The typing carries on from s.typed characters.
const typeOn = () => { t0 = performance.now() - ((s.typed + 0.5) / Math.max(1, s.len)) * TYPE_MS; };

// One run through a list of [frame, ms], then done.
function pose(seq, done) {
  const at = (k) => {
    if (k >= seq.length) { done(); return; }
    frame(seq[k][0]);
    after(seq[k][1], () => at(k + 1));
  };
  at(0);
}

// The next activity, straight after the last. When he may not play (the tab or the hub is out of sight), the
// timer stops and nothing waits: seen(), fit() or the next ziggyStage() starts him again.
function next() {
  if (!may()) {
    if (motionOK()) stop();
    else still();
    return;
  }
  const m = mood();
  const set = ACTIVITIES[m];
  const asked = activity ?? (only === 'wander' ? 'stroll' : null);
  const name = asked !== null && Object.hasOwn(set, asked) ? asked : pickActivity(m, played);
  const beat = FIDGETS[m].includes(only) ? only : null;
  const routine = ROUTINES.includes(only) ? only : null;
  putAway();
  const plan = planActivity(m, name, { x: s.x, room: room(), beat, flip: s.flip, routine });
  played = name;
  s = { ...s, phase: 'play', act: name };
  draw();
  run(plan, 0);
}

// Step k of an activity's plan, then the rest of it, then the next activity.
function run(plan, k) {
  // At its end, or when he may no longer play, next() starts another or stops.
  if (k >= plan.length || !may()) { next(); return; }
  const step = plan[k];
  if (step.flip !== undefined) s = { ...s, flip: step.flip };
  if (step.prop) { prop(step.prop); draw(); }
  if (step.pose) pose(step.pose, () => run(plan, k + 1));
  else travel(step.travel, () => run(plan, k + 1));
}

// He trots to another spot. The dog and the pointer slide by one transition; the timer swaps his legs and ends
// the trip by the clock (a transition's own end is never heard if the view is hidden part-way).
function travel({ to: planned, ms, frames, frameMs, arc = 0, keep = false }, done) {
  const to = Math.round(Math.max(0, Math.min(planned, room())));
  const dx = to - s.x;
  // A trip of nothing: done at once, but a tug's shove (one frame) still takes its time, so the tug keeps its length.
  if (!dx) { if (keep) pose([[frames[0], ms]], done); else done(); return; }
  // keep: he goes without turning round (backing up in a tug).
  const flip = keep ? s.flip : (dx < 0) !== facesLeft(frames[0]);
  s = { ...s, flip, phase: 'wander', to };
  frame(frames[0]);
  // The pointer jumps to his head as it now faces, and only then slides with him.
  aim = headAt(frames[0], flip);
  tail.style.left = `${s.x + aim}px`;
  void tail.offsetWidth;
  const slide = `left ${ms}ms linear`;
  dog.style.transition = slide;
  tail.style.transition = slide;
  // The long rope's line slides with him.
  if (holding === 'rope-long') { placeLine(frames[0], s.x); void line.offsetWidth; line.style.transition = slide; placeLine(frames[0], to); }
  draw();
  const from = performance.now();
  const trot = () => {
    const t = performance.now() - from;
    // Two frames' grace, so the slide has drawn its last step before it is switched off.
    if (t >= ms + GRACE) {
      // Between steps only the slide goes: he keeps facing the way he went.
      dog.style.transition = '';
      tail.style.transition = '';
      line.style.transition = '';
      s = { ...s, phase: 'play', x: s.to, to: null };
      draw();
      done();
      return;
    }
    // A pounce goes up and comes down on the way.
    const k = Math.min(1, t / ms);
    frame(frames[Math.floor(t / frameMs) % frames.length], Math.round(4 * arc * k * (1 - k)));
    after(Math.min(frameMs - (t % frameMs), ms + GRACE - t), trot);
  };
  trot();
}

// A line has just appeared: it types from its first character, or with reduced motion is simply there.
function begin() {
  stop();
  land();
  hold();
  draw();
  if (s.phase !== 'typing') return;
  t0 = performance.now();
  type();
}

function press() {
  const next = onPress(s, lines, motionOK());
  if (next === s) return;
  s = next;
  begin();
}

// The tab was hidden or shown. Hidden: nothing runs. Shown again: a line still typing catches up; anything else
// lands where it was going and picks up with a fresh activity.
function seen() {
  if (document.hidden) { stop(); return; }
  if (!lines.length) return;
  if (!motionOK()) { still(); return; }
  if (s.phase === 'typing') type();
  else { land(); next(); }
}

// The demo was left, or this browser connected or disconnected: he starts again from the first line, in the middle.
export function resetZiggy() {
  if (!el) return;
  stop();
  land();
  s = START;
  lines = [];
  played = null;
  aim = null;
}

// lines: from ziggyLines(), never empty. opts.only: a fidget of the mood's set for every beat. opts.activity: an
// activity of the mood's set to play every time.
export function ziggyStage(newLines, opts) {
  if (!el) build();
  if (!newLines.length) return el;
  const motion = motionOK();
  const was = s;
  lines = newLines;
  only = (opts && opts.only) || null;
  activity = (opts && opts.activity) || null;
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
  else if (!motion) still();
  else {
    if (s.phase === 'typing' && (s.len !== was.len || s.typed !== was.typed)) typeOn();
    draw();
    // Motion came back, or the tab was hidden when he last stopped: activities start again.
    if (timer === null && !document.hidden) { if (s.phase === 'typing') type(); else { land(); next(); } }
  }
  return el;
}
