// Which view the address hash names. Parsing is pure; only startRouter() and current() touch the page.

export const VIEWS = ['hub', 'races', 'race', 'data'];

const HUB = () => ({ view: 'hub', id: null });
const ID = /^[A-Za-z0-9_-]{1,32}$/;

// Anything unknown, malformed or not enabled yet is the hub, so a stale link never shows a blank page.
export function parseHash(hash, enabled) {
  const parts = String(hash || '').replace(/^#/, '').split('/');
  const view = parts[0];
  if (!enabled.includes(view)) return HUB();
  if (view === 'race') return parts.length === 2 && ID.test(parts[1]) ? { view, id: parts[1] } : HUB();
  return parts.length === 1 ? { view, id: null } : HUB();
}

export function routeHref(view, id) {
  return id == null ? `#${view}` : `#${view}/${id}`;
}

let cur = HUB();
export const current = () => cur;

// Calls onRoute(route, previous) once now and again on every hash change.
export function startRouter({ enabled, onRoute }) {
  const read = () => {
    const prev = cur;
    cur = parseHash(location.hash, enabled);
    onRoute(cur, prev);
  };
  window.addEventListener('hashchange', read);
  cur = parseHash(location.hash, enabled);
  onRoute(cur, null);
}
