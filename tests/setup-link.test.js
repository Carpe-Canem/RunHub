import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSetup, decodeSetup, sameAthlete } from '../js/setup-link.js';

const FIELDS = { clientId: '123456', clientSecret: 'secret-abc', refreshToken: 'refresh-xyz', athleteId: 42, scope: 'read,activity:read_all' };
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const RAW = { v: 1, i: '123456', s: 'secret-abc', r: 'refresh-xyz', a: 42, p: 'read' };

test('a code round-trips', () => {
  assert.deepEqual(decodeSetup(encodeSetup(FIELDS)), FIELDS);
});
test('the code is base64url of the short-key object and nothing else', () => {
  const code = encodeSetup({ ...FIELDS, clientSecret: 'secret-???>>>~~~' });   // bytes that give + and / in plain base64
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(Buffer.from(encodeSetup(FIELDS), 'base64url').toString()),
    { v: 1, i: '123456', s: 'secret-abc', r: 'refresh-xyz', a: 42, p: 'read,activity:read_all' });
});
test('decodeSetup takes a whole link or a bare code, with stray spaces', () => {
  const code = encodeSetup(FIELDS);
  assert.deepEqual(decodeSetup(`https://example.test/app/#setup=${code}`), FIELDS);
  assert.deepEqual(decodeSetup(`  #setup=${code}\n`), FIELDS);
  assert.deepEqual(decodeSetup(` ${code} `), FIELDS);
});
test('an athlete ID sent as digits comes back as a number', () => {
  assert.equal(decodeSetup(b64url({ ...RAW, a: '42' })).athleteId, 42);
});
test('decodeSetup returns null for garbage', () => {
  for (const x of [undefined, null, 42, '', '   ', 'abc', '%%%', '#setup=', 'https://example.test/#legends', Buffer.from('not json').toString('base64url'), b64url([1]), b64url('text'), b64url(null)])
    assert.equal(decodeSetup(x), null, String(x));
});
test('decodeSetup returns null for a wrong version', () => {
  assert.equal(decodeSetup(b64url({ ...RAW, v: 2 })), null);
  assert.equal(decodeSetup(b64url({ ...RAW, v: '1' })), null);
});
test('decodeSetup returns null when a field is missing, empty or the wrong type', () => {
  for (const k of ['i', 's', 'r', 'a', 'p']) {
    const gone = { ...RAW }; delete gone[k];
    assert.equal(decodeSetup(b64url(gone)), null, `missing ${k}`);
    assert.equal(decodeSetup(b64url({ ...RAW, [k]: '' })), null, `empty ${k}`);
    assert.equal(decodeSetup(b64url({ ...RAW, [k]: { x: 1 } })), null, `object ${k}`);
  }
  assert.equal(decodeSetup(b64url({ ...RAW, i: 'abc' })), null);   // a Client ID is a number
  assert.equal(decodeSetup(b64url({ ...RAW, a: 'me' })), null);
  assert.equal(decodeSetup(b64url({ ...RAW, a: 0 })), null);
});
test('sameAthlete compares numbers and digit strings', () => {
  assert.equal(sameAthlete(42, '42'), true); assert.equal(sameAthlete(42, 42), true);
  assert.equal(sameAthlete(42, 7), false); assert.equal(sameAthlete(null, null), false); assert.equal(sameAthlete(undefined, 42), false);
});
