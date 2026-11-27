import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, parseHash, routeHref } from '../js/router.js';

const P1 = ['hub', 'data'];
test('known views', () => {
  assert.deepEqual(parseHash('#races', VIEWS), { view: 'races', id: null });
  assert.deepEqual(parseHash('#data', P1), { view: 'data', id: null });
  assert.deepEqual(parseHash('#race/d12', VIEWS), { view: 'race', id: 'd12' });
});
test('everything else is the hub', () => {
  for (const x of ['', '#', '#hub', '#nonsense', '#DATA', '#data/5', '#race', '#race/', '#race/a/b', '#race/<x>', '#races', '#race/12'])
    assert.deepEqual(parseHash(x, P1), { view: 'hub', id: null }, x);
  assert.deepEqual(parseHash('#legends', VIEWS), { view: 'hub', id: null });   // a page that was removed: old links land on the hub
  assert.deepEqual(parseHash('#race', VIEWS), { view: 'hub', id: null });   // a race needs an id
});
test('routeHref round-trips', () => {
  assert.equal(routeHref('hub'), '#hub'); assert.equal(routeHref('race', 'd12'), '#race/d12');
  assert.deepEqual(parseHash(routeHref('race', 'd12'), VIEWS), { view: 'race', id: 'd12' });
});
