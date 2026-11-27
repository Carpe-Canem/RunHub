import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, UserError, RateLimited, DAY } from '../js/core.js';
import { emptyUp, loadUp, saveUp, readBio, syncBio, addHand, removeHand, importHand, upcomingRows, NOT_SAVED } from '../js/upcoming-sync.js';

let mem, failSet;
const saved = (k) => JSON.parse(mem[k] || 'null');
const KEY = 'lw.upcoming.42';
const T = Date.parse('2027-06-01T12:00:00Z');
beforeEach(() => {
  mem = {}; failSet = false;
  globalThis.localStorage = {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { if (failSet) throw new Error('full'); mem[k] = v; },
    removeItem: (k) => { delete mem[k]; },
  };
  Object.assign(S, { athleteId: 42, demo: false, warn: null, upcoming: emptyUp() });
});
afterEach(() => { delete globalThis.localStorage; Object.assign(S, { athleteId: null, demo: false, warn: null, upcoming: null }); });

const HAND = { n: 'Orchard 10K', date: '2027-07-04', time: '08:00', cls: '10K', place: 'Orchard, CO' };

test('loadUp falls back to empty for a missing or malformed entry, drops finished hand races, and saveUp round-trips', () => {
  assert.deepEqual(loadUp(42, '2027-06-01'), { v: 1, hand: [], bio: null });
  mem[KEY] = 'not json';
  assert.deepEqual(loadUp(42, '2027-06-01'), emptyUp());
  mem[KEY] = JSON.stringify({ v: 2, hand: [] });
  assert.deepEqual(loadUp(42, '2027-06-01'), emptyUp());
  mem[KEY] = JSON.stringify({ v: 1, hand: 'x' });
  assert.deepEqual(loadUp(42, '2027-06-01'), emptyUp());
  mem[KEY] = JSON.stringify({ v: 1, hand: [{ id: 'a', n: 'Old', date: '2027-05-31' }, { id: 'b', n: 'Today', date: '2027-06-01' }], bio: null });
  assert.deepEqual(loadUp(42, '2027-06-01').hand.map((r) => r.id), ['b']);
  S.upcoming = { v: 1, hand: [{ id: 'z', ...HAND, at: T }], bio: { at: T, races: [], bad: 0 } };
  assert.equal(saveUp(), true);
  assert.deepEqual(loadUp(42, '2027-06-01'), S.upcoming);
});

test('readBio stores the parsed races and the bad-line count, never the bio text', () => {
  readBio({ bio: 'Upcoming Races\n06/14/2027 Riverbend 5k\n13/01/2027 Canyon 10K' }, T);
  assert.deepEqual(S.upcoming.bio, { at: T, races: [{ date: '2027-06-14', n: 'Riverbend 5k' }], bad: 1 });
  assert.ok(!mem[KEY].includes('Upcoming Races'));
  readBio({ bio: 'Just a bio' }, T + 1);
  assert.deepEqual(S.upcoming.bio.races, []);
  assert.deepEqual(saved(KEY).bio.races, []);
});

test('readBio marks a missing bio field', () => {
  readBio({}, T);
  assert.deepEqual(S.upcoming.bio, { at: T, races: [], bad: 0, none: true });
  S.upcoming.bio = null;
  readBio(null, T);
  assert.deepEqual(S.upcoming.bio, { at: T, races: [], bad: 0, none: true });
});

test('readBio sets the storage-full warning when the save fails', () => {
  failSet = true;
  readBio({ bio: '06/14/2027 Riverbend 5k' }, T);
  assert.match(S.warn, /storage is full/);
  assert.equal(S.upcoming.bio.races.length, 1);
});

function fakeCall(result, err) {
  const calls = [];
  return { calls, call: async (p) => { calls.push(p); if (err) throw err; return result; } };
}

test('syncBio asks once a day, and again on Refresh now', async () => {
  const bio = (age) => ({ at: T - age, races: [{ date: '2027-06-14', n: 'Riverbend 5k' }], bad: 0 });
  let f = fakeCall({ bio: '' });
  S.upcoming.bio = bio(2 * 3600e3);
  await syncBio(false, f.call, T);
  assert.equal(f.calls.length, 0);
  S.upcoming.bio = bio(25 * 3600e3);
  await syncBio(false, f.call, T);
  assert.deepEqual(f.calls, ['/athlete']);
  f = fakeCall({ bio: '' });
  S.upcoming.bio = bio(2 * 3600e3);
  await syncBio(true, f.call, T);
  assert.equal(f.calls.length, 1);
  f = fakeCall({ bio: '' });
  S.upcoming = null;
  await syncBio(true, f.call, T);
  S.upcoming = emptyUp(); S.demo = true;
  await syncBio(true, f.call, T);
  assert.equal(f.calls.length, 0);
});

test('syncBio asks when no bio has been read yet', async () => {
  const f = fakeCall({ bio: '06/14/2027 Riverbend 5k' });
  await syncBio(false, f.call, T);
  assert.equal(f.calls.length, 1);
  assert.equal(S.upcoming.bio.races.length, 1);
});

test('syncBio keeps the stored bio races when the request fails, and lets a rate limit through', async () => {
  const bio = { at: T - 2 * DAY, races: [{ date: '2027-06-14', n: 'Riverbend 5k' }], bad: 0 };
  S.upcoming.bio = bio;
  const warn = console.warn; console.warn = () => {};
  try {
    await syncBio(false, fakeCall(null, new UserError('x')).call, T);
    assert.deepEqual(S.upcoming.bio, bio);
  } finally { console.warn = warn; }
  await assert.rejects(syncBio(false, fakeCall(null, new RateLimited(T + 1e3)).call, T), RateLimited);
  assert.deepEqual(S.upcoming.bio, bio);
});

test('addHand stores the race with an id and the time it was added', () => {
  const r = addHand(HAND, T);
  assert.match(r.id, /^h[0-9a-z]+$/);
  assert.ok(r.id.startsWith('h' + T.toString(36)) && r.id.length === 1 + T.toString(36).length + 4);
  assert.equal(r.at, T);
  assert.equal(r.n, 'Orchard 10K');
  assert.deepEqual(saved(KEY).hand, [r]);
  assert.deepEqual(S.upcoming.hand, [r]);
});

test('removeHand takes it out and saves', () => {
  const r = addHand(HAND, T);
  assert.equal(removeHand(r.id), true);
  assert.deepEqual(S.upcoming.hand, []);
  assert.deepEqual(saved(KEY).hand, []);
});

test('a failed save undoes addHand and removeHand', () => {
  const r = addHand(HAND, T);
  failSet = true;
  assert.equal(addHand({ ...HAND, n: 'Canyon 10K' }, T + 5), null);
  assert.deepEqual(S.upcoming.hand, [r]);
  assert.equal(removeHand(r.id), false);
  assert.deepEqual(S.upcoming.hand, [r]);
  assert.equal(S.warn, null);
  assert.match(NOT_SAVED, /couldn't save the race/);
});

test('in the demo, adding and removing change memory only', () => {
  S.demo = true;
  const r = addHand(HAND, T);
  assert.ok(r);
  assert.deepEqual(S.upcoming.hand, [r]);
  assert.equal(removeHand(r.id), true);
  assert.deepEqual(S.upcoming.hand, []);
  assert.equal(Object.keys(mem).filter((k) => k.startsWith('lw.upcoming')).length, 0);
});

test('upcomingRows merges hand and bio races, and is empty while the store is not loaded', () => {
  S.upcoming = null;
  assert.deepEqual(upcomingRows('2027-06-01'), []);
  S.upcoming = { v: 1, hand: [{ id: 'h1', ...HAND, at: T }], bio: { at: T, races: [{ date: '2027-06-14', n: 'Riverbend 5k' }], bad: 0 } };
  assert.deepEqual(upcomingRows('2027-06-01').map((r) => r.src), ['bio', 'hand']);
});

const FILE = (races) => JSON.stringify({ app: 'Run Hub', kind: 'upcoming', v: 1, races });

test('importHand adds nothing when the save fails', () => {
  const before = S.upcoming.hand;
  failSet = true;
  assert.deepEqual(importHand(FILE([{ n: 'Orchard 10K', date: '2027-07-04' }]), '2027-06-01'), { error: NOT_SAVED });
  assert.equal(S.upcoming.hand, before);
  assert.deepEqual(before, []);
});

test('importHand adds the races, then counts them as already here', () => {
  const text = FILE([{ n: 'Orchard 10K', date: '2027-07-04', time: '08:00', cls: '10K', place: 'Orchard' }, { n: 'Creekside 5K', date: '2027-07-10' }]);
  assert.deepEqual(importHand(text, '2027-06-01'), { added: 2, dup: 0, past: 0, bad: 0 });
  assert.equal(saved(KEY).hand.length, 2);
  assert.ok(S.upcoming.hand.every((r) => r.id && r.at));
  assert.deepEqual(importHand(text, '2027-06-01'), { added: 0, dup: 2, past: 0, bad: 0 });
  assert.deepEqual(importHand('{}', '2027-06-01'), { error: "This isn't a Run Hub races export." });
});

test('importHand accepts a race that is only in the bio', () => {
  S.upcoming.bio = { at: T, races: [{ date: '2027-07-04', n: 'Orchard 10K' }], bad: 0 };
  assert.deepEqual(importHand(FILE([{ n: 'Orchard 10K', date: '2027-07-04', time: '08:00' }]), '2027-06-01'), { added: 1, dup: 0, past: 0, bad: 0 });
  const rows = upcomingRows('2027-06-01');
  assert.equal(rows.length, 1); assert.equal(rows[0].src, 'hand');
});
