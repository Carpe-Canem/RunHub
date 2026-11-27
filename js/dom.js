// Tiny DOM helpers. Text only: data never goes through innerHTML.
import { ghost } from './core.js';

export const $ = (id) => document.getElementById(id);

// A message line a screen reader hears every time, a repeat included: it is cleared at once and set again a
// little later. say(null) only clears.
export function announcer(el, later = (fn) => setTimeout(fn, 100), cancel = (id) => clearTimeout(id)) {
  let waiting = null;
  return (msg) => {
    if (waiting !== null) cancel(waiting);
    waiting = null;
    el.textContent = '';
    el.hidden = true;
    if (msg) waiting = later(() => { waiting = null; el.textContent = msg; el.hidden = false; });
  };
}

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function table(head, rows) {
  return h('div', { class: 'tablewrap' }, h('table', null,
    h('thead', null, h('tr', null, head.map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', null, rows)));
}

// Clock digits. Each ":" stays in the text (for copying and screen readers) but is drawn as two square dots;
// a "." is drawn as one, and a "," as a narrow gap (the font's own marks are a full digit wide).
const MARKS = { ':': 'cn', '.': 'pt', ',': 'cm' };
function ledParts(text) {
  return String(text).split(/([:.,])/).filter(Boolean).map((part) => (MARKS[part] ? h('i', { class: MARKS[part] }, part) : part));
}

// led('1:02:33', { ghost: true }) -> <span class="led g"><span class="gh" aria-hidden="true">8:88:88</span>1:02:33</span>
// The all-lit layer is always there: CSS shows it dimly behind a clock that asked for a ghost (class g), and at
// full strength over every clock during the lamp test.
export function led(text, opts) {
  return h('span', { class: opts && opts.ghost ? 'led g' : 'led' },
    h('span', { class: 'gh', 'aria-hidden': 'true' }, ledParts(ghost(text))),
    ledParts(text));
}

// The one gate for motion started from script. CSS animations are stilled by the stylesheet's own rule.
export const motionOK = () => typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
