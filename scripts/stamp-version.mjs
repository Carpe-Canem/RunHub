// Usage: node scripts/stamp-version.mjs [version]
// Rewrites index.html so the import map lists every js/*.js at one version shared with the entry script and
// the stylesheet, and puts the import map's SHA-256 into the CSP. With no argument it keeps the current version.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const path = new URL('../index.html', import.meta.url);
let html = readFileSync(path, 'utf8');
const v = process.argv[2] || /src="js\/main\.js\?v=(\d+)"/.exec(html)[1];
const files = readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).sort();
const imports = Object.fromEntries(files.map((f) => [`./js/${f}`, `./js/${f}?v=${v}`]));
const text = `\n${JSON.stringify({ imports }, null, 2).replace(/^/gm, '  ')}\n  `;
const hash = createHash('sha256').update(text).digest('base64');

html = html.replace(/(<script type="importmap">)[\s\S]*?(<\/script>)/, () => `<script type="importmap">${text}</script>`)
  .replace(/src="js\/main\.js\?v=\d+"/, `src="js/main.js?v=${v}"`)
  .replace(/href="styles\.css\?v=\d+"/, `href="styles.css?v=${v}"`)
  .replace(/script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')?/, `script-src 'self' 'sha256-${hash}'`);
writeFileSync(path, html);
console.log(`index.html stamped at v=${v}, ${files.length} modules, sha256-${hash}`);
