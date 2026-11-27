import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusOf, statusRow } from '../js/status.js';

const NOW = new Date(2026, 10, 27, 12, 0, 0).getTime();   // local noon, so "the same day" holds in any time zone
const base = { demo: false, connected: true, syncing: false, progress: null, error: null, pausedUntil: 0, lastSync: NOW - 3 * 60e3, warn: null, now: NOW };
const clock = (t) => `at ${new Date(t).getHours()}:${String(new Date(t).getMinutes()).padStart(2, '0')}`;
const st = (over) => statusOf({ ...base, ...over }, (t) => clock(t).slice(3), (t) => `Nov ${new Date(t).getDate()}`);

test('status: idle shows how long ago on screen and a clock time to screen readers', () => {
  assert.deepEqual(st(), { state: 'idle', text: 'Synced 3 min ago', live: 'Synced at 11:57' });
});

test('status: the screen-reader text does not change as the minutes pass', () => {
  assert.equal(st({ now: NOW + 5 * 60e3 }).live, st().live);
  assert.notEqual(st({ now: NOW + 5 * 60e3 }).text, st().text);
});

test('status: never synced, and a storage warning', () => {
  assert.deepEqual(st({ lastSync: 0 }), { state: 'idle', text: 'Not synced yet', live: 'Not synced yet' });
  assert.equal(st({ warn: 'Storage is full' }).text, 'Synced 3 min ago. Storage is full');
  assert.equal(st({ warn: 'Storage is full' }).live, 'Synced at 11:57. Storage is full');
});

test('status: a sync shows its progress; screen readers hear the step, not every count', () => {
  assert.deepEqual(st({ syncing: true, progress: { label: 'Races', done: 3, total: 40 } }), { state: 'sync', text: 'Races: 3 of 40', live: 'Races…' });
  assert.deepEqual(st({ syncing: true, progress: { label: 'Checking for new runs' } }), { state: 'sync', text: 'Checking for new runs…', live: 'Checking for new runs…' });
});

test('status: an error, a rate-limit pause, the demo and not connected', () => {
  assert.deepEqual(st({ error: 'Strava could not be reached.' }), { state: 'error', text: 'Strava could not be reached.', live: 'Strava could not be reached.' });
  const paused = st({ pausedUntil: NOW + 60e3 });
  assert.equal(paused.state, 'paused');
  assert.equal(paused.text, "Paused for Strava's rate limit. Resumes at 12:01 if this page is open.");
  assert.equal(paused.live, paused.text);
  assert.deepEqual(st({ demo: true, connected: false }), { state: 'demo', text: 'Demo', live: 'Demo' });
  assert.deepEqual(st({ connected: false }), { state: 'off', text: '', live: '' });
});

test('status: a sync in progress outranks an old error; an error outranks a pause', () => {
  assert.equal(st({ syncing: true, progress: { label: 'Races' }, error: 'Old' }).state, 'sync');
  assert.equal(st({ error: 'Down', pausedUntil: NOW + 60e3 }).state, 'error');
});

test('status: a sync from an earlier day is announced with its date, not only a time', () => {
  assert.equal(st({ lastSync: NOW - 26 * 3600e3 }).live, 'Synced Nov 26 at 10:00');
  assert.equal(st({ lastSync: NOW - 13 * 3600e3 }).live, 'Synced Nov 26 at 23:00');
  assert.equal(st({ lastSync: NOW - 11 * 3600e3 }).live, 'Synced at 1:00');
});

const rowOf = (over) => statusRow({ ...base, ...over }, st(over));
const row = (over) => ({ text: '', dot: null, arrow: false, press: false, note: null, tone: null, ...over });
const synced = row({ text: 'Synced 3 min ago', dot: 'ok', arrow: true, press: true });

test('row: the demo is a plain word', () => {
  assert.deepEqual(rowOf({ demo: true, connected: false }), row({ text: 'Demo' }));
});

test('row: a sync with a total shows its count', () => {
  assert.deepEqual(rowOf({ syncing: true, progress: { label: 'Reading race details', done: 3, total: 40 } }), row({ text: 'Races: 3 of 40' }));
  assert.deepEqual(rowOf({ syncing: true, progress: { label: 'Races', done: 3, total: 40 } }), row({ text: 'Races: 3 of 40' }));
});

test('row: a sync with no total shows a short label; the announced text keeps the full one', () => {
  const short = { 'Checking for new runs': 'Checking', 'Loading your runs': 'Loading runs', 'Scanning your race history': 'Scanning races', 'Reading race details': 'Races', 'Something else': 'Something else' };
  for (const [label, text] of Object.entries(short)) {
    const over = { syncing: true, progress: { label, done: 0, total: 0 } };
    assert.deepEqual(rowOf(over), row({ text: `${text}…` }));
    assert.equal(st(over).live, `${label}…`);
  }
});

test('row: an error offers Retry, with the sentence on the note', () => {
  assert.deepEqual(rowOf({ error: 'Strava could not be reached.' }), row({ text: 'Retry', dot: 'bad', arrow: true, press: true, note: 'Strava could not be reached.', tone: 'bad' }));
});

test('row: a rate-limit pause cannot be pressed', () => {
  assert.deepEqual(rowOf({ pausedUntil: NOW + 60e3 }), row({ text: 'Paused', dot: 'warn', note: "Paused for Strava's rate limit. Resumes at 12:01 if this page is open.", tone: 'warn' }));
});

test('row: never synced', () => {
  assert.deepEqual(rowOf({ lastSync: 0 }), row({ text: 'Not synced yet', arrow: true, press: true }));
  assert.deepEqual(rowOf({ lastSync: 0, warn: 'Storage is full' }), row({ text: 'Not synced yet', arrow: true, press: true, note: 'Storage is full', tone: 'warn' }));
});

test('row: synced', () => {
  assert.deepEqual(rowOf(), synced);
});

test('row: a storage warning goes to the note, not the button', () => {
  const over = { warn: 'Storage is full' };
  assert.deepEqual(rowOf(over), { ...synced, note: 'Storage is full', tone: 'warn' });
  assert.match(statusOf({ ...base, ...over }).live, /\. Storage is full$/);
});

test('row: a sync outranks an old error, an error outranks a pause', () => {
  assert.equal(rowOf({ syncing: true, progress: { label: 'Reading race details' }, error: 'Old' }).text, 'Races…');
  assert.equal(rowOf({ error: 'Down', pausedUntil: NOW + 60e3 }).text, 'Retry');
});

test('row: not connected, no row', () => {
  assert.equal(rowOf({ connected: false }), null);
});

test('row: works out the status itself when it is not given', () => {
  assert.deepEqual(statusRow(base), synced);
});

test("sync's own error names the button as the row shows it", () => {
  const sync = readFileSync(new URL('../js/sync.js', import.meta.url), 'utf8');
  const said = /UserError \? e\.message : '([^']*)'/.exec(sync)[1];
  assert.ok(said.includes(statusRow(base, { state: 'error', text: said }).text), said);
});
