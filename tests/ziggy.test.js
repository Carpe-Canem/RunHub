import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS } from '../js/ziggy-frames.js';
import { poseFrames } from '../js/ziggy.js';

test('every pose maps to side frames that exist', () => {
  assert.deepEqual(poseFrames('trot'), ['trot1', 'trot2']);
  assert.deepEqual(poseFrames('sit'), ['sit']);
  assert.deepEqual(poseFrames('nap'), ['nap']);
  assert.deepEqual(poseFrames('moonwalk'), ['sit']);
  assert.deepEqual(poseFrames('toString'), ['sit']);
  for (const pose of ['trot', 'sit', 'nap', 'moonwalk']) {
    for (const name of poseFrames(pose)) assert.ok(SHEETS.side.frames.includes(name), `${pose}: ${name}`);
  }
});

test('the trot is two different frames', () => {
  const [a, b, ...rest] = poseFrames('trot');
  assert.deepEqual(rest, []);
  assert.notEqual(a, b);
});

test('every mood has a still, and a talking frame unless it is asleep', () => {
  const { frames } = SHEETS.hub;
  for (const mood of ['happy', 'thrilled', 'eager', 'curious', 'worried']) {
    assert.ok(frames.includes(mood), `${mood} still`);
    assert.ok(frames.includes(`${mood}-talk`), `${mood} talking`);
  }
  assert.ok(frames.includes('asleep'));
  assert.ok(frames.includes('asleep-breathe'));
  assert.ok(!frames.includes('asleep-talk'));
});
