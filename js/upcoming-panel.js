// Data page: export and import of hand-added races. The export text is built when asked for and kept nowhere.
import { S, bus } from './core.js';
import { $, h } from './dom.js';
import { token } from './strava.js';
import { upcomingRows, importHand } from './upcoming-sync.js';
import { exportUpcoming } from './upcoming.js';

export const standalone = () => navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

let exportOpen = false, pasted = '', result = null;
// The two text boxes are made once and kept: the panel is redrawn on every 'data' event (every few seconds during
// a sync), and a new box would lose focus, the paste menu and a selection.
let exportTa = null, importTa = null;

// Also empties the kept boxes, so no race text stays in the page after leaving Data or wiping.
export function hideExport() {
  exportOpen = false; pasted = ''; result = null;
  if (exportTa) exportTa.value = '';
  if (importTa) importTa.value = '';
}

const handRows = () => upcomingRows().filter((r) => r.src === 'hand');
const plural = (n) => `${n} race${n === 1 ? '' : 's'}`;

export function resultLine(r) {
  if (r.error) return r.error;
  const parts = [];
  if (r.added) parts.push(`Added ${r.added}`);
  if (r.dup) parts.push(`${r.dup} already here`);
  if (r.past) parts.push(`${r.past} already finished`);
  if (r.bad) parts.push(`${r.bad} could not be read`);
  if (!parts.length) return 'Nothing new to add';
  return parts.join(', ');
}

// Offer used by "Forget this browser": open Data with the export showing.
export function showExport() {
  exportOpen = true;
  bus.emit('data');
  // The route may still be changing to Data, so look again once it has.
  setTimeout(() => { const el = $('upPanel'); if (el && !el.hidden) el.scrollIntoView({ block: 'start' }); }, 80);
}

function exportBox(rows) {
  const text = exportUpcoming(rows);
  const copy = async (ev) => {
    const b = ev.currentTarget;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; }
    catch { b.textContent = 'Select the text below and copy'; }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'run-hub-races.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  exportTa = exportTa || h('textarea', { class: 'probe-text', id: 'upExportText', readonly: true, 'aria-label': 'Your hand-added races as text' });
  if (exportTa.value !== text) exportTa.value = text;
  return [
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', id: 'upCopyBtn', onclick: copy }, 'Copy'),
      standalone() ? null : h('button', { type: 'button', class: 'btn small', id: 'upDownloadBtn', onclick: download }, 'Download file'),
      h('button', { type: 'button', class: 'btn small', id: 'upHideBtn', onclick: () => { exportOpen = false; bus.emit('data'); } }, 'Hide')),
    exportTa,
  ];
}

function importBox() {
  const run = (text) => {
    result = importHand(text);
    if (!result.error) pasted = '';
    bus.emit('data');
  };
  importTa = importTa || h('textarea', { class: 'probe-text', id: 'upImportText', 'aria-label': 'Paste an export here', placeholder: 'Paste an export here', oninput: (ev) => { pasted = ev.currentTarget.value; } });
  const ta = importTa;
  if (ta.value !== pasted) ta.value = pasted;
  const pick = async (ev) => {
    const input = ev.currentTarget;
    const f = input.files && input.files[0];
    if (!f) return;
    let text;
    try { text = f.size > 400000 ? ' '.repeat(200001) : await f.text(); } catch { text = ''; }
    input.value = '';
    run(text);
  };
  return [
    ta,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', id: 'upImportBtn', onclick: () => run(ta.value) }, 'Import'),
      h('label', { class: 'btn small filebtn' }, 'Choose a file',
        h('input', { type: 'file', id: 'upFileInput', accept: '.json,application/json', 'aria-label': 'Choose an export file', onchange: pick }))),
    result ? h('p', { class: result.error ? 'error' : 'note', role: 'status' }, resultLine(result)) : h('p', { role: 'status', class: 'note' }),
  ];
}

export function renderUpcomingPanel() {
  const el = $('upPanel');
  if (!el) return;
  el.hidden = S.demo || !token() || !S.upcoming;
  if (el.hidden) { el.replaceChildren(); return; }
  const rows = handRows();
  const had = el.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : null;
  place(el, [
    h('h3', { class: 'sub-title' }, 'Races you added'),
    h('p', { class: 'note' }, `${plural(rows.length)} added in this browser. They are kept only here. Export them to move them to another browser or the home-screen app.`),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', id: 'upExportBtn', disabled: !rows.length, onclick: () => { exportOpen = true; bus.emit('data'); } }, 'Export')),
    ...(exportOpen && rows.length ? exportBox(rows) : clearExport()),
    h('h3', { class: 'sub-title' }, 'Import'),
    ...importBox()]);
  if (had && document.activeElement.id !== had) { const f = document.getElementById(had); if (f) f.focus(); }
}

function clearExport() { if (exportTa) exportTa.value = ''; return []; }

// Like replaceChildren, but a node that is already in place is never taken out, so a kept text box keeps focus.
function place(el, nodes) {
  for (const c of [...el.childNodes]) if (!nodes.includes(c)) c.remove();
  nodes.forEach((n, i) => { if (el.childNodes[i] !== n) el.insertBefore(n, el.childNodes[i] || null); });
}
