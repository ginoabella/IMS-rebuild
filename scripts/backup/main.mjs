import {
  archiveRecoveryCapture,
  archiveRecoveryAudit,
} from './recovery-capture.mjs';
// No startup side effects on import; only explicit helper subcommands below.
import {
  archive,
  boundedFile,
  directory,
  digest,
  durable,
  syncDirectory,
} from './archive.mjs';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
process.umask(0o077);
let stage = 'validation';
try {
  const [command, a, b, c, captureId] = process.argv.slice(2);
  let operationId;
  if (
    process.argv.length !==
    (['archive-recovery', 'archive-recovery-audit'].includes(command) ? 7 : 6)
  )
    throw new Error();
  if (command === 'archive-recovery-audit') {
    stage = 'recovery_audit_archive';
    operationId = archiveRecoveryAudit(a, b, c, captureId);
  } else if (command === 'archive-recovery') {
    stage = 'recovery_capture_archive';
    operationId = archiveRecoveryCapture(a, b, c, captureId);
  } else if (command === 'archive') {
    stage = 'archive';
    operationId = archive(a, b, c);
  } else if (
    command === 'upload' ||
    command === 'check' ||
    command === 'check-data'
  ) {
    directory(a);
    directory(b);
    directory(c);
    const lock = join(c, 'repository.lock');
    mkdirSync(lock, { mode: 0o700 });
    try {
      stage = 'encrypted_input';
      const names = readdirSync(a);
      const archives = [];
      if (!names.length || names.length > 4096) throw new Error();
      for (const name of names) {
        if (!/^[0-9a-f-]{36}\.(age|json)$/.test(name)) throw new Error();
        if (name.endsWith('.json')) {
          const receipt = JSON.parse(boundedFile(join(a, name), 4096).bytes);
          if (
            receipt.archive !== name.replace(/json$/, 'age') ||
            receipt.operationId !== name.slice(0, 36)
          )
            throw new Error();
          const ciphertext = boundedFile(
            join(a, receipt.archive),
            402653184,
          ).bytes;
          if (
            !ciphertext
              .subarray(0, 22)
              .toString()
              .startsWith('age-encryption.org/v1') ||
            ciphertext.length !== receipt.bytes ||
            digest(ciphertext) !== receipt.sha256
          )
            throw new Error();
          archives.push({
            operationId: receipt.operationId,
            sha256: receipt.sha256,
            bytes: receipt.bytes,
          });
        } else if (!names.includes(name.replace(/age$/, 'json')))
          throw new Error();
      }
      stage = 'repository_custody';
      // Credentials are read from files inside the helper, absent from argv/Docker env.
      const location = boundedFile(join(b, 'repository.url'), 2048)
        .bytes.toString('utf8')
        .trim();
      const url = new URL(location.replace(/^rest:/, ''));
      if (
        !location.startsWith('rest:https://') ||
        url.hostname !== 'rest-server' ||
        url.port !== '8000' ||
        url.pathname !== '/uploader/' ||
        url.username !== 'uploader' ||
        !url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      boundedFile(join(b, 'repository.password'), 4096);
      boundedFile(join(b, 'ca.crt'), 65536, false);
      const args = [
        '--repository-file',
        join(b, 'repository.url'),
        '--password-file',
        join(b, 'repository.password'),
        '--cacert',
        join(b, 'ca.crt'),
        '--no-cache',
        '--json',
        '--retry-lock=0s',
      ];
      if (command === 'upload')
        args.push(
          'backup',
          '--host=myims-development',
          '--tag=myims-encrypted',
          a,
        );
      else {
        args.push('check');
        if (command === 'check-data') args.push('--read-data');
      }
      stage = 'repository_operation';
      // Clean environment, bounded output, sanitized failures; never print Restic diagnostics/URLs.
      const result = execFileSync('restic', args, {
        env: { PATH: process.env.PATH, HOME: '/tmp' },
        timeout: 540000,
        maxBuffer: 2097152,
        stdio: 'pipe',
      });
      const summary = result
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .findLast((row) => row.message_type === 'summary');
      if (
        command === 'upload' &&
        !/^[a-f0-9]{64}$/.test(summary?.snapshot_id ?? '')
      )
        throw new Error();
      operationId = randomUUID();
      durable(
        join(c, operationId + '.json'),
        JSON.stringify({
          operationId,
          command,
          archives,
          completedAt: new Date().toISOString(),
          snapshotId: summary?.snapshot_id ?? null,
          status: 'passed',
        }),
      );
      syncDirectory(c);
    } finally {
      rmSync(lock, { recursive: true });
    }
  } else throw new Error();
  console.log(JSON.stringify({ status: 'passed', stage, operationId }));
} catch {
  console.error(JSON.stringify({ status: 'failed', stage }));
  process.exitCode = 1;
}
