// Public source binding only. No provider, repository, key or ciphertext access.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const sha = /^[a-f0-9]{64}$/;
export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export const kinds = ['bootstrap-post-install', 'recovery-audit'];
export function validateRequest(value) {
  if (
    value?.format !== 1 ||
    value.purpose !== 'independent-post-install-archive-verification' ||
    !uuid.test(value.captureOperationId) ||
    !sha.test(value.repositoryId) ||
    !sha.test(value.snapshotId) ||
    !sha.test(value.sourceEvidenceSha256) ||
    !Number.isFinite(Date.parse(value.sourceCompletedAt)) ||
    !Array.isArray(value.archives) ||
    value.archives.length !== 2 ||
    new Set(value.archives.map((a) => a.archiveId)).size !== 2
  )
    throw new Error('Request refused');
  for (const [i, a] of value.archives.entries()) {
    if (
      a.kind !== kinds[i] ||
      !uuid.test(a.archiveId) ||
      !sha.test(a.sha256) ||
      !sha.test(a.receiptSha256) ||
      !Number.isSafeInteger(a.bytes) ||
      a.bytes <= 0 ||
      a.bytes > 402653184
    )
      throw new Error('Request refused');
  }
  return value;
}

export function requestFromEvidence(bytes) {
  const evidence = JSON.parse(bytes);
  const backup = evidence.postinstallBackup;
  if (
    evidence.status !== 'installed-and-both-backups-retrieved' ||
    ![
      'rootRevocationVerified',
      'normalRestorationVerified',
      'deadlineCancelled',
    ].every((k) => evidence[k] === true) ||
    backup?.status !== 'uploaded_ciphertext_retrieval_verified' ||
    backup.stage !== 'postinstall' ||
    backup.captureOperationId !== evidence.operationId ||
    backup.exactSnapshotFileCount !== 4 ||
    backup.repositoryWrites !== 0 ||
    backup.decryptionPerformed !== false ||
    backup.verified?.length !== 2 ||
    evidence.events?.at(-1)?.phase !== 'bootstrap_complete'
  )
    throw new Error('Evidence refused');
  return validateRequest({
    format: 1,
    purpose: 'independent-post-install-archive-verification',
    captureOperationId: evidence.operationId,
    repositoryId: backup.repositoryId,
    snapshotId: backup.snapshotId,
    sourceEvidenceSha256: digest(bytes),
    sourceCompletedAt: evidence.events.at(-1).at,
    archives: backup.verified.map((r, i) => ({
      archiveId: r.archiveId,
      kind: kinds[i],
      sha256: r.sha256,
      bytes: r.bytes,
      receiptSha256: r.receiptSha256,
    })),
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.length !== 3) throw new Error();
    process.stdout.write(
      JSON.stringify(
        requestFromEvidence(readFileSync(process.argv[2])),
        null,
        2,
      ) + '\n',
    );
  } catch {
    console.error(JSON.stringify({ status: 'verification-request-refused' }));
    process.exitCode = 1;
  }
}
