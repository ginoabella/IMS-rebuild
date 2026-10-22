// Offline comparison only. This is deliberately not an ACL evaluator or executor.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { provisioningPlan } from './provisioning-plan.mjs';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';

export const captureBinding = Object.freeze({
  operationId: '24096f3d-bf41-4ec2-9e12-95e2057c115d',
  sha256: '6336a674908adeb6dc6c098e81a79e31f1c7ea03b87d7b4f4f484082bf411ede',
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
const installations = [
  '58adb785-5384-41ce-9c72-ccda6ea554db',
  'fff38aad-2e3c-4149-aa3f-88f715d1b488',
];
const same = (a, b) =>
  JSON.stringify(Array.isArray(a) ? [...a].sort() : a) ===
  JSON.stringify(Array.isArray(b) ? [...b].sort() : b);

export function reviewCapturedAuthority(bytes, binding = captureBinding) {
  if (hash(bytes) !== binding.sha256)
    throw new Error('Capture digest mismatch');
  const inventory = JSON.parse(bytes);
  if (inventory.operationId !== binding.operationId)
    throw new Error('Capture operation mismatch');
  if (
    !inventory.policies ||
    !inventory.roles ||
    !inventory.auth ||
    !Array.isArray(inventory.tokens) ||
    !Array.isArray(inventory.leases)
  )
    throw new Error('Incomplete captured inventory');
  const plan = provisioningPlan({ version: 1, installations });
  const custodian = custodianSuccessionPlan('platform-owner-custodian');
  const policies = [
    ...plan.policies,
    { name: custodian.policyName, policy: custodian.policy },
  ].map(({ name, policy }) => {
    const actual = inventory.policies[name]?.policy;
    return {
      name,
      comparison:
        typeof actual !== 'string'
          ? 'missing'
          : actual === policy
            ? 'exact-match'
            : 'different-unresolved',
      expectedSha256: hash(policy),
      capturedSha256: typeof actual === 'string' ? hash(actual) : null,
      issuanceConstraintIndicators:
        typeof actual === 'string'
          ? {
              capturedRequiredParameters: (
                actual.match(/\brequired_parameters\b/g) ?? []
              ).length,
              capturedAllowedParameters: (
                actual.match(/\ballowed_parameters\b/g) ?? []
              ).length,
              expectedRequiredParameters: (
                policy.match(/\brequired_parameters\b/g) ?? []
              ).length,
              expectedAllowedParameters: (
                policy.match(/\ballowed_parameters\b/g) ?? []
              ).length,
              capturedUnconditionalTokenCreateGrants: [
                ...actual.matchAll(
                  /path "auth\/token\/create\/[^\"]+"\s*\{([^{}]*)\}/g,
                ),
              ].filter((match) =>
                /^\s*capabilities\s*=\s*\[\s*"update"\s*\]\s*$/.test(match[1]),
              ).length,
            }
          : null,
    };
  });
  const roles = [...plan.roles, ...custodian.issuerRoles].map(
    ({ name, configuration }) => {
      const actual = inventory.roles[name];
      const differentFields = Object.keys(configuration).filter(
        (key) => !same(actual?.[key], configuration[key]),
      );
      // Native response aliases and extra fields remain explicitly outside this comparison.
      return {
        name,
        comparedFields: Object.keys(configuration).sort(),
        differentFields,
        present: !!actual,
      };
    },
  );
  return {
    version: 1,
    status: 'offline-review-complete-installation-blocked',
    source: { ...binding, capturedAt: inventory.capturedAt },
    providerAccessed: false,
    credentialsRead: false,
    providerWritesAuthorized: false,
    effectiveAuthorityEstablished: false,
    comparisonScope:
      'Exact generated policy bytes and listed token-role fields only; no HCL semantics or effective ACL evaluation',
    policies,
    roles,
    counts: {
      capturedPolicies: Object.keys(inventory.policies).length,
      capturedRoles: Object.keys(inventory.roles).length,
      tokens: inventory.tokens.length,
      leases: inventory.leases.length,
    },
    dedicatedBackupAuthPresent: Object.hasOwn(
      inventory.auth,
      'platform-backup/',
    ),
    dedicatedBackupPolicyPresent: Object.hasOwn(
      inventory.policies,
      'platform-raft-snapshot-reader',
    ),
    blockers: [
      'Captured privileged policies lack the proposed issuance parameter constraints; historical-contract and remediation review required',
      'Token-role response aliases and additional fields are not fully evaluated',
      'Userpass user mappings, identity entities/groups and current live effective capabilities were not captured',
      'No independently authorized direct installer route established',
      'Rotation owner and authority, scheduling, audit continuity, alerts and joint recovery acceptance remain unresolved',
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const report = reviewCapturedAuthority(
      readFileSync('/input/inventory.json'),
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    process.stderr.write(
      'Offline authority review refused input; no inventory content emitted.\n',
    );
    process.exitCode = 1;
  }
}
