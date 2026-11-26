import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store, dayOf, plural, bus, ghost } from '../js/core.js';

test('dayOf reads the local date and ignores the Z', () => {
  assert.equal(dayOf('2026-03-01T23:30:00Z'), Date.UTC(2026, 2, 1) / 864e5);
  assert.ok(Number.isNaN(dayOf('')));
});
test('plural', () => { assert.equal(plural(1, 'run'), '1 run'); assert.equal(plural(2, 'run'), '2 runs'); });
test('store survives missing or throwing storage', () => {
  delete globalThis.localStorage;
  assert.equal(store.get('x'), null); assert.equal(store.set('x', 1), false);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() {} };
  assert.equal(store.get('x'), null); assert.equal(store.set('x', 1), false);
  delete globalThis.localStorage;
});
test('bus delivers to every listener', () => {
  let n = 0; bus.on('status', () => n++); bus.on('status', () => n++); bus.emit('status');
  assert.equal(n, 2);
});
test('ghost turns every digit into 8 and keeps the rest', () => {
  assert.equal(ghost('1:02:33'), '8:88:88'); assert.equal(ghost('07'), '88'); assert.equal(ghost('--'), '--');
});
