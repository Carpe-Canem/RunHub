// Setup link: the keys and refresh token packed into the part of an address after the #,
// which browsers never send to a site. Pure functions, no storage and no network.

const MARK = '#setup=';

const text = (v) => typeof v === 'string' && v !== '';

function toBase64Url(str) {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (code.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function encodeSetup(f) {
  return toBase64Url(JSON.stringify({ v: 1, i: f.clientId, s: f.clientSecret, r: f.refreshToken, a: f.athleteId, p: f.scope }));
}

// Accepts a whole link or just the code. Returns null for anything that is not a complete version-1 code.
export function decodeSetup(input) {
  if (typeof input !== 'string') return null;
  let code = input.trim();
  const at = code.indexOf(MARK);
  if (at >= 0) code = code.slice(at + MARK.length).trim();
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let o;
  try { o = JSON.parse(fromBase64Url(code)); } catch { return null; }
  if (!o || typeof o !== 'object' || o.v !== 1) return null;
  if (!text(o.i) || !/^\d+$/.test(o.i) || !text(o.s) || !text(o.r) || !text(o.p)) return null;
  const a = typeof o.a === 'string' && /^\d+$/.test(o.a) ? Number(o.a) : o.a;
  if (!Number.isSafeInteger(a) || a <= 0) return null;
  return { clientId: o.i, clientSecret: o.s, refreshToken: o.r, athleteId: a, scope: o.p };
}

// Athlete IDs arrive as numbers from Strava and may be strings elsewhere.
export const sameAthlete = (a, b) => a != null && b != null && String(a) === String(b);
