import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS, HEAD, FRAME_HEAD, FRAME_LIFT, FRAME_MOUTH, FRAME_BALL, FRAME_TOY, FRAME_KNOT, BALL_CENTRE, SHORT_LEN, SLEEP_TOP, ZEES, headAt, liftOf, facesLeft, framePos, sheetSize, sheetUrl, shortFrom, shortFrame, BARK_SIZE, barkPlace } from '../js/ziggy-frames.js';

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

test('the hub sheet is 768 × 792 with 71 frames, the side sheet 192 × 40 with four, the props 96 × 32 with twelve, the barks 160 × 30 with twelve', () => {
  assert.equal(SHEETS.hub.frames.length, 71);
  assert.deepEqual(sheetSize('hub'), { w: 768, h: 792 });
  assert.equal(SHEETS.props.frames.length, 12);
  assert.deepEqual(sheetSize('props'), { w: 96, h: 32 });
  assert.equal(SHEETS.barks.frames.length, 12);
  assert.deepEqual(sheetSize('barks'), { w: 160, h: 30 });
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
  assert.deepEqual(SHEETS.hub.frames.slice(52, 58), NEW);
  for (const name of NEW) assert.ok(Object.hasOwn(FRAME_HEAD, name), name);
  assert.deepEqual(SHEETS.props.frames.slice(6, 9), ['toy-flat', 'toy-up', 'knot']);
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

test('the rest poses go on the end of the hub sheet (v57), each with a head point; the z\'s on the props sheet', () => {
  const NEW = ['happy-lie', 'happy-lie-blink', 'happy-nap1', 'happy-nap2', 'happy-dream1', 'happy-dream2', 'happy-roll1',
    'happy-roll2', 'happy-roll3', 'worried-pace1', 'worried-pace2', 'worried-pace3', 'worried-pace4'];
  assert.deepEqual(SHEETS.hub.frames.slice(58), NEW);
  for (const name of NEW) assert.ok(Object.hasOwn(FRAME_HEAD, name), name);
  for (const name of NEW.filter((n) => n.startsWith('worried'))) assert.ok(facesLeft(name), name);
  assert.deepEqual(SHEETS.props.frames.slice(9), ['zee-s', 'zee-m', 'zee-l']);
  assert.deepEqual(ZEES.map(([name]) => name), ['zee-s', 'zee-m', 'zee-l']);
});

test('the z\'s have a start in every frame he sleeps in, and the highest stays inside the strip', () => {
  const sleeping = SHEETS.hub.frames.filter((n) => /^(asleep|happy-(nap|dream|roll))/.test(n));
  assert.deepEqual(Object.keys(SLEEP_TOP).sort(), sleeping.sort());
  for (const [name, top] of Object.entries(SLEEP_TOP)) {
    for (const [, , , up] of ZEES) assert.ok(top - up - 1 >= 0 && top < 88, `${name}: ${top - up}`);
  }
});

test('a bark sticker is placed in front of his face on the side he faces, 22 px past his head point', () => {
  const [w] = BARK_SIZE.woof;
  // Faces right (happy, as drawn): head 62 in the cell, dog at 100 on a 408 strip.
  assert.deepEqual(barkPlace('woof', 'happy', false, 100, 408), { left: 100 + 62 + 22, top: 4 });
  // Faces left (worried): head 31, so it ends 22 px before it.
  assert.deepEqual(barkPlace('woof', 'worried', false, 200, 408), { left: 200 + 31 - 22 - w, top: 4 });
  // Drawn flipped after a trip, the same frame faces the other way and its head is mirrored.
  assert.deepEqual(barkPlace('woof', 'happy', true, 200, 408), { left: 200 + (95 - 62) - 22 - w, top: 4 });
});

test('a bark that would leave the strip goes behind his head instead', () => {
  const [w] = BARK_SIZE.yip;
  // Faces right at the right end: behind him, 4 px clear of his left edge.
  assert.deepEqual(barkPlace('yip', 'happy', false, 312, 408), { left: 312 - w - 4, top: 4 });
  // Faces left at the left end: behind him, past his right edge.
  assert.deepEqual(barkPlace('yip', 'worried', false, 0, 408), { left: 96 + 4, top: 4 });
  // Always inside a strip as narrow as the Hub's phone width, wherever he stands.
  for (const frame of ['happy', 'worried', 'eager', 'asleep']) for (const flip of [false, true]) {
    for (let x = 0; x <= 408 - 96; x += 8) {
      const { left } = barkPlace('yip', frame, flip, x, 408);
      assert.ok(left >= 0 && left + w <= 408, `${frame} flip ${flip} at ${x}: ${left}`);
    }
  }
});
