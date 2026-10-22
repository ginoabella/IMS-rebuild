// Network-disabled post-install snapshot packaging. No token, seal or joint-store claim.
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { boundedFile, directory, encryptSet } from './archive.mjs';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';
export function archivePostInstall(input, output, recipient, operation) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operation))
    throw new Error('Post-install operation refused');
  directory(input);
  const names = readdirSync(input).sort();
  if (
    names.length !== 2 ||
    !/^[a-f0-9-]{36}\.json$/.test(names[0]) ||
    names[1] !== names[0].replace('.json', '.snap')
  )
    throw new Error('Post-install files refused');
  const receipt = boundedFile(input + '/' + names[0], 16384).bytes;
  const info = JSON.parse(receipt);
  const snapshot = boundedFile(input + '/' + names[1], 134217728).bytes;
  const verified = verifyRecoverySnapshot(snapshot);
  if (
    info.operationId !== names[0].slice(0, 36) ||
    info.tokenCleanupConfirmed !== true ||
    !Number.isFinite(Date.parse(info.capturedAt)) ||
    Object.keys(verified).some((k) => info[k] !== verified[k])
  )
    throw new Error('Post-install integrity refused');
  const priorMask = process.umask(0o077);
  try {
    return encryptSet(
      output,
      recipient,
      { 'snapshot.snap': snapshot, 'snapshot-receipt.json': receipt },
      {
        kind: 'bootstrap-post-install',
        captureOperationId: operation,
        jointPostgresRecoveryEstablished: false,
      },
    );
  } finally {
    process.umask(priorMask);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 6) throw new Error();
    console.log(
      JSON.stringify({
        status: 'post-install-encrypted',
        operationId: archivePostInstall(...process.argv.slice(2)),
      }),
    );
  } catch {
    console.error(
      JSON.stringify({ status: 'post-install-encryption-refused' }),
    );
    process.exitCode = 1;
  }
}
