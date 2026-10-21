// Offline synthetic captures; no provider/key/token access or authority approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
  symlinkSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  archiveRecoveryCapture,
  archiveRecoveryAudit,
  CAPTURE_FILES,
} from './recovery-capture.mjs';
import { digest } from './archive.mjs';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';
process.umask(0o077);
const operationId = '00000000-0000-4000-8000-000000000001';
function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'myims-capture-test-'));
  const input = join(root, 'capture'),
    output = join(root, 'encrypted'),
    bundle = join(root, 'bundle');
  for (const path of [input, output, bundle]) mkdirSync(path, { mode: 0o700 });
  try {
    for (const [name, value] of Object.entries({
      'meta.json': '{"Index":1,"Term":1}',
      'state.bin': 'synthetic-raft-state',
    }))
      writeFileSync(join(bundle, name), value);
    writeFileSync(
      join(bundle, 'SHA256SUMS'),
      ['meta.json', 'state.bin']
        .map((name) => digest(readFileSync(join(bundle, name))) + '  ' + name)
        .join('\n') + '\n',
    );
    writeFileSync(
      join(bundle, 'SHA256SUMS.sealed'),
      'synthetic-sealed-presence',
    );
    const snapshot = execFileSync('tar', [
      '--format=ustar',
      '-czf',
      '-',
      '-C',
      bundle,
      'meta.json',
      'state.bin',
      'SHA256SUMS',
      'SHA256SUMS.sealed',
    ]);
    const integrity = verifyRecoverySnapshot(snapshot);
    const files = {
      'before.snapshot': snapshot,
      'before.audit.json': '{"type":"request","fixture":true}\n',
      'snapshot-integrity.json': JSON.stringify(integrity),
      'download-complete.json': JSON.stringify({
        operationId,
        snapshotSha256: digest(snapshot),
        checkpoint: 'requires_offline_integrity_and_exact_privilege_review',
      }),
      'inventory-start.json': JSON.stringify({ operationId }),
      'inventory.json': JSON.stringify({
        operationId,
        policies: { synthetic: { policy: 'fixture' } },
      }),
      'audit-configuration.json': JSON.stringify({
        data: {
          'endpoint/': {
            type: 'file',
            options: {
              file_path: '/bao/audit/endpoint.json',
              log_raw: 'false',
            },
          },
        },
      }),
    };
    for (const [name, value] of Object.entries(files))
      writeFileSync(join(input, name), value, { mode: 0o600 });
    const key = join(root, 'identity'),
      recipient = join(root, 'recipient');
    execFileSync('age-keygen', ['-o', key], { stdio: 'pipe' });
    writeFileSync(recipient, execFileSync('age-keygen', ['-y', key]));
    action({ root, input, output, key, recipient });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('complete capture survives encryption/decryption with exact membership, hashes and pending authority', () =>
  fixture(({ input, output, key, recipient }) => {
    const id = archiveRecoveryCapture(input, output, recipient, operationId);
    const decrypted = execFileSync('age', [
      '-d',
      '-i',
      key,
      join(output, id + '.age'),
    ]);
    const manifest = JSON.parse(
      execFileSync('tar', ['-xzOf', '-', 'manifest.json'], {
        input: decrypted,
      }),
    );
    assert.deepEqual(Object.keys(manifest.files).sort(), CAPTURE_FILES);
    assert.equal(manifest.captureOperationId, operationId);
    assert.equal(manifest.effectiveAuthorityApproved, false);
    assert.equal(manifest.postgresRecoveryVerified, false);
    for (const name of CAPTURE_FILES) {
      const value = execFileSync('tar', ['-xzOf', '-', name], {
        input: decrypted,
      });
      assert.deepEqual(value, readFileSync(join(input, name)));
      assert.equal(digest(value), manifest.files[name].sha256);
    }
    const receipt = JSON.parse(readFileSync(join(output, id + '.json')));
    assert.equal(receipt.captureOperationId, operationId);
    assert.equal(
      receipt.sha256,
      digest(readFileSync(join(output, id + '.age'))),
    );
  }));
for (const fault of [
  'wrong-operation',
  'snapshot-corrupt',
  'incomplete-audit',
  'unexpected-token',
  'symlink',
  'missing-inventory',
  'wrong-audit-path',
]) {
  test('capture rejects ' + fault + ' before ciphertext commit', () =>
    fixture(({ root, input, output, recipient }) => {
      if (fault === 'snapshot-corrupt')
        writeFileSync(join(input, 'before.snapshot'), 'invalid');
      if (fault === 'incomplete-audit')
        writeFileSync(join(input, 'before.audit.json'), '{"partial":');
      if (fault === 'unexpected-token')
        writeFileSync(
          join(input, 'custodian.token'),
          'synthetic-not-for-archive',
        );
      if (fault === 'missing-inventory') rmSync(join(input, 'inventory.json'));
      if (fault === 'symlink') {
        renameSync(join(input, 'inventory.json'), join(root, 'inventory'));
        symlinkSync(join(root, 'inventory'), join(input, 'inventory.json'));
      }
      if (fault === 'wrong-audit-path')
        writeFileSync(
          join(input, 'audit-configuration.json'),
          '{"data":{"endpoint/":{"type":"file","options":{"file_path":"/wrong","log_raw":"false"}}}}',
        );
      assert.throws(() =>
        archiveRecoveryCapture(
          input,
          output,
          recipient,
          fault === 'wrong-operation'
            ? '00000000-0000-4000-8000-000000000099'
            : operationId,
        ),
      );
      assert.deepEqual(readdirSync(output), []);
    }),
  );
}

test('post-cleanup audit is independently encrypted and does not claim rotation acceptance', () =>
  fixture(({ root, output, key, recipient }) => {
    const audit = join(root, 'audit');
    mkdirSync(audit, { mode: 0o700 });
    writeFileSync(
      join(audit, 'endpoint.json'),
      '{"type":"response","cleanup":true}\n',
      { mode: 0o600 },
    );
    const id = archiveRecoveryAudit(audit, output, recipient, operationId);
    const decrypted = execFileSync('age', [
      '-d',
      '-i',
      key,
      join(output, id + '.age'),
    ]);
    const manifest = JSON.parse(
      execFileSync('tar', ['-xzOf', '-', 'manifest.json'], {
        input: decrypted,
      }),
    );
    assert.equal(manifest.kind, 'recovery-audit');
    assert.equal(manifest.rotationContinuityVerified, false);
    assert.equal(manifest.captureOperationId, operationId);
    assert.deepEqual(
      execFileSync('tar', ['-xzOf', '-', 'audit.jsonl'], { input: decrypted }),
      readFileSync(join(audit, 'endpoint.json')),
    );
    assert.equal(
      JSON.parse(readFileSync(join(output, id + '.json'))).captureOperationId,
      operationId,
    );
  }));
