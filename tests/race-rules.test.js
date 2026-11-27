import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANDARDS, classColour, classify, seriesKey, agePlace, isVirtual } from '../js/race-rules.js';

test('STANDARDS lists the eight classes in order', () => {
  assert.deepEqual(STANDARDS.map((s) => s.cls), ['1 mi', '5K', '5 mi', '10K', '15K', '10 mi', 'Half', 'Marathon']);
  assert.equal(STANDARDS[6].m, 21097.5);
});
test('name in km', () => assert.deepEqual(classify('Riverbend 10K', 10150), { cls: '10K', official: 10000, from: 'name' }));
test('name in miles (miler)', () => assert.deepEqual(classify('Frostbite 5 Miler', 8100), { cls: '5 mi', official: 8046.72, from: 'name' }));
test('10 Miler is not 1 mile', () => assert.equal(classify('Frostbite 10 Miler', 16200).cls, '10 mi'));
test('1 mile', () => assert.equal(classify('Library 1 mile', 1630).cls, '1 mi'));
test('half marathon', () => assert.deepEqual(classify('Frostbite Half Marathon', 22530), { cls: 'Half', official: 21097.5, from: 'name' }));
test('marathon', () => assert.equal(classify('Riverbend Marathon', 42650).cls, 'Marathon'));
test('50K is its own class', () => assert.deepEqual(classify('Canyon 50K', 50800), { cls: '50K', official: 50000, from: 'name' }));
test('a year is not a distance', () => assert.equal(classify('2025 Riverbend 10k', 10050).cls, '10K'));
test('no distance in name: nearest standard by GPS', () => assert.deepEqual(classify('Turkey Trot', 5020), { cls: '5K', official: 5000, from: 'gps' }));
test('name off by more than 15 %: GPS wins', () => {
  const r = classify('Riverbend 10K', 5010);
  assert.equal(r.cls, '5K'); assert.equal(r.from, 'gps');
});
test('no match anywhere is Other', () => assert.deepEqual(classify('Turkey Trot', 6400), { cls: 'Other', official: 6400, from: 'other' }));
test('Kids is not a kilometre word', () => assert.equal(classify('5 Kids Dash', 1600).cls, '1 mi'));
test('zero GPS keeps the name', () => assert.deepEqual(classify('Treadmill 5K', 0), { cls: '5K', official: 5000, from: 'name' }));
test('nothing at all', () => assert.deepEqual(classify('', 0), { cls: 'Other', official: 0, from: 'other' }));
test('decimal and non-standard labels', () => {
  assert.equal(classify('Hill 12.5K', 12600).cls, '12.5K');
  assert.equal(classify('Park 4 mile', 6500).cls, '4 mi');
  assert.equal(classify('Lake 21.1K', 21200).cls, 'Half');
});
test('seriesKey ignores year and case', () => {
  assert.equal(seriesKey('2025 Riverbend 10k'), 'riverbend');
  assert.equal(seriesKey('Riverbend 10K 2024'), 'riverbend');
});
test('seriesKey drops ordinals, annual, distance words, punctuation', () => {
  assert.equal(seriesKey('12th Annual Frostbite 5 Miler'), 'frostbite');
  assert.equal(seriesKey('Frostbite Half Marathon!'), 'frostbite');
});
test('agePlace reads the age-group place', () => {
  assert.equal(agePlace('3rd in age group'), 3);
  assert.equal(agePlace('1st AG, 12th overall'), 1);
  assert.equal(agePlace('2nd in my age group (M40-44)'), 2);
  assert.equal(agePlace('1st overall, 3rd in AG'), 3);
  assert.equal(agePlace('45th overall'), null);
  assert.equal(agePlace(null), null);
});
test('isVirtual', () => {
  assert.equal(isVirtual('VirtualRun', null), true);
  assert.equal(isVirtual('Run', 'Virtual edition this year'), true);
  assert.equal(isVirtual('Run', 'Virtually flat course'), false);
});
test('classColour', () => {
  assert.equal(classColour('10K'), '#35D69B');
  assert.equal(classColour('50K'), '#B3A6FF');
});
test('seriesKey is never empty for a non-empty name', () => {
  assert.equal(seriesKey('5K'), '5k');
  assert.equal(seriesKey('2025 10K'), '2025 10k');
  assert.ok(seriesKey('5K & 10K').length > 0);
  assert.equal(seriesKey(''), '');
});

test('the rules use no regex lookbehind, which older Safari cannot parse', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../js/race-rules.js', import.meta.url), 'utf8');
  assert.equal(/\(\?<[!=]/.test(src), false);
});

test('runUpAt: starts at zero, lands exactly on the time, never runs backwards or past it', async () => {
  const { runUpAt } = await import('../js/race-rules.js');
  assert.equal(runUpAt(1361, 0), 0);
  assert.equal(runUpAt(1361, -1), 0);
  assert.equal(runUpAt(1361, 1), 1361);
  assert.equal(runUpAt(1361, 2), 1361);
  let last = 0;
  for (let i = 0; i <= 100; i++) {
    const s = runUpAt(1361, i / 100);
    assert.ok(Number.isInteger(s) && s >= last && s <= 1361, `step ${i}: ${s}`);
    last = s;
  }
});

test('runUpAt: eased, so it is past half-way at half time', async () => {
  const { runUpAt } = await import('../js/race-rules.js');
  assert.ok(runUpAt(1000, 0.5) > 800);
  assert.equal(runUpAt(0, 0.5), 0);
});
