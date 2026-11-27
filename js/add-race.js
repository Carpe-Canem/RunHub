// The Add race sheet: a small dialog on the page body (so redraws never remove it) that adds a hand-made
// upcoming race. Same pattern as the full-screen course map: the rest of the page is inert while it is open.
import { h } from './dom.js';
import { S, bus } from './core.js';
import { CLASS_OPTIONS, isoDay, checkHand } from './upcoming.js';
import { addHand, NOT_SAVED } from './upcoming-sync.js';

let sheet = null;   // { el, onKey, opener, scroll, inert }

export function closeAddSheet() { close(false); }

function close(refocus) {
  if (!sheet) return;
  const d = sheet;
  sheet = null;
  document.removeEventListener('keydown', d.onKey, true);
  d.el.remove();
  document.body.style.overflow = d.scroll;
  for (const n of d.inert) n.inert = false;
  if (refocus && d.opener && d.opener.isConnected) d.opener.focus();
}

export function openAddSheet(opener) {
  if (sheet) return;
  const field = (label, input) => h('label', null, label, input);
  const name = h('input', { name: 'n', type: 'text', maxlength: '80', required: true, autocomplete: 'off', placeholder: 'Riverbend 10K' });
  const date = h('input', { name: 'date', type: 'date', required: true, min: isoDay(new Date()) });
  const time = h('input', { name: 'time', type: 'time' });
  const cls = h('select', { name: 'cls' },
    h('option', { value: '' }, 'From the name'),
    CLASS_OPTIONS.map((c) => h('option', { value: c }, c)));
  const place = h('input', { name: 'place', type: 'text', maxlength: '60', autocomplete: 'off' });
  const err = h('p', { class: 'error', role: 'alert', hidden: true });
  const add = h('button', { type: 'submit', class: 'btn primary' }, 'Add race');
  const cancel = h('button', { type: 'button', class: 'btn', onclick: () => close(true) }, 'Cancel');
  const form = h('form', { class: 'connect sheet-form', novalidate: true },
    h('h2', { class: 'sheet-title' }, 'Add race'),
    field('Name', name),
    field('Date', date),
    field('Start time (optional)', time),
    field('Distance', cls),
    field('Place (optional)', place),
    err,
    h('div', { class: 'row end' }, cancel, add));
  const showError = (msg) => { err.textContent = msg; err.hidden = false; };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (add.disabled) return;
    add.disabled = true;
    err.hidden = true;
    try {
      const res = checkHand({ n: name.value, date: date.value, time: time.value, cls: cls.value, place: place.value }, isoDay(new Date()), S.upcoming ? S.upcoming.hand : []);
      if (res.error) { showError(res.error); return; }
      const hand = addHand(res.race);
      if (!hand) { showError(NOT_SAVED); return; }
      const op = sheet && sheet.opener;
      close(false);
      bus.emit('data');
      const row = document.querySelector(`[data-focus="up-${hand.id}"]`);
      if (row) row.focus();
      else if (op && op.isConnected) op.focus();
    } finally {
      add.disabled = false;
    }
  });

  const el = h('div', { class: 'sheet-back' },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Add race' }, form));
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } };
  const inert = [...document.body.children].filter((n) => !n.inert);
  sheet = { el, onKey, opener, scroll: document.body.style.overflow, inert };
  for (const n of inert) n.inert = true;
  document.body.style.overflow = 'hidden';
  document.body.append(el);
  document.addEventListener('keydown', onKey, true);
  name.focus();
}
