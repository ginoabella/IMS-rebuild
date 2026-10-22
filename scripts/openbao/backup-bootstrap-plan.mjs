// Offline guarded-bootstrap preparation only. Importing or running cannot contact OpenBao.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const hash = (value) => createHash('sha256').update(value).digest('hex');
export function backupBootstrapPlan(route, maintenance, backup) {
  if (
    route.status !== 'read-only-review-complete' ||
    route.result?.state !== 'verified' ||
    route.result?.cleanup !== 'revoked_and_denial_confirmed' ||
    !route.helperAbsent ||
    !route.publicTrustTemporaryDirectoryRemoved ||
    route.result.routeReview.installerEstablished ||
    route.result.routeReview.roles.length !== 14 ||
    route.result.routeReview.roles.some(
      (r) => r.differentConfiguredFields.length,
    ) ||
    route.result.routeReview.policies.length !== 2 ||
    route.result.routeReview.policies.some(
      (p) => !p.matchesHistorical || p.matchesProposed,
    ) ||
    route.sourceSha256[
      'docs/planning/p3-u3a-backup-maintenance-review.json'
    ] !== hash(JSON.stringify(maintenance, null, 2) + '\n')
  )
    throw new Error(
      'Current route review does not support this exact bootstrap candidate',
    );
  const requiredDenied = [
    'sys/storage/raft/snapshot',
    'sys/policies/acl/platform-deployment-maintainer',
    'sys/policies/acl/platform-raft-snapshot-reader',
    'sys/auth/platform-backup',
    'auth/platform-backup/role/platform-raft-snapshot-reader',
    'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
    'sys/policies/acl/platform-backup-rotation',
    'auth/platform-custodian/users/platform-backup-maintainer',
  ];
  if (
    !requiredDenied.every(
      (p) =>
        JSON.stringify(
          route.result.routeReview.capabilities.find((c) => c.path === p)
            ?.observed,
        ) === '["deny"]',
    )
  )
    throw new Error('Changed authority needs reconciliation');
  const expectedBackup = [
    'sys/policies/acl/platform-raft-snapshot-reader',
    'sys/auth/platform-backup',
    'auth/platform-backup/role/platform-raft-snapshot-reader',
    'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
  ];
  if (
    JSON.stringify(backup.backupProvisioning.map((w) => w.path)) !==
      JSON.stringify(expectedBackup) ||
    hash(backup.backupProvisioning[0].body.policy) !==
      backup.backupProvisioning[0].policyUtf8Sha256
  )
    throw new Error('Changed snapshot installation candidate');
  const writes = [
    ...maintenance.privilegedPolicyRemediation.map((w) => ({
      ...w,
      precondition: 'exact-live-policy-hash-equals-historical-prestate',
    })),
    ...backup.backupProvisioning.map((w, i) => ({
      ...w,
      precondition:
        i < 3 ? 'target-absent-before-first-write' : 'new-exact-role-verified',
      ...(i === 3
        ? {
            protectedOutput:
              'Exclusive snapshot custody; SecretID/accessor never committed or printed',
          }
        : {}),
    })),
    {
      method: 'POST',
      path: 'sys/policies/acl/' + maintenance.rotation.policyName,
      body: { policy: maintenance.rotation.policy },
      policyUtf8Sha256: maintenance.rotation.policyUtf8Sha256,
      precondition: 'target-absent-before-first-write',
    },
    {
      method: 'POST',
      path: `auth/${maintenance.rotation.authMount}/users/${maintenance.rotation.username}`,
      bodyWithoutProtectedPassword: maintenance.rotation.userConfiguration,
      protectedInput:
        'Fresh separately custodied random password from protected file; no argv/environment/report',
      precondition: 'user-absent-and-existing-auth-mount-unchanged',
    },
  ];
  return {
    version: 1,
    status: 'guarded-bootstrap-preparation-not-executable',
    operator: 'gino',
    currentRouteReviewOperation: route.operationId,
    currentRouteVerifiedAt: route.finishedAt,
    rootRecoveryAuthorized: false,
    retainedExecutionAuthorized: false,
    timerActivationAuthorized: false,
    preservePrincipal: maintenance.preservePrincipal,
    writes,
    writesSha256: hash(JSON.stringify(writes)),
    rootGenerationMaximumAttempts: 1,
    maximumIsolationSeconds: 840,
    preChangeBackupMaximumAgeSeconds: 900,
    automaticMutationRetries: 0,
    prerequisites: [
      'new-operation-id-and-exclusive-fsynced-intent-before-any-provider-action',
      'current-source-native-integrated-controller-rehearsal-and-pinned-artifacts',
      'exact-current-provider-name-image-mounts-network-and-closed-prior-operation-label',
      'new-root-protected-staging-and-separate-output-custody',
      'independent-backup-age-key-seal-and-repository-custody-confirmed',
      'separate-exact-guarded-root-bootstrap-execution-authorization',
    ],
    sequence: [
      'arm-independent-deadline-before-isolation-and-unseal',
      'one-root-generation-attempt-in-isolated-helper-tmpfs',
      'review-complete-current-policies-role-aliases-user-mappings-and-identity-contributions',
      'capture-fresh-native-snapshot-and-independent-audit-before-any-provisioning-write',
      'encrypt-to-existing-public-recipient-network-disabled',
      'ciphertext-only-handoff-upload-to-existing-repository-and-read-only-retrieval-hash-verification',
      'recheck-freshness-guard-and-complete-target-prestate-before-first-write',
      'apply-nine-exact-writes-once-in-order-with-protected-credential-outputs',
      'native-issuance-parameter-and-lifetime-acceptance-and-snapshot-rotation-identity-denials',
      'finally-cancel-root-generation-revoke-root-confirm-403',
      'restore-normal-TLS-mounts-network-and-unseal-confirm-health-and-anonymous-generation-405',
      'cancel-guard-only-after-root-revocation-and-normal-restoration-then-restore-restart-policy',
      'encrypt-and-upload-separate-post-cleanup-audit-and-post-install-snapshot-with-new-scoped-identity',
    ],
    partialState:
      'On ambiguous write stop, preserve exact intent/prestate/acknowledgments; revoke root and restore protection. No automatic replay, deletion, rollback or extra root generation. Reconcile separately.',
    unresolvedBeforeExecution: [
      'integrated-controller-and-failure-rehearsal',
      'exact-operation-window-and-artifact-hashes',
      'new-private-staging-and-protected-output-handoff',
      'fresh-backup-and-full-root-only-prestate-gates-at-execution',
    ],
    exclusions: [
      'repository-initialization',
      'existing-custodian-account-change',
      'runtime-activation',
      'timer',
      'production',
      'pruning',
      'retained-restore',
      'application-postgresql-redis-asterisk-changes',
    ],
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
  process.stdout.write(
    JSON.stringify(
      backupBootstrapPlan(
        read('../../docs/status/p3-u3a-current-installer-route.json'),
        read('../../docs/planning/p3-u3a-backup-maintenance-review.json'),
        read(
          '../../docs/planning/p3-u3a-backup-installation-review-manifest.json',
        ),
      ),
      null,
      2,
    ) + '\n',
  );
}
