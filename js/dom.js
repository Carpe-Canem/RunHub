// Tiny DOM helpers. Text only: data never goes through innerHTML.
import { ghost } from './core.js';

export const $ = (id) => document.getElementById(id);

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

// Clock digits. Each ":" stays in the text (for copying and screen readers) but is drawn as two square dots.
function ledParts(text) {
  const out = [];
  String(text).split(':').forEach((part, i) => {
    if (i) out.push(h('i', { class: 'cn' }, ':'));
    if (part) out.push(part);
  });
  return out;
}

// led('1:02:33', { ghost: true }) -> <span class="led g"><span class="gh" aria-hidden="true">8:88:88</span>1:02:33</span>
export function led(text, opts) {
  const withGhost = !!(opts && opts.ghost);
  return h('span', { class: withGhost ? 'led g' : 'led' },
    withGhost ? h('span', { class: 'gh', 'aria-hidden': 'true' }, ledParts(ghost(text))) : null,
    ledParts(text));
}
