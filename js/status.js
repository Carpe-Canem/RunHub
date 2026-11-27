// The sync status in the top bar: what it says, to the eye and to a screen reader. Pure: no DOM.
import { ago, timeLabel } from './core.js';

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayText = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// s: {demo, connected, syncing, progress, error, pausedUntil, lastSync, warn, now}.
// text is the whole sentence. live is what a screen reader is told: it leaves out whatever changes by itself
// (the minutes since the last sync, the count during a sync), so each state is announced once. A sync from an
// earlier day is given with its date. label and day format a time and a date (replaced in tests).
export function statusOf(s, label = timeLabel, day = dayText) {
  if (s.demo) return { state: 'demo', text: 'Demo', live: 'Demo' };
  if (!s.connected) return { state: 'off', text: '', live: '' };
  if (s.syncing && s.progress) {
    const p = s.progress;
    return { state: 'sync', text: p.total ? `${p.label}: ${p.done} of ${p.total}` : `${p.label}…`, live: `${p.label}…` };
  }
  if (s.error) return { state: 'error', text: s.error, live: s.error };
  if (s.pausedUntil > s.now) {
    const text = `Paused for Strava's rate limit. Resumes at ${label(s.pausedUntil)} if this page is open.`;
    return { state: 'paused', text, live: text };
  }
  const warn = s.warn ? `. ${s.warn}` : '';
  if (!s.lastSync) return { state: 'idle', text: `Not synced yet${warn}`, live: `Not synced yet${warn}` };
  const at = `${sameDay(s.lastSync, s.now) ? '' : `${day(s.lastSync)} `}at ${label(s.lastSync)}`;
  return { state: 'idle', text: `Synced ${ago(s.lastSync, s.now)}${warn}`, live: `Synced ${at}${warn}` };
}

// The sync's labels, cut short so the row never overflows. statusOf's live text keeps the full one.
const SHORT = { 'Checking for new runs': 'Checking', 'Loading your runs': 'Loading runs', 'Scanning your race history': 'Scanning races', 'Reading race details': 'Races' };

// What the eye sees in the top bar, or null when not connected. s as for statusOf; st is its answer.
// dot: 'ok', 'warn', 'bad' or null. press: the row is the refresh button. note: a sentence for the second row,
// with its colour in tone ('warn' or 'bad'); a storage warning goes there, so the button's text stays short.
export function statusRow(s, st = statusOf(s)) {
  const row = (text, over) => ({ text, dot: null, arrow: false, press: false, note: null, tone: null, ...over });
  const press = { arrow: true, press: true };
  const note = (text, tone) => (text ? { note: text, tone } : {});
  switch (st.state) {
    case 'off': return null;
    case 'demo': return row(st.text);
    case 'sync': {
      const p = s.progress; const label = SHORT[p.label] || p.label;
      return row(p.total ? `${label}: ${p.done} of ${p.total}` : `${label}…`);
    }
    case 'error': return row('Retry', { dot: 'bad', ...press, ...note(st.text, 'bad') });
    case 'paused': return row('Paused', { dot: 'warn', ...note(st.text, 'warn') });
    default: return row(s.lastSync ? `Synced ${ago(s.lastSync, s.now)}` : 'Not synced yet',
      { dot: s.lastSync ? 'ok' : null, ...press, ...note(s.warn, 'warn') });
  }
}
