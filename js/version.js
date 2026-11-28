// The version running, and what changed in each one. The number is this module's own ?v=, which
// scripts/stamp-version.mjs sets for every module at once, so it is the version actually loaded, never a copy.
import { $, h } from './dom.js';

export const versionOf = (url) => new URL(url).searchParams.get('v') || 'dev';
export const VERSION = versionOf(import.meta.url);

// Newest first. A new version adds its entry here when it is stamped; tests/versions.test.js checks the top entry
// is the stamped version.
export const CHANGES = [
  { v: '53', date: '2026-11-28', items: ['Ziggy walks and gallops on legs of his own now, and leaves the ground mid-gallop.'] },
  { v: '52', date: '2026-11-28', items: ["Ziggy's muzzle is mostly black now, with white kept to the front round his nose, as in his photos."] },
  { v: '51', date: '2026-11-28', items: ['Ziggy is always up to something: he strolls, dashes about and potters between his lines.'] },
  { v: '50', date: '2026-11-28', items: ['Up next shows the next three races, with Show more for the rest.', 'The version shows beside the title, and this list of changes is on Data.'] },
  { v: '49', date: '2026-11-28', items: ['Personal records show the pace under each time.', 'A Marathon badge no longer runs into its date.'] },
  { v: '48', date: '2026-11-28', items: ['The Hub fits on a phone screen without scrolling.'] },
  { v: '47', date: '2026-11-27', items: ['The Races filters sit on one row.', 'Credits moved to Data.', 'The page no longer bounces at its ends.'] },
  { v: '46', date: '2026-11-27', items: ['Ziggy sniffs, looks back and scratches.'] },
  { v: '45', date: '2026-11-27', items: ['Route cards on Races fill their width, with a fine glowing line.'] },
  { v: '44', date: '2026-11-27', items: ['Small fixes from a review.'] },
  { v: '43', date: '2026-11-27', items: ['README and a tidy-up of the Hub.'] },
  { v: '42', date: '2026-11-27', items: ['Ziggy speaks in sentences on the Hub.', 'The race board lights up: lamp test, ticker and run-up.'] },
  { v: '41', date: '2026-11-27', items: ['Local Legends removed.', 'Mileage moved to the Hub.'] },
  { v: '40', date: '2026-11-27', items: ['No pace trend under the All filter.'] },
  { v: '39', date: '2026-11-27', items: ['Next start counts down to midnight on race day, with seconds.'] },
  { v: '38', date: '2026-11-27', items: ['Repeat errors are announced.', 'Up next days roll over at midnight.'] },
];

const dateText = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// The faint number beside the title.
export function showVersion() {
  const el = $('appVer');
  if (el) el.textContent = `v${VERSION}`;
}

// Data's About panel: the version and its date, and every version's changes folded away.
export function renderAbout() {
  const el = $('aboutPanel');
  if (!el) return;
  const now = CHANGES.find((c) => c.v === VERSION);
  el.replaceChildren(
    h('h3', { class: 'sub-title' }, 'About'),
    h('p', { class: 'note about-ver' }, `Run Hub v${VERSION}${now ? ` · ${dateText(now.date)}` : ''}`),
    h('details', { class: 'changelog' },
      h('summary', null, 'What changed in each version'),
      h('ol', { class: 'cl-list' }, CHANGES.map((c) => h('li', null,
        h('p', { class: 'cl-head' }, h('strong', null, `v${c.v}`), ` · ${dateText(c.date)}`),
        h('ul', null, c.items.map((t) => h('li', null, t)))))),
      h('p', { class: 'note' }, 'Earlier versions were not logged.')));
}
