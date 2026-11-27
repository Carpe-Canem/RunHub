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
