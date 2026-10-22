// Disposable rehearsal only: fresh synthetic keys and payloads via stdin.
// No retained paths/configuration, network, provider or real owner key input.
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptSet, digest } from '../backup/archive.mjs';
import { archiveEntries } from './verify.mjs';

process.umask(0o077);
let work;
try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (
    input.fixtureOnly !== true ||
    Object.keys(input.files ?? {})
      .sort()
      .join(',') !== 'audit.jsonl,checkpoint.json,postgres.dump,snapshot.snap'
  )
    throw new Error();
  work = mkdtempSync(join(tmpdir(), 'joint-recovery-fixture-'));
  mkdirSync(work + '/encrypted', { mode: 0o700 });
  execFileSync('age-keygen', ['-o', work + '/identity'], { stdio: 'pipe' });
  writeFileSync(
    work + '/recipient',
    execFileSync('age-keygen', ['-y', work + '/identity']),
    { mode: 0o600 },
  );
  const files = Object.fromEntries(
    Object.entries(input.files).map(([n, b]) => [n, Buffer.from(b, 'base64')]),
  );
  const id = encryptSet(work + '/encrypted', work + '/recipient', files, {
    kind: 'joint-fixture-checkpoint',
    fixtureOnly: true,
  });
  const ciphertext = readFileSync(work + '/encrypted/' + id + '.age');
  const plain = execFileSync('age', ['-d', '-i', work + '/identity'], {
    input: ciphertext,
    timeout: 60000,
    maxBuffer: 268435456,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const entries = archiveEntries(plain, [
    'manifest.json',
    ...Object.keys(files),
  ]);
  const manifest = JSON.parse(entries.get('manifest.json'));
  if (
    manifest.operationId !== id ||
    manifest.fixtureOnly !== true ||
    manifest.kind !== 'joint-fixture-checkpoint' ||
    Object.keys(manifest.files).sort().join(',') !==
      Object.keys(files).sort().join(',')
  )
    throw new Error();
  for (const [n, b] of Object.entries(files))
    if (
      !entries.get(n).equals(b) ||
      manifest.files[n].bytes !== b.length ||
      manifest.files[n].sha256 !== digest(b)
    )
      throw new Error();
  // Only the private fixture driver receives these decrypted synthetic bytes.
  console.log(
    JSON.stringify({
      status: 'fixture-pair-encrypted-decrypted',
      ciphertextSha256: digest(ciphertext),
      files: Object.fromEntries(
        Object.keys(files).map((n) => [n, entries.get(n).toString('base64')]),
      ),
    }),
  );
  plain.fill(0);
  for (const b of entries.values()) b.fill(0);
} catch {
  console.error(
    JSON.stringify({ status: 'joint-fixture-archive-unconfirmed' }),
  );
  process.exitCode = 1;
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
}
