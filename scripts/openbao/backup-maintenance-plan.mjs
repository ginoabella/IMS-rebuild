// Offline review artifact only. No credentials, provider requests or executor.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { provisioningPlan } from './provisioning-plan.mjs';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';
import { restrictedIssuanceRule } from './restricted-issuance-rule.mjs';
const digest = (text) => createHash('sha256').update(text).digest('hex');
const base = 'auth/platform-backup/role/platform-raft-snapshot-reader';
const rule = (path, capabilities) =>
  `path "${path}" { capabilities = ${JSON.stringify(capabilities)} }`;
export function backupMaintenancePlan(review) {
  const installations = [
    '58adb785-5384-41ce-9c72-ccda6ea554db',
    'fff38aad-2e3c-4149-aa3f-88f715d1b488',
  ];
  const provision = provisioningPlan({ version: 1, installations });
  const custodian = custodianSuccessionPlan('platform-owner-custodian');
  if (
    review?.source?.operationId !== '24096f3d-bf41-4ec2-9e12-95e2057c115d' ||
    review?.source?.sha256 !==
      '6336a674908adeb6dc6c098e81a79e31f1c7ea03b87d7b4f4f484082bf411ede'
  )
    throw new Error('Historical review binding mismatch');
  const policies = [
    ...provision.policies.filter((p) => p.name.endsWith('-restricted-issuer')),
    { name: custodian.policyName, policy: custodian.policy },
  ];
  const remediation = policies.map(({ name, policy }) => {
    const prior = review.policies?.find((p) => p.name === name);
    if (
      !prior ||
      prior.expectedSha256 !== digest(policy) ||
      !/^[a-f0-9]{64}$/.test(prior.capturedSha256) ||
      prior.comparison !== 'different-unresolved'
    )
      throw new Error('Policy comparison changed; reconcile before planning');
    return {
      method: 'POST',
      path: `sys/policies/acl/${name}`,
      historicalPreStateSha256: prior.capturedSha256,
      policyUtf8Sha256: digest(policy),
      body: { policy },
    };
  });
  const rotationRequest = { ttl: '720h', num_uses: '1000' };
  const policy = [
    rule(`${base}/role-id`, ['read']),
    restrictedIssuanceRule({
      name: 'unused',
      request: rotationRequest,
    }).replace('auth/token/create/unused', `${base}/secret-id`),
    ...['lookup', 'destroy'].map(
      (action) =>
        `path "${base}/secret-id-accessor/${action}" {
  capabilities = ["update"]
  required_parameters = ["secret_id_accessor"]
  allowed_parameters = { "secret_id_accessor" = [] }
}`,
    ),
    rule('auth/token/lookup-self', ['read']),
    rule('auth/token/revoke-self', ['update']),
    rule('sys/capabilities-self', ['update']),
  ].join('\n');
  return {
    version: 1,
    status: 'review-only-not-executable',
    operatingModelApproved: '2026-10-22 Asia/Manila (+08:00)',
    operator: 'gino',
    retainedExecutionAuthorized: false,
    historicalSource: review.source,
    preservePrincipal: custodian.username,
    privilegedPolicyRemediation: remediation,
    completeRoleConfigurationsToVerify: [
      ...provision.roles,
      ...custodian.issuerRoles,
    ].map(({ name, configuration, request }) => ({
      name,
      configuration,
      request,
    })),
    rotation: {
      policyName: 'platform-backup-rotation',
      policy,
      policyUtf8Sha256: digest(policy),
      username: 'platform-backup-maintainer',
      authMount: 'platform-custodian',
      userConfiguration: {
        ...custodian.userConfiguration,
        token_policies: ['platform-backup-rotation'],
      },
      issuancePath: `${base}/secret-id`,
      issuanceRequest: rotationRequest,
      roleIdPath: `${base}/role-id`,
      lookupPath: `${base}/secret-id-accessor/lookup`,
      retirementPath: `${base}/secret-id-accessor/destroy`,
      protectedPasswordRequired: true,
      replacementOrder: [
        'exclusive-protected-stage',
        'login-and-check-token-bounds-and-capabilities',
        'self-revoke-and-confirm-403',
        'atomic-credential-replacement',
        'retire-old-accessor',
        'verify-old-login-denied-without-automatic-retry',
      ],
      ambiguousResult:
        'Stop and preserve protected state; reconcile read-only before any repeat or retirement',
    },
    gates: [
      'current-complete-effective-authority-and-direct-installer',
      'fresh-backup-before-first-write-and-independent-audit',
      'exact-prestate-operation-window-hashes-and-partial-state-scope',
      'retained-native-lifetime-and-denial-acceptance',
      'fresh-independent-decryption-and-isolated-joint-postgresql-recovery-before-scheduling',
    ],
    activationAuthorized: false,
    rootRecoveryAuthorized: false,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const review = JSON.parse(
    readFileSync(
      new URL(
        '../../docs/status/p3-u3a-captured-authority-review.json',
        import.meta.url,
      ),
    ),
  );
  process.stdout.write(
    `${JSON.stringify(backupMaintenancePlan(review), null, 2)}\n`,
  );
}
