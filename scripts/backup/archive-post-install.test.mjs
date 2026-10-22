import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { digest } from './archive.mjs';
import { archivePostInstall } from './archive-post-install.mjs';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';
const op = '11111111-1111-4111-8111-111111111111';
test('post-install archive binds scoped snapshot integrity, token cleanup and operation without joint-store claim', () => {
  const root = mkdtempSync(tmpdir() + '/postinstall-test-'),
    input = root + '/input',
    output = root + '/output',
    bundle = root + '/bundle';
  for (const p of [input, output, bundle]) mkdirSync(p, { mode: 0o700 });
  try {
    writeFileSync(bundle + '/meta.json', '{"Index":1,"Term":1}');
    writeFileSync(bundle + '/state.bin', 'synthetic');
    writeFileSync(
      bundle + '/SHA256SUMS',
      ['meta.json', 'state.bin']
        .map((n) => digest(readFileSync(bundle + '/' + n)) + '  ' + n)
        .join('\n') + '\n',
    );
    writeFileSync(bundle + '/SHA256SUMS.sealed', 'synthetic');
    const bytes = execFileSync('tar', [
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
    const info = {
      operationId: op,
      ...verifyRecoverySnapshot(bytes),
      tokenCleanupConfirmed: true,
      capturedAt: new Date().toISOString(),
    };
    writeFileSync(input + '/' + op + '.snap', bytes, { mode: 0o600 });
    writeFileSync(input + '/' + op + '.json', JSON.stringify(info), {
      mode: 0o600,
    });
    execFileSync('age-keygen', ['-o', root + '/identity'], { stdio: 'pipe' });
    writeFileSync(
      root + '/recipient',
      execFileSync('age-keygen', ['-y', root + '/identity']),
    );
    const id = archivePostInstall(input, output, root + '/recipient', op);
    const receipt = JSON.parse(readFileSync(output + '/' + id + '.json'));
    assert.equal(receipt.kind, 'bootstrap-post-install');
    assert.equal(receipt.captureOperationId, op);
    const plain = execFileSync('age', [
      '-d',
      '-i',
      root + '/identity',
      output + '/' + id + '.age',
    ]);
    const manifest = JSON.parse(
      execFileSync('tar', ['-xzOf', '-', 'manifest.json'], { input: plain }),
    );
    assert.equal(manifest.jointPostgresRecoveryEstablished, false);
    writeFileSync(
      input + '/' + op + '.json',
      JSON.stringify({ ...info, tokenCleanupConfirmed: false }),
    );
    assert.throws(() =>
      archivePostInstall(input, output, root + '/recipient', op),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
