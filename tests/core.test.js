import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store, dayOf, plural, bus, ghost, units, setUnits } from '../js/core.js';

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

test("units() is 'mi' by default and for junk, 'km' after setUnits('km')", () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    assert.equal(units(), 'mi');
    mem['lw.units'] = JSON.stringify('furlongs'); assert.equal(units(), 'mi');
    assert.equal(setUnits('km'), true); assert.equal(units(), 'km');
    assert.equal(setUnits('mi'), true); assert.equal(units(), 'mi');
  } finally { delete globalThis.localStorage; }
});
test("setUnits('yards') returns false and leaves 'mi'", () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    assert.equal(setUnits('yards'), false); assert.equal(units(), 'mi'); assert.equal(mem['lw.units'], undefined);
  } finally { delete globalThis.localStorage; }
});
test('bus.emit keeps going when a listener throws, and never throws itself', () => {
  const was = console.error; const logged = []; console.error = (...a) => logged.push(a);
  try {
    let after = 0;
    bus.on('boom', () => { throw new Error('view broke'); });
    bus.on('boom', () => after++);
    assert.doesNotThrow(() => bus.emit('boom'));
    assert.equal(after, 1);
    assert.equal(logged.length, 1);
  } finally { console.error = was; }
});
