import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8').replaceAll('\r\n', '\n'); // browsers read CRLF as LF
const mapMatch =/<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)[1];
const EXPECTED_CSP = "default-src 'none'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://tile.openstreetmap.org https://basemaps.cartocdn.com https://cdnjs.cloudflare.com; connect-src https://www.strava.com https://archive-api.open-meteo.com https://nominatim.openstreetmap.org; font-src 'self'; base-uri 'none'; form-action 'none'; manifest-src 'self'";

test('every module is in the import map at the entry script\'s version', () => {
  assert.ok(mapMatch, 'index.html has an import map');
  const v = /src="js\/main\.js\?v=(\d+)"/.exec(html)[1];
  assert.equal(/href="styles\.css\?v=(\d+)"/.exec(html)[1], v, 'stylesheet and entry script share a version');
  const want = Object.fromEntries(readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js')).sort()
    .map((f) => [`./js/${f}`, `./js/${f}?v=${v}`]));
  assert.deepEqual(JSON.parse(mapMatch[1]).imports, want);
});

test('the import map comes before the entry script', () => {
  assert.ok(mapMatch.index < html.indexOf('<script type="module"'));
});

test('the CSP allows the import map by hash', () => {
  const hash = createHash('sha256').update(mapMatch[1]).digest('base64');
  const scriptSrc = /script-src ([^;]*)/.exec(csp)[1].split(' ');
  assert.ok(scriptSrc.includes(`'sha256-${hash}'`), `script-src lacks 'sha256-${hash}'`);
});

test('the CSP is the expected policy plus the hash', () => {
  assert.equal(csp.replace(/ 'sha256-[A-Za-z0-9+/=]+'/, ''), EXPECTED_CSP);
});

test('the changelog leads with the stamped version, newest first, each with something in it', async () => {
  const { CHANGES, versionOf } = await import('../js/version.js');
  const v = /src="js\/main\.js\?v=(\d+)"/.exec(html)[1];
  assert.equal(CHANGES[0].v, v, 'add an entry to CHANGES in js/version.js for this version');
  CHANGES.forEach((c, i) => {
    assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(c.items.length > 0);
    if (i) assert.ok(+CHANGES[i - 1].v > +c.v, `v${c.v} is out of order`);
  });
  assert.equal(versionOf('https://x.test/js/version.js?v=50'), '50');
  assert.equal(versionOf('https://x.test/js/version.js'), 'dev');
});

test('Up next folds only when at least two races would be hidden', async () => {
  const { upShown, UP_FIRST } = await import('../js/races-view.js');
  assert.equal(UP_FIRST, 3);
  assert.equal(upShown(0, false), 0);
  assert.equal(upShown(3, false), 3);
  assert.equal(upShown(4, false), 4);
  assert.equal(upShown(6, false), 3);
  assert.equal(upShown(6, true), 6);
});
