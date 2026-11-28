import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS, FRAME_MOUTH, FRAME_BALL, FRAME_TOY, FRAME_KNOT } from '../js/ziggy-frames.js';
import { steps } from '../js/ziggy-moves.js';
import { ACT_MIN, ACT_MAX, ACTIVITIES, GAITS, BALL_ROUTINES, CHEW_ROUTINES, TUG_ROUTINES, REST_ROUTINES, ROPE_FAR, ROPE_FAR_H, ropeSteps, POUNCE_ARC, pickActivity, planActivity, planMs, propPath, travelMs } from '../js/ziggy-play.js';

const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rnd = seeded(13);
const PACING = ['worried-pace1', 'worried-pace2', 'worried-pace3', 'worried-pace4'];

test('every activity lasts 4 to 12 s, uses real frames and ends on the still', () => {
  for (const [mood, set] of Object.entries(ACTIVITIES)) for (const name of Object.keys(set)) {
    for (const room of [0, 60, 96, 312, 1200]) for (let i = 0; i < 50; i++) {
      const plan = planActivity(mood, name, { x: room / 2, room, rnd });
      const ms = planMs(plan);
      assert.ok(ms >= ACT_MIN && ms <= ACT_MAX, `${mood} ${name} room ${room}: ${ms}`);
      assert.ok(plan[0].pose && plan.at(-1).pose);
      assert.equal(plan.at(-1).pose.at(-1)[0], mood);
      for (const st of plan) for (const f of st.pose ? st.pose.map(([n]) => n) : st.travel.frames) assert.ok(SHEETS.hub.frames.includes(f), f);
    }
  }
});

test('no pose frame is held for more than 1.5 s', () => {
  for (const [mood, set] of Object.entries(ACTIVITIES)) for (const name of Object.keys(set)) {
    for (const room of [0, 312]) for (let i = 0; i < 50; i++) {
      for (const st of planActivity(mood, name, { x: room / 2, room, rnd })) {
        for (const [f, ms] of st.pose ?? []) assert.ok(ms <= 1500, `${mood} ${name}: ${f} ${ms}`);
      }
    }
  }
});

test('travels stay on the strip, start from where he is, and vanish when it is too narrow', () => {
  // x beyond room: the strip narrowed under him.
  for (const [x, room] of [[0, 312], [312, 312], [500, 312], [40, 95], [40, 0]]) for (let i = 0; i < 50; i++) {
    const travels = planActivity('happy', 'dash', { x, room, rnd }).filter((s) => s.travel);
    if (room < 96) assert.equal(travels.length, 0);
    for (const { travel: t } of travels) assert.ok(t.to >= 0 && t.to <= room && t.ms > 0);
  }
});

test('a second travel starts where the first ended', () => {
  for (let i = 0; i < 50; i++) {
    let at = 100;
    for (const s of planActivity('happy', 'potter', { x: 100, room: 312, rnd })) {
      if (!s.travel) continue;
      assert.ok(Math.abs(s.travel.to - at) >= 48);
      assert.equal(s.travel.ms, travelMs(s.travel.to - at, 'walk'));
      at = s.travel.to;
    }
  }
});

test('the picker never repeats, plays the whole set, and asleep always dozes', () => {
  for (const [mood, set] of Object.entries(ACTIVITIES)) {
    const names = Object.keys(set); let last = null; const got = new Set();
    for (let i = 0; i < 300; i++) {
      const next = pickActivity(mood, last, rnd);
      assert.ok(names.includes(next));
      if (names.length > 1) assert.notEqual(next, last);
      got.add(next); last = next;
    }
    assert.equal(got.size, names.length, mood);
  }
  assert.equal(pickActivity('asleep', 'doze', rnd), 'doze');
});

test('worried travels only when he paces, and only on his head-low walk', () => {
  for (const name of Object.keys(ACTIVITIES.worried)) for (let i = 0; i < 50; i++) {
    const plan = planActivity('worried', name, { x: 150, room: 312, rnd });
    if (name !== 'pace') assert.ok(plan.every((s) => s.pose), name);
    for (const { travel: t } of plan.filter((s) => s.travel)) assert.deepEqual(t.frames, PACING);
  }
});

test('a beat hook makes every beat that fidget', () => {
  const sniff = JSON.stringify(steps('happy', 'sniff'));
  for (let i = 0; i < 50; i++) {
    for (const s of planActivity('happy', 'potter', { x: 150, room: 312, rnd, beat: 'sniff' })) if (s.pose) assert.equal(JSON.stringify(s.pose), sniff);
  }
  // A beat the mood does not have, or a wander, is ignored.
  for (const beat of ['yawn', 'wander']) {
    const plan = planActivity('curious', 'potter', { x: 150, room: 312, rnd, beat });
    assert.ok(planMs(plan) >= ACT_MIN);
  }
});

test('worried is never the same loop: the plans differ in their beats and in their length', () => {
  for (const name of ['mope', 'fret']) {
    const plans = Array.from({ length: 50 }, () => planActivity('worried', name, { x: 150, room: 312, rnd }));
    assert.ok(new Set(plans.map((p) => JSON.stringify(p.map((s) => s.pose.map(([f]) => f))))).size > 1, `${name}: sequences`);
    assert.ok(new Set(plans.map(planMs)).size > 1, `${name}: lengths`);
  }
});

test('a beat is not played twice running where another is to be had', () => {
  const moves = ['blink', 'ear', 'tail', 'yawn', 'shake', 'tilt', 'sniff', 'lookback', 'scratch'].map((m) => JSON.stringify(steps('happy', m)));
  for (let i = 0; i < 100; i++) {
    const poses = planActivity('happy', 'potter', { x: 150, room: 312, rnd }).filter((s) => s.pose).map((s) => JSON.stringify(s.pose));
    for (let k = 1; k < poses.length; k++) {
      if (moves.includes(poses[k])) assert.notEqual(poses[k], poses[k - 1], `plan ${i}, beat ${k}`);
    }
  }
});

test('a dash goes there and back', () => {
  for (let i = 0; i < 50; i++) {
    const travels = planActivity('happy', 'dash', { x: 100, room: 312, rnd }).filter((s) => s.travel);
    assert.equal(travels.length, 2);
    assert.equal(travels[1].travel.to, 100);
  }
});

test('a plan never ends on a travel, even with the longest walks and the longest beats', () => {
  for (const mood of ['happy', 'thrilled', 'eager', 'curious']) for (const name of Object.keys(ACTIVITIES[mood])) {
    for (const [room, x] of [[5000, 0], [5000, 2500], [5000, 5000]]) for (const r of [0.999, 0.5, 0]) {
      const plan = planActivity(mood, name, { x, room, rnd: () => r });
      assert.ok(plan.at(-1).pose, `${mood} ${name} room ${room} x ${x} rnd ${r}`);
      assert.ok(planMs(plan) <= ACT_MAX, `${mood} ${name}: ${planMs(plan)}`);
    }
  }
});

test('travel times', () => {
  assert.equal(travelMs(100, 'walk'), 550);
  assert.equal(travelMs(-100, 'run'), 240);
  assert.equal(travelMs(5000, 'walk'), 2600);
  assert.equal(travelMs(5000, 'run'), 1200);
});

test('the awake moods walk and gallop on their own frames, never the borrowed trot (v53)', () => {
  const WALK = ['happy-walk1', 'happy-walk2', 'happy-walk3', 'happy-walk4'];
  const RUN = ['happy-run1', 'happy-run2', 'happy-run3'];
  assert.deepEqual(Object.keys(GAITS), ['happy', 'thrilled', 'eager', 'curious']);
  for (const mood of Object.keys(GAITS)) {
    assert.deepEqual(GAITS[mood], { walk: WALK, run: RUN }, mood);
    const seen = { walk: 0, run: 0 };
    for (const name of ['stroll', 'dash', 'potter']) for (let i = 0; i < 40; i++) {
      for (const { travel: t } of planActivity(mood, name, { x: 150, room: 312, rnd }).filter((s) => s.travel)) {
        assert.ok(!t.frames.includes('eager-trot'), `${mood} ${name}`);
        if (t.frameMs === 150) { assert.deepEqual(t.frames, WALK); seen.walk++; }
        else { assert.equal(t.frameMs, 90); assert.deepEqual(t.frames, RUN); seen.run++; }
      }
    }
    assert.ok(seen.walk && seen.run, `${mood} walks and runs`);
  }
});

// ---- the ball (v54)
const BALL_MOODS = ['happy', 'thrilled', 'eager', 'curious'];
const ROOMS = [0, 60, 96, 200, 312, 1200, 5000];
const ballPlans = function* () {
  for (const mood of BALL_MOODS) for (const routine of BALL_ROUTINES) for (const room of ROOMS) {
    for (const x of [0, Math.round(room / 2), room, room + 100]) for (const flip of [false, true]) {
      yield { mood, routine, room, x, flip, plan: planActivity(mood, 'ball', { x, room, rnd, flip, routine }) };
    }
  }
};
// Where the ball ends up after a prop step: the last point of its path.
const endOf = (prop) => propPath(prop).at(-1);

test('every ball routine lasts 4 to 12 s on any strip, uses real frames and ends on his still', () => {
  for (const { mood, routine, room, plan } of ballPlans()) {
    const ms = planMs(plan);
    assert.ok(ms >= ACT_MIN && ms <= ACT_MAX, `${mood} ${routine} room ${room}: ${ms}`);
    assert.ok(plan[0].pose && plan.at(-1).pose);
    assert.equal(plan.at(-1).pose.at(-1)[0], mood);
    for (const st of plan) {
      for (const f of st.pose ? st.pose.map(([n]) => n) : st.travel.frames) assert.ok(SHEETS.hub.frames.includes(f), f);
      for (const [f, t] of st.pose ?? []) assert.ok(t <= 1500, `${routine}: ${f} ${t}`);
      if (st.travel) assert.ok(st.travel.to >= 0 && st.travel.to <= room && Number.isInteger(st.travel.to), `${routine} room ${room}: ${st.travel.to}`);
    }
    if (room < 96) assert.ok(plan.every((st) => st.pose), `${routine} room ${room} stays put`);
  }
});

test('the ball rolls in from off the strip, stays on it, and rolls off it at the end', () => {
  for (const { routine, room, plan } of ballPlans()) {
    const W = room + 96;
    const props = plan.filter((st) => st.prop && !st.prop.held).map((st) => st.prop);
    assert.ok(props[0].roll && (props[0].roll.from < 0 || props[0].roll.from > W), `${routine}: comes in from off the strip`);
    const out = props.at(-1).roll;
    assert.ok(out && (out.to < 0 || out.to > W), `${routine} room ${room}: leaves`);
    assert.ok(plan.at(-1).prop === props.at(-1), 'it leaves in the last step');
    for (const p of props.slice(1, -1)) for (const { x, h, frame } of propPath(p)) {
      assert.ok(x >= 0 && x <= W, `${routine} room ${room}: x ${x}`);
      assert.ok(h >= 0 && h <= 88 - 16, `${routine}: h ${h}`);
      assert.ok(SHEETS.props.frames.includes(frame), frame);
    }
    // a step's ball does not outrun the step
    for (const st of plan) if (st.prop && st.prop.roll && st !== plan.at(-1)) assert.ok(st.prop.roll.ms <= planMs([st]));
    for (const st of plan) if (st.prop && st.prop.fly) assert.ok(st.prop.fly.ms <= planMs([st]));
  }
});

test('he holds the ball only on frames with a mouth for it, and it lies where his pin or nudge expects it', () => {
  for (const { mood, routine, room, x, plan } of ballPlans()) {
    let held = false, flip = null, at = Math.min(Math.max(0, x), room), ball = null;
    for (const st of plan) {
      if (st.flip !== undefined) flip = st.flip;
      if (st.prop) {
        held = !!st.prop.held;
        if (!held) ball = endOf(st.prop);
      }
      const frames = st.pose ? st.pose.map(([n]) => n) : st.travel.frames;
      if (held) for (const f of frames) assert.ok(Object.hasOwn(FRAME_MOUTH, f), `${mood} ${routine}: holds it on ${f}`);
      if (st.travel) { flip = st.travel.to < at; at = st.travel.to; continue; }
      const f = frames[0];
      if (!held && !st.prop && (f === 'happy-pin' || f === 'happy-nudge1')) {
        const want = at + (flip ? 95 - FRAME_BALL[f] : FRAME_BALL[f]);
        assert.ok(Math.abs(ball.x - want) <= 1 && ball.h === 0, `${routine} room ${room} x ${x}: ball ${ball.x}, ${f} wants ${want}`);
      }
    }
    assert.equal(held, false);
  }
});

test('all three routines turn up, and the pounce leaves the ground', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const plan = planActivity('happy', 'ball', { x: 150, room: 312, rnd });
    const leaps = plan.filter((st) => st.travel && st.travel.arc);
    const gallops = plan.filter((st) => st.travel && !st.travel.arc);
    seen.add(gallops.length ? 'fetch' : leaps.some((st) => st.travel.arc === POUNCE_ARC) ? 'pounce' : 'catch');
    for (const st of leaps) assert.deepEqual(st.travel.frames, ['happy-pounce']);
  }
  assert.deepEqual([...seen].sort(), [...BALL_ROUTINES].sort());
});

test('a ball path ends where it was sent, on the ground, and turns as it rolls', () => {
  const roll = propPath({ roll: { from: 400, to: 100, ms: 900 } });
  assert.deepEqual([roll[0].x, roll.at(-1).x, roll.at(-1).t], [400, 100, 900]);
  assert.ok(new Set(roll.map((p) => p.frame)).size === 4);
  const fly = propPath({ fly: { from: [200, 36], to: 300, ms: 1200, apex: 48, hops: [20, 8], roll: true } });
  assert.deepEqual([fly.at(-1).x, fly.at(-1).h], [300, 0]);
  assert.equal(Math.max(...fly.map((p) => p.h)), 48);
  assert.ok(fly.some((p) => p.frame === 'ball-squash') && fly.some((p) => p.frame === 'ball-air'));
});

// ---- the chew toy and the rope (v55)
const playPlans = function* () {
  for (const [name, routines] of [['chew', CHEW_ROUTINES], ['tug', TUG_ROUTINES]]) {
    for (const mood of BALL_MOODS) for (const routine of routines) for (const room of ROOMS) {
      for (const x of [0, Math.round(room / 2), room, room + 100]) for (const flip of [false, true]) {
        yield { name, mood, routine, room, x, flip, plan: planActivity(mood, name, { x, room, rnd, flip, routine }) };
      }
    }
  }
};

test('every chew and tug routine lasts 4 to 12 s on any strip, uses real frames and ends on his still', () => {
  for (const { name, mood, routine, room, plan } of playPlans()) {
    const ms = planMs(plan);
    assert.ok(ms >= ACT_MIN && ms <= ACT_MAX, `${name} ${routine} room ${room}: ${ms}`);
    assert.ok(plan[0].pose && plan.at(-1).pose);
    assert.equal(plan.at(-1).pose.at(-1)[0], mood);
    for (const st of plan) {
      for (const f of st.pose ? st.pose.map(([n]) => n) : st.travel.frames) assert.ok(SHEETS.hub.frames.includes(f), f);
      for (const [f, t] of st.pose ?? []) assert.ok(t <= 1500, `${routine}: ${f} ${t}`);
      if (st.travel) assert.ok(st.travel.to >= 0 && st.travel.to <= room && Number.isInteger(st.travel.to), `${routine} room ${room}: ${st.travel.to}`);
      if (st.travel?.keep) assert.equal(name, 'tug', 'only the tug goes without turning round');
    }
    if (room < 96) assert.ok(plan.every((st) => st.pose), `${routine} room ${room} stays put`);
  }
});

test('the toy and the rope come in from off the strip, stay on it, and leave it at the end', () => {
  for (const { name, routine, room, plan } of playPlans()) {
    const W = room + 96;
    const props = plan.filter((st) => st.prop && !st.prop.held).map((st) => st.prop);
    const first = propPath(props[0]);
    assert.ok(first[0].x < 0 || first[0].x > W, `${routine}: comes in from off the strip (${first[0].x})`);
    const last = propPath(props.at(-1)).at(-1);
    assert.ok(last.x < 0 || last.x > W, `${routine} room ${room}: leaves (${last.x})`);
    assert.ok(plan.at(-1).prop === props.at(-1), 'it leaves in the last step');
    for (const p of props.slice(1, -1)) for (const { x, h } of propPath(p)) {
      assert.ok(x >= 0 && x <= W && h >= 0 && h <= 88 - 16, `${routine} room ${room}: ${x},${h}`);
    }
    for (const p of props) for (const { frame } of propPath(p)) {
      const sheet = name === 'chew' ? 'props' : p.rope === 'long' ? 'rope' : 'ropes';
      assert.ok(SHEETS[sheet].frames.includes(frame), `${routine}: ${frame}`);
    }
    for (const st of plan.slice(0, -1)) for (const k of ['roll', 'fly', 'slide']) if (st.prop?.[k]) assert.ok(st.prop[k].ms <= planMs([st]), `${routine}: a ${k} outruns its step`);
  }
});

test('he holds the toy only on frames with a mouth for it, the rope only where it has a knot, and the toy stands between his paws', () => {
  for (const { name, routine, room, x, plan } of playPlans()) {
    let held = false, flip = null, at = Math.min(Math.max(0, x), room);
    for (const st of plan) {
      if (st.flip !== undefined) flip = st.flip;
      if (st.prop) held = !!st.prop.held;
      const frames = st.pose ? st.pose.map(([n]) => n) : st.travel.frames;
      const table = name === 'chew' ? FRAME_MOUTH : FRAME_KNOT;
      if (held) for (const f of frames) assert.ok(Object.hasOwn(table, f), `${routine}: holds it on ${f}`);
      if (st.prop?.swing) {
        assert.ok(st.prop.swing.reduce((n, [, ms]) => n + ms, 0) <= planMs([st]));
        for (const [deg] of st.prop.swing) assert.ok(SHEETS.ropes.frames.includes(`short${deg}`), `${deg}`);
      }
      if (st.travel) { if (!st.travel.keep) flip = st.travel.to < at; at = st.travel.to; continue; }
      if (st.prop?.frame === 'toy-up') {
        assert.ok(frames.every((f) => Object.hasOwn(FRAME_TOY, f)), `${routine}: chews on ${frames}`);
        assert.equal(st.prop.lie.x, Math.round(at + (flip ? 95 - FRAME_TOY['happy-chew1'] : FRAME_TOY['happy-chew1'])), `${routine} room ${room}`);
      }
    }
    assert.equal(held, false, `${routine}: lets go`);
  }
});

test('every chew and tug routine turns up, and the tug backs up without turning round', () => {
  for (const [name, routines] of [['chew', CHEW_ROUTINES], ['tug', TUG_ROUTINES]]) {
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      const plan = planActivity('happy', name, { x: 150, room: 312, rnd });
      const frames = plan.flatMap((st) => (st.pose ? st.pose.map(([n]) => n) : st.travel.frames));
      if (name === 'chew') seen.add(frames.includes('happy-pin') ? 'spring' : frames.includes('happy-carry') ? 'bring' : 'gnaw');
      else seen.add(frames.includes('happy-tug2') ? 'tugger' : 'fling');
      if (frames.includes('happy-tug2')) assert.ok(plan.some((st) => st.travel?.keep));
    }
    assert.deepEqual([...seen].sort(), [...routines].sort());
  }
});

test('the held tug rope steps a pixel at a time from his mouth to its far end (v56)', () => {
  for (const [a, b] of [[[207, 66], [468, 67]], [[156, 42], [468, 67]], [[150, 45], [-60, 67]], [[10, 20], [10, 20]]]) {
    const cols = ropeSteps(a, b);
    assert.deepEqual(cols[0], a);
    assert.deepEqual(cols.at(-1), b);
    for (let i = 1; i < cols.length; i++) {
      assert.equal(Math.abs(cols[i][0] - cols[i - 1][0]), 1);
      assert.ok(Math.abs(cols[i][1] - cols[i - 1][1]) <= 1, `${a} to ${b}: a step of ${cols[i][1] - cols[i - 1][1]}`);
    }
  }
  assert.ok(ROPE_FAR > 0 && ROPE_FAR_H > 0 && ROPE_FAR_H < 40);
});

// ---- rest (v57)
const framesOf = (plan) => plan.flatMap((s) => (s.pose ? s.pose.map(([f]) => f) : s.travel.frames));

test('a rest lies down where he is, naps with a dream or rolls over, and gets up again, on any strip', () => {
  for (const mood of BALL_MOODS) for (const routine of REST_ROUTINES) for (const room of ROOMS) for (let i = 0; i < 10; i++) {
    const plan = planActivity(mood, 'rest', { x: room / 2, room, rnd, routine });
    const ms = planMs(plan);
    assert.ok(ms >= ACT_MIN && ms <= ACT_MAX, `${mood} ${routine}: ${ms}`);
    assert.ok(plan.every((s) => s.pose && s.flip === undefined), 'he rests where he is, facing as he was');
    const f = framesOf(plan);
    assert.equal(f[0], mood); assert.equal(f.at(-1), mood);
    assert.deepEqual(f.slice(1, 3), ['happy-bow', 'happy-lie'], 'down by the bow');
    assert.deepEqual(f.slice(-3, -1), ['happy-lie', 'happy-bow'], 'up by the bow');
    if (routine === 'nap') assert.ok(f.includes('happy-nap2') && f.includes('happy-dream1') && f.includes('happy-dream2') && !f.includes('happy-roll2'));
    else assert.ok(f.includes('happy-roll2') && f.includes('happy-roll3') && !f.includes('happy-nap1'));
  }
  const drawn = new Set(Array.from({ length: 60 }, () => framesOf(planActivity('happy', 'rest', { x: 100, room: 312, rnd })).includes('happy-roll1')));
  assert.equal(drawn.size, 2, 'both routines turn up');
});

test('the longest nap still fits, with fewer paddles', () => {
  const plan = planActivity('happy', 'rest', { x: 0, room: 312, rnd: () => 0.999, routine: 'nap' });
  assert.ok(planMs(plan) <= ACT_MAX, `${planMs(plan)}`);
  assert.ok(framesOf(plan).filter((f) => f === 'happy-dream1').length >= 2);
});

test('worried paces head low to one side, then the other, and home again; on a narrow strip he stays put', () => {
  const sides = new Set();
  for (const room of ROOMS) for (const x of [0, Math.round(room / 2), room]) for (let i = 0; i < 20; i++) {
    const plan = planActivity('worried', 'pace', { x, room, rnd });
    const travels = plan.filter((s) => s.travel).map((s) => s.travel);
    if (room < 96) { assert.equal(travels.length, 0); continue; }
    if (room >= 200) assert.ok(travels.length >= 2, `room ${room} x ${x}`);   // a strip just wide enough may give him no room to go
    let at = x;
    for (const t of travels) {
      // out to an end at least 24 px; the trip home may be shorter
      assert.ok(t.to >= 0 && t.to <= room && Math.abs(t.to - at) >= (t === travels.at(-1) && t.to === x ? 1 : 24) && t.frameMs === 240);
      assert.equal(t.ms, travelMs(t.to - at, 'pace'));
      at = t.to;
    }
    assert.equal(at, x, 'home again');
    // On a phone's strip he goes end to end (the owner's pick W2); on a wide one at most 300 px.
    const ends = travels.map((t) => t.to);
    if (room === 312) assert.ok(Math.min(...ends, x) <= 40 && Math.max(...ends, x) >= room - 40, `room ${room} x ${x}: ${ends}`);
    assert.ok(Math.max(...ends, x) - Math.min(...ends, x) <= 300 + 40, `room ${room} x ${x}: ${ends}`);
    if (x === Math.round(room / 2) && travels.length) sides.add(Math.sign(travels[0].to - x));
  }
  assert.deepEqual([...sides].sort(), [-1, 1], 'he sets off either way');
  const lengths = new Set(Array.from({ length: 30 }, () => planMs(planActivity('worried', 'pace', { x: 150, room: 312, rnd }))));
  assert.ok(lengths.size > 1, 'not the same length every time');
});

test('a doze has dreaming paws, and a roll onto his back drawn the other way round, then back as he was', () => {
  for (const flip of [false, true]) for (const routine of ['roll', 'nap']) for (let i = 0; i < 20; i++) {
    const plan = planActivity('asleep', 'doze', { x: 100, room: 312, rnd, flip, routine });
    const f = framesOf(plan);
    assert.ok(f.includes('asleep-paw') && f.includes('asleep-breathe'));
    const rolls = plan.filter((s) => s.pose.some(([n]) => n.startsWith('happy-roll')));
    if (routine === 'nap') { assert.equal(rolls.length, 0); continue; }
    assert.equal(rolls.length, 1);
    assert.equal(rolls[0].flip, !flip);
    assert.ok(rolls[0].pose.every(([n]) => n.startsWith('happy-roll')));
    assert.equal(plan[plan.indexOf(rolls[0]) + 1].flip, flip, 'back on the curl, facing as he was');
  }
  const rolled = new Set(Array.from({ length: 60 }, () => framesOf(planActivity('asleep', 'doze', { x: 100, room: 312, rnd })).includes('happy-roll2')));
  assert.equal(rolled.size, 2, 'he rolls over now and then, not every time');
});

test('one activity runs into the next without his still being held over 1.5 s across the join (v57)', () => {
  // The still that ends one plan and the one that opens the next are a single hold on screen.
  const lead = (plan) => { const p = plan[0].pose; let ms = 0; for (const [f, t] of p) { if (f !== p[0][0]) break; ms += t; } return [p[0][0], ms]; };
  const tail = (plan) => { const p = plan.at(-1).pose; let ms = 0; for (let i = p.length - 1; i >= 0 && p[i][0] === p.at(-1)[0]; i--) ms += p[i][1]; return [p.at(-1)[0], ms]; };
  for (const [mood, set] of Object.entries(ACTIVITIES)) for (const a of Object.keys(set)) for (const b of Object.keys(set)) {
    if (a === b && Object.keys(set).length > 1) continue;   // never twice running
    for (let i = 0; i < 30; i++) {
      const [fa, ma] = tail(planActivity(mood, a, { x: 150, room: 312, rnd }));
      const first = planActivity(mood, b, { x: 150, room: 312, rnd });
      if (!first[0].pose) continue;
      const [fb, mb] = lead(first);
      if (fa === fb) assert.ok(ma + mb <= 1500, `${mood} ${a} -> ${b}: ${fa} ${ma + mb}`);
    }
  }
});
