import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusOf, tickerText, tickerPose, SEP } from '../js/ticker.js';

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const base = { demo: false, connected: true, syncing: false, progress: null, error: null, pausedUntil: 0, lastSync: NOW - 3 * 60e3, warn: null, now: NOW };
const clock = (t) => `at ${new Date(t).getUTCHours()}:${String(new Date(t).getUTCMinutes()).padStart(2, '0')}`;
const st = (over) => statusOf({ ...base, ...over }, (t) => clock(t).slice(3));

test('status: idle shows how long ago in the strip and a clock time to screen readers', () => {
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

test('ticker: idle joins the sync age, the next start and the week with a square', () => {
  const text = tickerText({ status: st(), next: { name: 'Harbor 10K', when: 'In 14 days' }, mi: { week: 18.24, unit: 'mi' } });
  assert.equal(text, `Synced 3 min ago${SEP}Next start: Harbor 10K, in 14 days${SEP}18.2 miles this week`);
  assert.equal(SEP, ' ■ ');
});

test('ticker: idle with nothing coming up or no runs yet leaves those parts out', () => {
  assert.equal(tickerText({ status: st(), next: null, mi: null }), 'Synced 3 min ago');
  assert.equal(tickerText({ status: st(), next: null, mi: { week: 0, unit: 'km' } }), `Synced 3 min ago${SEP}0.0 km this week`);
  assert.equal(tickerText({ status: st({ demo: true }), next: { name: 'Harbor 10K', when: 'Today' }, mi: null }), `Demo${SEP}Next start: Harbor 10K, today`);
});

test('ticker: during a sync, an error or a pause, that text alone', () => {
  const extra = { next: { name: 'Harbor 10K', when: 'Tomorrow' }, mi: { week: 5, unit: 'mi' } };
  assert.equal(tickerText({ status: st({ syncing: true, progress: { label: 'Races', done: 3, total: 40 } }), ...extra }), 'Races: 3 of 40');
  assert.equal(tickerText({ status: st({ error: 'Strava could not be reached.' }), ...extra }), 'Strava could not be reached.');
  assert.match(tickerText({ status: st({ pausedUntil: NOW + 60e3 }), ...extra }), /^Paused for Strava's rate limit/);
});

test('pose: trots while syncing, sits when synced, naps when paused, offline or after an error', () => {
  assert.equal(tickerPose('sync'), 'trot');
  assert.equal(tickerPose('idle'), 'sit');
  assert.equal(tickerPose('demo'), 'sit');
  for (const s of ['paused', 'offline', 'error']) assert.equal(tickerPose(s), 'nap');
});

test('strip: scrolls only when the text is wider than the strip, motion is allowed and nobody stopped it', async () => {
  const { stripMode } = await import('../js/ticker.js');
  const ok = { wide: true, alert: false, still: false, motion: true };
  assert.deepEqual(stripMode(ok), { scroll: true, control: true });
  assert.deepEqual(stripMode({ ...ok, wide: false }), { scroll: false, control: false });
  assert.deepEqual(stripMode({ ...ok, motion: false }), { scroll: false, control: false });
});

test('strip: an error or a pause never scrolls and offers no control', async () => {
  const { stripMode } = await import('../js/ticker.js');
  assert.deepEqual(stripMode({ wide: true, alert: true, still: false, motion: true }), { scroll: false, control: false });
});

test('strip: once stopped by the user it stays still, and the control stays so it can be started again', async () => {
  const { stripMode } = await import('../js/ticker.js');
  assert.deepEqual(stripMode({ wide: true, alert: false, still: true, motion: true }), { scroll: false, control: true });
});
