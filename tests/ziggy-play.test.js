import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS } from '../js/ziggy-frames.js';
import { steps } from '../js/ziggy-moves.js';
import { ACT_MIN, ACT_MAX, ACTIVITIES, pickActivity, planActivity, planMs, travelMs } from '../js/ziggy-play.js';

const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rnd = seeded(13);

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

test('worried never travels', () => {
  for (const name of Object.keys(ACTIVITIES.worried)) for (let i = 0; i < 50; i++) {
    assert.ok(planActivity('worried', name, { x: 150, room: 312, rnd }).every((s) => s.pose));
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
  for (const name of Object.keys(ACTIVITIES.worried)) {
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
