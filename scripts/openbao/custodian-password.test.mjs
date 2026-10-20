import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { parseCustodianPassword } from './custodian-password.mjs';

test('raw and single LF/CRLF framing yield identical synthetic password without changing input', () => {
  for (const value of [
    randomBytes(32).toString('base64url'),
    randomBytes(48).toString('base64url'),
    'A'.repeat(128),
  ]) {
    for (const ending of ['', '\n', '\r\n']) {
      const bytes = Buffer.from(value + ending);
      const original = Buffer.from(bytes);
      assert.equal(parseCustodianPassword(bytes), value);
      assert.deepEqual(bytes, original);
    }
  }
});
test('reject malformed/multiline/whitespace/non-ASCII and out-of-bounds credentials', () => {
  const value = 'A'.repeat(43);
  for (const invalid of [
    '',
    'A'.repeat(42),
    'A'.repeat(129),
    value + '\r',
    value + '\n\n',
    value + '\r\n\r\n',
    '\n' + value,
    ' ' + value,
    value + ' ',
    value + '\t',
    value + '\nB',
    value + '\0',
    value + '=',
    value + '\u00e9',
    '\ufeff' + value,
    'A'.repeat(42) + '\n',
    'A'.repeat(129) + '\n',
  ]) {
    assert.throws(
      () => parseCustodianPassword(Buffer.from(invalid)),
      /Invalid protected input/,
    );
  }
  assert.throws(() =>
    parseCustodianPassword(
      Buffer.concat([Buffer.from(value), Buffer.from([255])]),
    ),
  );
  assert.throws(() => parseCustodianPassword(value));
});
