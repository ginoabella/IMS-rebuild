// Required before recovered-root provisioning writes. No provider calls or secrets.
import { protectedFile } from './protected-client.mjs';

export function recoveryCheckpoint(value, operationId, now = Date.now()) {
  const age = now - Date.parse(value?.verifiedAt);
  if (
    !value ||
    Object.keys(value).sort().join(',') !==
      'auditSha256,backupVerified,operationId,privilegeInventoryVerified,snapshotSha256,verifiedAt' ||
    value.operationId !== operationId ||
    value.backupVerified !== true ||
    value.privilegeInventoryVerified !== true ||
    !/^[a-f0-9]{64}$/.test(value.snapshotSha256 ?? '') ||
    !/^[a-f0-9]{64}$/.test(value.auditSha256 ?? '') ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 900000
  )
    throw new Error('Recovery checkpoint unverified');
  return true;
}

export function requireRecoveryCheckpoint(operationId) {
  const operation = JSON.parse(
    protectedFile('/recovery/recovery-started.json').toString('utf8'),
  );
  if (operationId !== undefined && operationId !== operation.operationId)
    throw new Error('Recovery operation mismatch');
  return recoveryCheckpoint(
    JSON.parse(
      protectedFile('/recovery/backup-verified.json').toString('utf8'),
    ),
    operation.operationId,
  );
}
