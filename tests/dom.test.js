import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announcer } from '../js/dom.js';

// A queue in place of timers, and a plain object in place of the error line.
function rig() {
  const jobs = new Map();
  let next = 0;
  const el = { textContent: '', hidden: true };
  const say = announcer(el, (fn) => { jobs.set(++next, fn); return next; }, (id) => jobs.delete(id));
  const run = () => { for (const [id, fn] of [...jobs]) { jobs.delete(id); fn(); } };
  return { el, say, run, jobs };
}

test('announcer: a repeated message is cleared first and set again later', () => {
  const { el, say, run } = rig();
  say('Enter the race name.');
  run();
  assert.deepEqual({ ...el }, { textContent: 'Enter the race name.', hidden: false });
  say('Enter the race name.');
  assert.deepEqual({ ...el }, { textContent: '', hidden: true });
  run();
  assert.deepEqual({ ...el }, { textContent: 'Enter the race name.', hidden: false });
});

test('announcer: only the latest message is set, and null cancels a waiting one', () => {
  const { el, say, run, jobs } = rig();
  say('First');
  say('Second');
  assert.equal(jobs.size, 1);
  run();
  assert.equal(el.textContent, 'Second');
  say('Third');
  say(null);
  run();
  assert.deepEqual({ ...el }, { textContent: '', hidden: true });
});

// A stand-in for the few DOM calls h() makes, so led() can be checked without a browser.
function fakeDom() {
  class Node {}
  class El extends Node {
    constructor(tag) { super(); this.tag = tag; this.className = ''; this.attrs = {}; this.kids = []; }
    setAttribute(k, v) { this.attrs[k] = v; }
    append(...c) { this.kids.push(...c); }
    get text() { return this.kids.map((k) => (k instanceof El ? k.text : k.data)).join(''); }
  }
  class Text extends Node { constructor(data) { super(); this.data = data; } }
  globalThis.Node = Node;
  globalThis.document = { createElement: (t) => new El(t), createTextNode: (d) => new Text(d) };
  return { El };
}

test('led: the all-lit layer is always there, hidden from screen readers, for the lamp test', async () => {
  const { El } = fakeDom();
  try {
    const { led } = await import('../js/dom.js');
    for (const opts of [undefined, { ghost: true }]) {
      const el = led('1:02:33', opts);
      const gh = el.kids[0];
      assert.ok(gh instanceof El && gh.className === 'gh', 'first child is the ghost layer');
      assert.equal(gh.attrs['aria-hidden'], 'true');
      assert.equal(gh.text, '8:88:88');
      assert.equal(el.text, '8:88:881:02:33');
    }
  } finally { delete globalThis.document; delete globalThis.Node; }
});

test('led: only a clock that asked for it shows the dim ghost at rest', async () => {
  fakeDom();
  try {
    const { led } = await import('../js/dom.js');
    assert.equal(led('22:41').className, 'led');
    assert.equal(led('22:41', { ghost: true }).className, 'led g');
  } finally { delete globalThis.document; delete globalThis.Node; }
});

test('led: a decimal point and a thousands comma stay in the text but are drawn by CSS, like the colon', async () => {
  const { El } = fakeDom();
  try {
    const { led } = await import('../js/dom.js');
    const marks = (el) => el.kids.filter((k) => k instanceof El && k.tag === 'i').map((k) => [k.className, k.text]);
    assert.deepEqual(marks(led('18.2')), [['pt', '.']]);
    assert.deepEqual(marks(led('1,098')), [['cm', ',']]);
    assert.deepEqual(marks(led('1:02:33')), [['cn', ':'], ['cn', ':']]);
    assert.equal(led('1,098.5').text, '8,888.81,098.5');
  } finally { delete globalThis.document; delete globalThis.Node; }
});
