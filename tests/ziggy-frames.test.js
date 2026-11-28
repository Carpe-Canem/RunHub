import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS, HEAD, FRAME_HEAD, FRAME_LIFT, FRAME_MOUTH, FRAME_BALL, FRAME_TOY, FRAME_KNOT, BALL_CENTRE, SHORT_LEN, headAt, liftOf, facesLeft, framePos, sheetSize, sheetUrl, shortFrom, shortFrame } from '../js/ziggy-frames.js';

const MOODS = ['happy', 'thrilled', 'eager', 'curious', 'worried', 'asleep'];

test('every named frame lies inside its sheet', () => {
  for (const [sheet, { cell, frames }] of Object.entries(SHEETS)) {
    const size = sheetSize(sheet);
    for (const name of frames) {
      const { x, y, w, h } = framePos(sheet, name);
      assert.deepEqual([w, h], cell, `${sheet}/${name} is one cell`);
      assert.ok(x >= 0 && y >= 0 && x + w <= size.w && y + h <= size.h, `${sheet}/${name} is inside the sheet`);
    }
  }
});

test('a frame sits at its place in the list, eight to a row on the hub sheet', () => {
  assert.deepEqual(framePos('hub', 'happy'), { x: 0, y: 0, w: 96, h: 88 });
  assert.deepEqual(framePos('hub', 'happy-wag'), { x: 192, y: 0, w: 96, h: 88 });
  assert.deepEqual(framePos('hub', 'happy-tilt'), { x: 0, y: 88, w: 96, h: 88 });
  assert.deepEqual(framePos('side', 'nap'), { x: 144, y: 0, w: 48, h: 40 });
});

test('the hub sheet is 768 × 704 with 58 frames, the side sheet 192 × 40 with four, the props 96 × 32 with nine', () => {
  assert.equal(SHEETS.hub.frames.length, 58);
  assert.deepEqual(sheetSize('hub'), { w: 768, h: 704 });
  assert.equal(SHEETS.props.frames.length, 9);
  assert.deepEqual(sheetSize('props'), { w: 96, h: 32 });
  assert.deepEqual(sheetSize('rope'), { w: 1024, h: 5 });
  assert.deepEqual(sheetSize('ropes'), { w: 288, h: 48 });
  assert.deepEqual(SHEETS.side.frames, ['sit', 'trot1', 'trot2', 'nap']);
  assert.deepEqual(sheetSize('side'), { w: 192, h: 40 });
});

test('every mood has a still and a movement, and a talking frame unless it is asleep', () => {
  const MOVE = { happy: 'wag', thrilled: 'wag', eager: 'trot', curious: 'tilt', worried: 'low', asleep: 'breathe' };
  for (const mood of MOODS) {
    assert.ok(SHEETS.hub.frames.includes(mood), `${mood} has a still`);
    assert.ok(SHEETS.hub.frames.includes(`${mood}-${MOVE[mood]}`), `${mood} has its movement`);
    assert.equal(SHEETS.hub.frames.includes(`${mood}-talk`), mood !== 'asleep', `${mood}-talk`);
  }
});

test('every hub frame belongs to one of the six moods', () => {
  for (const name of SHEETS.hub.frames) assert.ok(MOODS.includes(name.split('-')[0]), name);
});

test("every mood's head point lies inside the cell", () => {
  assert.deepEqual(Object.keys(HEAD), MOODS);
  for (const mood of MOODS) assert.ok(Number.isInteger(HEAD[mood]) && HEAD[mood] >= 0 && HEAD[mood] < SHEETS.hub.cell[0], `${mood}: ${HEAD[mood]}`);
});

test('an unknown frame or sheet is an error', () => {
  assert.throws(() => framePos('hub', 'no-such-frame'), /no-such-frame/);
  assert.throws(() => framePos('no-such-sheet', 'happy'), /no-such-sheet/);
});

test('a sheet is a whole number of cells', () => {
  for (const [sheet, { cell, cols }] of Object.entries(SHEETS)) {
    const { w, h } = sheetSize(sheet);
    assert.equal(w, cols * cell[0], `${sheet} is ${cols} cells wide`);
    assert.equal(h % cell[1], 0, `${sheet} is whole rows high`);
    assert.ok(h >= cell[1], `${sheet} has at least one row`);
  }
});

test('frame names are unique within a sheet', () => {
  for (const [sheet, { frames }] of Object.entries(SHEETS)) assert.equal(new Set(frames).size, frames.length, sheet);
});

test('the sheet\'s address carries the script\'s version', () => {
  assert.equal(sheetUrl('hub', 'https://x.test/js/ziggy-frames.js?v=43'), 'https://x.test/sprites/ziggy-hub.png?v=43');
  assert.equal(sheetUrl('side', 'https://x.test/js/ziggy-frames.js'), 'https://x.test/sprites/ziggy-side.png');
  assert.equal(sheetUrl('props', 'https://x.test/js/ziggy-frames.js?v=54'), 'https://x.test/sprites/ziggy-props.png?v=54');
});

test('a frame\'s head point: its own, else its mood\'s still, mirrored when flipped', () => {
  for (const [name, x] of Object.entries(FRAME_HEAD)) {
    assert.ok(SHEETS.hub.frames.includes(name), name);
    assert.ok(Number.isInteger(x) && x >= 0 && x < 96, `${name}: ${x}`);
  }
  assert.equal(headAt('eager-trot', false), FRAME_HEAD['eager-trot'] ?? HEAD.eager);
  assert.equal(headAt('happy', false), HEAD.happy);
  assert.equal(headAt('happy', true), 95 - HEAD.happy);
  assert.equal(headAt('happy-look1', true), 40);
  for (const name of SHEETS.hub.frames) {
    const x = headAt(name, true);
    assert.ok(x >= 0 && x < 96, name);
  }
});

test('worried and asleep frames face left, the rest right', () => {
  for (const name of SHEETS.hub.frames) assert.equal(facesLeft(name), /^(worried|asleep)/.test(name), name);
  assert.deepEqual(['worried-glance', 'asleep-paw', 'eager-trot', 'happy-look1'].map(facesLeft), [true, true, false, false]);
});

test('the walk and the gallop go on the end of the hub sheet (v53), each with its own head point', () => {
  const GAIT = ['happy-walk1', 'happy-walk2', 'happy-walk3', 'happy-walk4', 'happy-run1', 'happy-run2', 'happy-run3'];
  assert.deepEqual(SHEETS.hub.frames.slice(39, 46), GAIT);
  assert.equal(SHEETS.hub.frames[38], 'happy-scratch2');
  for (const name of GAIT) assert.ok(Object.hasOwn(FRAME_HEAD, name), name);
});

test('a lifted frame: off the ground by a few px, nothing else is', () => {
  for (const [name, px] of Object.entries(FRAME_LIFT)) {
    assert.ok(SHEETS.hub.frames.includes(name), name);
    assert.ok(Number.isInteger(px) && px > 0 && px <= 8, `${name}: ${px}`);
    assert.equal(liftOf(name), px);
  }
  assert.equal(liftOf('happy'), 0);
  assert.equal(liftOf('eager-trot'), 0);
  // The bound: in the gallop he leaves the ground at the tuck, and his walk bobs a pixel (owner's pick C, 2026-11-28).
  assert.deepEqual(FRAME_LIFT, { 'happy-walk2': 1, 'happy-walk4': 1, 'happy-run1': 2, 'happy-run2': 6 });
});

test('the ball poses go on the end of the hub sheet (v54), with a ball, its own frames on the props sheet', () => {
  const BALL = ['happy-bow', 'happy-pounce', 'happy-pin', 'happy-carry', 'happy-nudge1', 'happy-nudge2'];
  assert.deepEqual(SHEETS.hub.frames.slice(46, 52), BALL);
  assert.deepEqual(SHEETS.props.frames.slice(0, 6), ['ball-roll1', 'ball-roll2', 'ball-roll3', 'ball-roll4', 'ball-squash', 'ball-air']);
  assert.equal(SHEETS.props.palette, 'props-palette.txt');
  const [bx, by] = BALL_CENTRE;
  assert.ok(bx >= 0 && bx < SHEETS.props.cell[0] && by >= 0 && by < SHEETS.props.cell[1]);
});

test('where the ball sits: in his mouth on the carry, walk and gallop frames, on the ground in front of the rest', () => {
  for (const [name, [x, y]] of Object.entries(FRAME_MOUTH)) {
    assert.ok(SHEETS.hub.frames.includes(name), name);
    assert.ok(x >= 0 && x < 96 && y >= 0 && y < 88, `${name}: ${x},${y}`);
  }
  for (const name of ['happy-carry', ...SHEETS.hub.frames.filter((n) => /^happy-(walk|run)/.test(n))]) assert.ok(Object.hasOwn(FRAME_MOUTH, name), name);
  for (const [name, x] of Object.entries(FRAME_BALL)) {
    assert.ok(SHEETS.hub.frames.includes(name), name);
    assert.ok(Number.isInteger(x) && x >= 0 && x <= 100, `${name}: ${x}`);
  }
});

test('the chew and tug poses go on the end of the hub sheet (v55), with a head point, and the toy and rope on theirs', () => {
  const NEW = ['happy-chew1', 'happy-chew2', 'happy-hold', 'happy-tug1', 'happy-tug2', 'happy-tug3'];
  assert.deepEqual(SHEETS.hub.frames.slice(52), NEW);
  for (const name of NEW) assert.ok(Object.hasOwn(FRAME_HEAD, name), name);
  assert.deepEqual(SHEETS.props.frames.slice(6), ['toy-flat', 'toy-up', 'knot']);
  for (const sheet of ['rope', 'ropes']) assert.equal(SHEETS[sheet].palette, 'props-palette.txt');
  for (const [name, x] of Object.entries(FRAME_TOY)) assert.ok(SHEETS.hub.frames.includes(name) && x >= 0 && x < 96, name);
  for (const [name, [x, y]] of Object.entries(FRAME_KNOT)) assert.ok(SHEETS.hub.frames.includes(name) && x >= 0 && x < 96 && y >= 0 && y < 88, name);
  assert.ok(Object.hasOwn(FRAME_MOUTH, 'happy-hold'));
  // the short rope's back knot lands on the point it is hung from
  for (const deg of [0, 30, 60, 90, 120, 150]) {
    const [dx, dy] = shortFrom(deg); const a = (deg * Math.PI) / 180;
    assert.ok(Math.abs(-dx - (24 - (SHORT_LEN / 2) * Math.cos(a))) <= 0.5 && Math.abs(-dy - (24 - (SHORT_LEN / 2) * Math.sin(a))) <= 0.5, `${deg}`);
    assert.ok(SHEETS.ropes.frames.includes(shortFrame(deg)));
  }
});
