// Offline-only capture packaging. No credentials, provider calls or inventory approval.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  boundedFile,
  directory,
  digest,
  encryptSet,
  jsonLines,
  LIMIT,
} from './archive.mjs';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';

export const CAPTURE_FILES = [
  'audit-configuration.json',
  'before.audit.json',
  'before.snapshot',
  'download-complete.json',
  'inventory-start.json',
  'inventory.json',
  'snapshot-integrity.json',
];
export function archiveRecoveryCapture(input, output, recipient, operationId) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId ?? ''))
    throw new Error('Invalid recovery capture');
  directory(input);
  if (readdirSync(input).sort().join(',') !== CAPTURE_FILES.join(','))
    throw new Error('Unexpected recovery capture members');
  const files = {};
  for (const name of CAPTURE_FILES) {
    const value = boundedFile(
      join(input, name),
      name === 'before.snapshot' || name === 'before.audit.json'
        ? LIMIT
        : 8388608,
    );
    if (value.stat.nlink !== 1 || value.bytes.length === 0)
      throw new Error('Invalid recovery capture file');
    files[name] = value.bytes;
  }
  const integrity = verifyRecoverySnapshot(files['before.snapshot']);
  const recorded = JSON.parse(files['snapshot-integrity.json']);
  const complete = JSON.parse(files['download-complete.json']);
  const inventory = JSON.parse(files['inventory.json']);
  const initial = JSON.parse(files['inventory-start.json']);
  const audit = JSON.parse(files['audit-configuration.json']);
  if (
    complete.operationId !== operationId ||
    inventory.operationId !== operationId ||
    initial.operationId !== operationId ||
    complete.snapshotSha256 !== integrity.snapshotSha256 ||
    recorded.snapshotSha256 !== integrity.snapshotSha256 ||
    recorded.index !== integrity.index ||
    recorded.term !== integrity.term ||
    complete.checkpoint !==
      'requires_offline_integrity_and_exact_privilege_review' ||
    Object.keys(audit.data ?? {}).join(',') !== 'endpoint/' ||
    audit.data['endpoint/'].type !== 'file' ||
    audit.data['endpoint/'].options?.file_path !== '/bao/audit/endpoint.json' ||
    audit.data['endpoint/'].options?.log_raw !== 'false' ||
    Object.hasOwn(inventory.self ?? {}, 'id') ||
    Object.hasOwn(initial.self ?? {}, 'id') ||
    files['before.audit.json'].at(-1) !== 10
  )
    throw new Error('Unverified recovery capture');
  jsonLines(files['before.audit.json']);
  return encryptSet(output, recipient, files, {
    kind: 'recovery-capture',
    captureOperationId: operationId,
    snapshotSha256: integrity.snapshotSha256,
    auditSha256: digest(files['before.audit.json']),
    effectiveAuthorityApproved: false,
    postgresRecoveryVerified: false,
  });
}

/** Independent full audit preservation after root cleanup; no cursor/rotation claim. */
export function archiveRecoveryAudit(input, output, recipient, operationId) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId ?? ''))
    throw new Error('Invalid recovery audit');
  directory(input);
  const audit = boundedFile(join(input, 'endpoint.json'));
  if (
    audit.stat.nlink !== 1 ||
    !audit.bytes.length ||
    audit.bytes.at(-1) !== 10
  )
    throw new Error('Invalid recovery audit');
  jsonLines(audit.bytes);
  return encryptSet(
    output,
    recipient,
    { 'audit.jsonl': audit.bytes },
    {
      kind: 'recovery-audit',
      captureOperationId: operationId,
      auditSha256: digest(audit.bytes),
      fullAuditCopy: true,
      rotationContinuityVerified: false,
    },
  );
}
