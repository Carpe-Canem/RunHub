import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROBE_FIELDS, probeFields } from '../js/probe.js';

const row = (rows, source, field) => rows.find((r) => r.source === source && r.field === field);

test('counts returned and filled per field', () => {
  const rows = probeFields(
    { id: 1, bio: '' },
    [{ suffer_score: 12, location_city: null, map: { summary_polyline: 'abc' }, workout_type: 1, start_latlng: [1, 2] },
     { location_city: 'Xtown', start_latlng: [] }],
    { description: null, calories: 300 });
  assert.deepEqual(row(rows, 'athlete', 'bio'), { source: 'athlete', field: 'bio', returned: 1, filled: 0, of: 1 });
  assert.deepEqual(row(rows, 'list', 'suffer_score'), { source: 'list', field: 'suffer_score', returned: 1, filled: 1, of: 2 });
  assert.deepEqual(row(rows, 'list', 'location_city'), { source: 'list', field: 'location_city', returned: 2, filled: 1, of: 2 });
  assert.equal(row(rows, 'list', 'start_latlng').filled, 1);            // an empty array is not filled
  assert.equal(row(rows, 'list', 'map.summary_polyline').filled, 1);    // dotted path
  assert.deepEqual(row(rows, 'activity', 'description'), { source: 'activity', field: 'description', returned: 1, filled: 0, of: 1 });
  assert.equal(row(rows, 'activity', 'calories').filled, 1);
});

test('never carries values', () => {
  const text = JSON.stringify(probeFields({ bio: 'secret words' }, [{ location_city: 'Xtown' }], { description: 'private note' }));
  for (const v of ['secret', 'Xtown', 'private']) assert.ok(!text.includes(v));
});

test('missing sources give of: 0 and one row per field', () => {
  const rows = probeFields(null, [], null);
  assert.equal(rows.length, PROBE_FIELDS.length);
  assert.ok(rows.every((r) => r.of === 0 && r.returned === 0 && r.filled === 0));
});
