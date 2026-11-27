// The status strip in the top bar: what it says and what Ziggy does beside it. Pure: no DOM.
import { ago, timeLabel, fmt1 } from './core.js';

export const SEP = ' ■ ';

// s: {demo, connected, syncing, progress, error, pausedUntil, lastSync, warn, now}.
// text is drawn on the strip. live is what a screen reader is told: it leaves out whatever changes by itself
// (the minutes since the last sync, the count during a sync), so each state is announced once.
export function statusOf(s, label = timeLabel) {
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
  return { state: 'idle', text: `Synced ${ago(s.lastSync, s.now)}${warn}`, live: `Synced at ${label(s.lastSync)}${warn}` };
}

// next: {name, when} for the next start ("In 14 days", "Tomorrow", "Today"), or null. mi: from miles(), or null.
// At rest the strip carries the sync age, the next start and the week; otherwise the status text alone.
export function tickerText({ status, next, mi }) {
  if (status.state !== 'idle' && status.state !== 'demo') return status.text;
  const parts = [status.text];
  if (next) parts.push(`Next start: ${next.name}, ${next.when.toLowerCase()}`);
  if (mi) parts.push(`${fmt1(mi.week)} ${mi.unit === 'km' ? 'km' : 'miles'} this week`);
  return parts.join(SEP);
}

// Ziggy beside the strip: trots while syncing, sits when synced, naps when nothing is coming in.
export const tickerPose = (state) => (state === 'sync' ? 'trot' : state === 'idle' || state === 'demo' ? 'sit' : 'nap');

// How the strip is shown. wide: its text is wider than the strip; alert: an error or a pause; busy: a sync is
// showing its progress (every new count would start the scroll again, and the count is at the end of the line);
// still: the user stopped the scrolling; motion: motion is allowed. Moving text must be stoppable, so whenever
// it would scroll the strip is also the control that stops and restarts it.
export function stripMode({ wide, alert, busy, still, motion }) {
  const control = wide && !alert && !busy && motion;
  return { scroll: control && !still, control };
}
