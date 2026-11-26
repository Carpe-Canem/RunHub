/*
 * Field check: which Strava fields this athlete's own token actually receives.
 * Reports counts only. A field's value never leaves the object it came in.
 */
const F = (source, ...fields) => fields.map((field) => ({ source, field }));

export const PROBE_FIELDS = [
  ...F('athlete', 'bio', 'measurement_preference'),
  ...F('list', 'workout_type', 'start_latlng', 'map.summary_polyline', 'suffer_score', 'pr_count',
    'average_heartrate', 'max_heartrate', 'location_city', 'location_state'),
  ...F('activity', 'description', 'calories', 'splits_standard', 'suffer_score', 'pr_count',
    'average_heartrate', 'max_heartrate'),
];

// Follows a dotted path. Returns [keyExists, value].
function look(obj, path) {
  let cur = obj;
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(key in cur)) return [false, undefined];
    cur = cur[key];
  }
  return [true, cur];
}

const isFilled = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0);

export function probeFields(athlete, summaries, detail) {
  const sources = {
    athlete: athlete ? [athlete] : [],
    list: Array.isArray(summaries) ? summaries.filter(Boolean) : [],
    activity: detail ? [detail] : [],
  };
  return PROBE_FIELDS.map(({ source, field }) => {
    const objs = sources[source];
    let returned = 0; let filled = 0;
    for (const o of objs) {
      const [has, v] = look(o, field);
      if (has) { returned++; if (isFilled(v)) filled++; }
    }
    return { source, field, returned, filled, of: objs.length };
  });
}
