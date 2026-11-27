// Constants, guarded storage, shared state and date helpers. No DOM access while loading.

export const API = 'https://www.strava.com/api/v3';

export const TOKEN_URL = 'https://www.strava.com/oauth/token';

export const AUTH_URL = 'https://www.strava.com/oauth/authorize';

export const DEAUTH_URL = 'https://www.strava.com/oauth/deauthorize';

export const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

export const WINDOW = 90;            // Local Legend window, days

export const REACH_GAP = 3;          // "within reach" = this many efforts behind or fewer

export const LIMIT_15 = 90;          // stay under Strava's 100 reads / 15 min

export const LIMIT_DAY = 900;        // stay under Strava's 1,000 reads / day

export const HOT_MAX_AGE = 6 * 3600e3;

export const COLD_MAX_AGE = 24 * 3600e3;

export const MANUAL_MAX_AGE = 15 * 60e3;

export const DAY = 864e5;

export const Q = 15 * 60e3;

export const K = { creds: 'lw.creds', token: 'lw.token', state: 'lw.oauthState', probe: 'lw.probe', units: 'lw.units', ui: 'lw.ui' };

export const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// Display units: metres per unit. The choice lives in this browser only.
export const UNIT_M = { mi: 1609.344, km: 1000 };

export function units() { const u = store.get(K.units); return u === 'km' ? 'km' : 'mi'; }

export function setUnits(u) { return u in UNIT_M && store.set(K.units, u); }

export class UserError extends Error {}

export class RateLimited extends Error { constructor(until) { super('rate limited'); this.until = until; } }

export const S = {
  demo: false, cache: null, athleteId: null, syncing: false, progress: null,
  error: null, warn: null, pausedUntil: 0, resumeTimer: null, map: null, layers: {},
  probe: null, probeBusy: false, probeError: null,
};

export function dayOf(localIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(localIso || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : NaN;
}

export function todayIdx() { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY; }

export function weekStart(i) { return i - ((new Date(i * DAY).getUTCDay() + 6) % 7); }

export function dayLabel(i) { return new Date(i * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }); }

export function timeLabel(t) { return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }

export function ago(t) {
  const m = Math.round((Date.now() - t) / 60e3);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
}

export const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

export const fmt0 = (x) => Math.round(x).toLocaleString();

export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// The dim "all segments lit" backdrop for a clock readout: every digit becomes 8.
export const ghost = (text) => String(text).replace(/[0-9]/g, '8');

// Tiny event bus so data code can ask for a redraw without importing view code.
const listeners = {};
export const bus = {
  on(name, fn) { (listeners[name] || (listeners[name] = [])).push(fn); },
  emit(name) { for (const fn of listeners[name] || []) fn(); },
};
