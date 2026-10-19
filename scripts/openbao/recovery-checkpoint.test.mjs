import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { recoveryCheckpoint } from './recovery-checkpoint.mjs';

test('backup gate requires exact operation, both verified checkpoints, digests and bounded age', () => {
  const operationId = randomUUID();
  const now = Date.now();
  const value = {
    operationId,
    backupVerified: true,
    privilegeInventoryVerified: true,
    snapshotSha256: 'a'.repeat(64),
    auditSha256: 'b'.repeat(64),
    verifiedAt: new Date(now).toISOString(),
  };
  assert.equal(recoveryCheckpoint(value, operationId, now), true);
  for (const changed of [
    null,
    { ...value, operationId: randomUUID() },
    { ...value, backupVerified: false },
    { ...value, privilegeInventoryVerified: false },
    { ...value, snapshotSha256: '' },
    { ...value, auditSha256: 'invalid' },
    { ...value, verifiedAt: new Date(now - 900001).toISOString() },
    { ...value, verifiedAt: new Date(now + 1).toISOString() },
    { ...value, unexpected: true },
  ])
    assert.throws(() => recoveryCheckpoint(changed, operationId, now));
});

test('manual backup refuses missing operation before root custody or network access', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/openbao/recovery-backup.mjs', randomUUID()],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(JSON.parse(result.stderr).stage, 'operation');
});
