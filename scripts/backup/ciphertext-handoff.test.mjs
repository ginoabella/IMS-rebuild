import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { handoffCiphertext } from './ciphertext-handoff.mjs';
const op = '11111111-1111-4111-8111-111111111111',
  id = '22222222-2222-4222-8222-222222222222';
function fixture(run) {
  const root = mkdtempSync(tmpdir() + '/myims-cipher-handoff-');
  const source = root + '/source',
    target = root + '/target';
  mkdirSync(source, { mode: 0o700 });
  mkdirSync(target, { mode: 0o700 });
  const cipher = Buffer.from('age-encryption.org/v1\nSYNTHETIC-CIPHERTEXT');
  const receipt = {
    format: 1,
    operationId: id,
    captureOperationId: op,
    archive: id + '.age',
    kind: 'bootstrap-post-install',
    bytes: cipher.length,
    sha256: createHash('sha256').update(cipher).digest('hex'),
  };
  writeFileSync(source + '/' + id + '.age', cipher, { mode: 0o600 });
  writeFileSync(source + '/' + id + '.json', JSON.stringify(receipt), {
    mode: 0o600,
  });
  const call = () =>
    handoffCiphertext(source, target, op, {
      source: process.getuid(),
      target: process.getuid(),
    });
  try {
    run({ source, target, call, receipt });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('copies only exact ciphertext pair, verifies binding and refuses replay', () =>
  fixture(({ source, target, call }) => {
    assert.equal(call().kind, 'bootstrap-post-install');
    assert.deepEqual(
      readFileSync(source + '/' + id + '.age'),
      readFileSync(target + '/' + id + '.age'),
    );
    assert.throws(call);
  }));
test('mismatched receipt, source symlink and broad custody refuse transfer', () => {
  fixture(({ source, call, receipt }) => {
    writeFileSync(
      source + '/' + id + '.json',
      JSON.stringify({ ...receipt, captureOperationId: id }),
    );
    assert.throws(call);
  });
  fixture(({ source, call }) => {
    rmSync(source + '/' + id + '.age');
    symlinkSync('/etc/passwd', source + '/' + id + '.age');
    assert.throws(call);
  });
  fixture(({ target, call }) => {
    chmodSync(target, 0o755);
    assert.throws(call);
  });
});
