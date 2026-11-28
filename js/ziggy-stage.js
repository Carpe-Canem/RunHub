// Ziggy's stage at the foot of the hub: the bubble he speaks from, the strip he walks on, and the one timer that
// drives him. The rules (which line, how much is typed, where he stands) are pure functions of a small state; the
// rest of this file turns that state into nodes. Nothing here is stored: a reload starts from the first line.
import { h, motionOK } from './dom.js';
import { SHEETS, BALL_CENTRE, FRAME_MOUTH, framePos, headAt, facesLeft, liftOf } from './ziggy-frames.js';
import { sprite, setFrame } from './ziggy.js';
import {
  TYPE_MS, FIDGETS, steps, typedCount, carryTyped, splitParts, lengthOf, keepLine, canFidget,
} from './ziggy-moves.js';
import { ACTIVITIES, BALL_ROUTINES, pickActivity, planActivity, propPath } from './ziggy-play.js';

const CELL = SHEETS.hub.cell[0];   // his width on the strip
const TICK = 40;                   // ms between looks at the clock while a line types
const GRACE = 34;                  // ms a trip is given past its slide

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
let say; let on; let off; let tail; let strip; let dog; let pic; let layer; let ball;
let lines = [];
let only = null;    // a fidget to make every beat (the checks' hook)
let activity = null; // an activity to play every time (the checks' hook)
let played = null;  // the last activity, so the next is another
let aim = null;     // the pointer's offset from his left edge: the head of the frame showing, fixed for a trip
let s = START;
let timer = null;   // the one timer
let t0 = 0;         // when the line would have started typing, to have got as far as it has
let shown = null;   // the frame he is showing
let held = false;   // the ball is in his mouth (inside his sprite, so it flips and lifts with him)
let loose = false;  // the ball is on the strip, rolling, flying or lying there
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
  Object.assign(el.dataset, { mood: line.mood, state: s.phase, line: s.key, typed: s.typed, activity: s.act || '', prop: held ? 'held' : loose ? 'ball' : '' });
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
  if (held) mouthBall(name);
  if (s.phase === 'wander') return;
  aim = headAt(name, s.flip);
  if (s.x !== null) tail.style.left = `${s.x + aim}px`;
}

const hold = () => frame(mood());

// The ball in his mouth: placed in his cell, so his flip and lift carry it.
function mouthBall(name) {
  const [mx, my] = FRAME_MOUTH[name] ?? FRAME_MOUTH['happy-carry'];
  Object.assign(ball.style, { left: `${mx - BALL_CENTRE[0]}px`, top: `${my - BALL_CENTRE[1]}px`, bottom: 'auto' });
  setFrame(ball, 'props', 'ball-air');
}

// What the ball does from the start of a step: into his mouth, or along a path on the strip as one animation that
// ends where the path does (the place is also written to its style, so it stays there once the animation is over).
function prop(p) {
  for (const a of ball.getAnimations()) a.cancel();
  if (p.held) {
    held = true; loose = false;
    pic.append(ball);
    mouthBall(shown);
    return;
  }
  held = false; loose = true;
  layer.append(ball);
  const path = propPath(p);
  const ms = path.at(-1).t;
  const at = ({ x, h: up, frame: f }) => {
    const { x: fx, y: fy } = framePos('props', f);
    return { left: `${x - BALL_CENTRE[0]}px`, bottom: `${up}px`, backgroundPosition: `${-fx}px ${-fy}px` };
  };
  Object.assign(ball.style, { top: 'auto', ...at(path.at(-1)) });
  ball.animate(path.map((pt) => ({ ...at(pt), offset: pt.t / ms, easing: 'steps(1, end)' })), { duration: ms });
}

// The ball goes: put away mid-play (he is interrupted) or between activities.
function putAway() {
  for (const a of ball.getAnimations()) a.cancel();
  ball.remove();
  held = false;
  loose = false;
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
  // The strip changed width under a ball in play: its path was planned for the old one, so he starts afresh.
  if ((loose || held) && was !== null && was !== wide && timer !== null && s.phase !== 'typing') {
    stop(); land(); next();
    return;
  }
  if (timer === null && motionOK() && !document.hidden && s.phase !== 'typing') { land(); next(); }
}

// He is interrupted (a new line, a press, a reset, Reduce Motion, the tab shown again): nothing slides, he stands
// where a trip would have taken him, and he faces the way he was drawn.
function land() {
  for (const moved of [dog, tail]) {
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
  const routine = BALL_ROUTINES.includes(only) ? only : null;
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
function travel({ to: planned, ms, frames, frameMs, arc = 0 }, done) {
  const to = Math.round(Math.min(planned, room()));
  const dx = to - s.x;
  if (!dx) { done(); return; }
  const flip = (dx < 0) !== facesLeft(frames[0]);
  s = { ...s, flip, phase: 'wander', to };
  frame(frames[0]);
  // The pointer jumps to his head as it now faces, and only then slides with him.
  aim = headAt(frames[0], flip);
  tail.style.left = `${s.x + aim}px`;
  void tail.offsetWidth;
  const slide = `left ${ms}ms linear`;
  dog.style.transition = slide;
  tail.style.transition = slide;
  draw();
  const from = performance.now();
  const trot = () => {
    const t = performance.now() - from;
    // Two frames' grace, so the slide has drawn its last step before it is switched off.
    if (t >= ms + GRACE) {
      // Between steps only the slide goes: he keeps facing the way he went.
      dog.style.transition = '';
      tail.style.transition = '';
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
