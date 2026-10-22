import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { backupBootstrapPlan } from './backup-bootstrap-plan.mjs';
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const route = read('../../docs/status/p3-u3a-current-installer-route.json');
const maintenance = read(
  '../../docs/planning/p3-u3a-backup-maintenance-review.json',
);
const backup = read(
  '../../docs/planning/p3-u3a-backup-installation-review-manifest.json',
);
const copy = (x) => JSON.parse(JSON.stringify(x));
test('nine exact writes keep password and issued credentials out of the review artifact', () => {
  const p = backupBootstrapPlan(route, maintenance, backup);
  assert.equal(p.writes.length, 9);
  assert.equal(p.rootRecoveryAuthorized, false);
  assert.equal(p.retainedExecutionAuthorized, false);
  assert.equal(p.timerActivationAuthorized, false);
  assert.equal(p.rootGenerationMaximumAttempts, 1);
  assert.equal(p.automaticMutationRetries, 0);
  assert.ok(
    !Object.hasOwn(p.writes[8].bodyWithoutProtectedPassword, 'password'),
  );
  assert.equal(
    p.writes[6].path,
    'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
  );
  assert.equal(p.writes[7].path, 'sys/policies/acl/platform-backup-rotation');
  assert.equal(
    p.writes[8].path,
    'auth/platform-custodian/users/platform-backup-maintainer',
  );
  assert.deepEqual(
    p,
    read('../../docs/planning/p3-u3a-guarded-bootstrap-preparation.json'),
  );
});
test('unconfirmed cleanup, changed authority, role drift or policy baseline cannot produce bootstrap plan', () => {
  const changes = [
    (r) => {
      r.helperAbsent = false;
    },
    (r) => {
      r.result.cleanup = 'uncertain';
    },
    (r) => {
      r.result.routeReview.capabilities.find(
        (c) => c.path === 'sys/auth/platform-backup',
      ).observed = ['update'];
    },
    (r) => {
      r.result.routeReview.roles[0].differentConfiguredFields.push('orphan');
    },
    (r) => {
      r.result.routeReview.policies[0].matchesHistorical = false;
    },
    (r) => {
      r.sourceSha256['docs/planning/p3-u3a-backup-maintenance-review.json'] =
        '0'.repeat(64);
    },
  ];
  for (const change of changes) {
    const r = copy(route);
    change(r);
    assert.throws(() => backupBootstrapPlan(r, maintenance, backup));
  }
  const b = copy(backup);
  b.backupProvisioning[0].body.policy += '\n';
  assert.throws(() => backupBootstrapPlan(route, maintenance, b));
});
