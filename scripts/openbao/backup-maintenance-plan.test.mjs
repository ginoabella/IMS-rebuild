import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { backupMaintenancePlan } from './backup-maintenance-plan.mjs';
const review = JSON.parse(
  readFileSync(
    new URL(
      '../../docs/status/p3-u3a-captured-authority-review.json',
      import.meta.url,
    ),
  ),
);
test('exact remediation preserves historical bindings and separates rotation from installer', () => {
  const plan = backupMaintenancePlan(review);
  assert.equal(plan.privilegedPolicyRemediation.length, 3);
  for (const change of plan.privilegedPolicyRemediation) {
    assert.equal(
      createHash('sha256').update(change.body.policy).digest('hex'),
      change.policyUtf8Sha256,
    );
    assert.notEqual(change.policyUtf8Sha256, change.historicalPreStateSha256);
  }
  const paths = [...plan.rotation.policy.matchAll(/path "([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(paths.length, 7);
  assert.ok(
    paths.every(
      (p) =>
        p.startsWith(
          'auth/platform-backup/role/platform-raft-snapshot-reader/',
        ) ||
        [
          'auth/token/lookup-self',
          'auth/token/revoke-self',
          'sys/capabilities-self',
        ].includes(p),
    ),
  );
  assert.doesNotMatch(
    plan.rotation.policy,
    /sys\/policies|sys\/auth|myims-trunk|myims-endpoint|auth\/token\/create|users\//,
  );
  assert.equal(plan.retainedExecutionAuthorized, false);
  assert.equal(plan.rootRecoveryAuthorized, false);
  assert.equal(plan.activationAuthorized, false);
  assert.equal(plan.rotation.userConfiguration.token_explicit_max_ttl, 900);
  assert.deepEqual(plan.rotation.userConfiguration.token_policies, [
    'platform-backup-rotation',
  ]);
});
test('changed capture or generator baseline fails closed', () => {
  const changed = JSON.parse(JSON.stringify(review));
  changed.source.sha256 = '0'.repeat(64);
  assert.throws(() => backupMaintenancePlan(changed));
  const stale = JSON.parse(JSON.stringify(review));
  stale.policies.find(
    (p) => p.name === 'endpoint-restricted-issuer',
  ).expectedSha256 = '0'.repeat(64);
  assert.throws(() => backupMaintenancePlan(stale));
});
test('committed review artifact exactly reproduces the current generator', () => {
  const committed = JSON.parse(
    readFileSync(
      new URL(
        '../../docs/planning/p3-u3a-backup-maintenance-review.json',
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(committed, backupMaintenancePlan(review));
});
