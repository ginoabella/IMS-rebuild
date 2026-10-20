// Only the isolated launcher supplies these mounts. No retained credentials,
// recovery endpoints, network discovery, application environment or service ports.
import { request } from 'node:https';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { reviewDeadline } from './disposable-deadline-review.mjs';
import { reviewDisposable } from './disposable-review.mjs';
import { provisioningPlan } from './provisioning-plan.mjs';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';
import {
  verifyCustodian,
  expectedCapabilities,
} from './verify-custodian-capabilities.mjs';
import { parseCustodianPassword } from './custodian-password.mjs';

process.umask(0o077);
const ca = readFileSync('/custody/ca.crt');
const proposal = JSON.parse(readFileSync('/proposal.json', 'utf8'));
const manifest = JSON.parse(readFileSync('/manifest.json', 'utf8'));
const plan = provisioningPlan(manifest);
const human = custodianSuccessionPlan('platform-owner-custodian');
const roles = [...plan.roles, ...human.issuerRoles];
const results = {
  startedAt: new Date().toISOString(),
  paths: [],
  failures: [],
  revoked: 0,
  expired: 0,
  tests: [],
};
const live = new Set();
let stage = 'health';
let root;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function need(condition, label) {
  if (!condition) throw new Error(label);
}
function api(path, body, token, method = body === undefined ? 'GET' : 'POST') {
  return new Promise((resolve, reject) => {
    const req = request(
      'https://endpoint-secrets:8200/v1/' + path,
      {
        method,
        ca,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Vault-Token': token } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (b) => {
          data += b;
          if (data.length > 262144) req.destroy();
        });
        res.on('error', () => reject(new Error('response_unavailable')));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              value: JSON.parse(data || '{}'),
            });
          } catch {
            reject(new Error('invalid_response'));
          }
        });
      },
    );
    const timer = setTimeout(
      () => req.destroy(),
      path === 'sys/init' ? 60000 : 5000,
    );
    req.on('close', () => clearTimeout(timer));
    req.on('error', () => reject(new Error('request_unavailable')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
function remember(response) {
  const token = response.value.auth?.client_token;
  if (typeof token === 'string') live.add(token);
  return token;
}
async function required(path, body, token = root) {
  const response = await api(path, body, token);
  remember(response);
  results.lastRequest = { path, status: response.status };
  need(
    response.status >= 200 && response.status < 300,
    'required_request_rejected',
  );
  return response.value;
}
async function revoke(token) {
  const before = await api('auth/token/lookup-self', undefined, token);
  if (before.status === 403) results.expired++;
  else {
    need(
      [200, 204].includes(
        (await api('auth/token/revoke-self', {}, token)).status,
      ),
      'revocation_failed',
    );
    results.revoked++;
  }
  need(
    (await api('auth/token/lookup-self', undefined, token)).status === 403,
    'revocation_unverified',
  );
  live.delete(token);
}
async function deny(label, path, body, token) {
  const response = await api(path, body, token);
  const issued = remember(response);
  const accepted = [400, 403].includes(response.status) && !issued;
  if (issued) await revoke(issued);
  if (!accepted)
    results.failures.push({ stage, label, path, status: response.status });
  return { label, status: response.status, rejected: accepted };
}
const sha = (body) => createHash('sha256').update(body).digest('hex');
async function issue(role, issuer) {
  const value = await required(
    'auth/token/create/' + role.name,
    role.request,
    issuer,
  );
  const token = value.auth.client_token;
  const self = (await required('auth/token/lookup-self', undefined, token))
    .data;
  need(
    JSON.stringify(self.policies) === JSON.stringify(role.request.policies),
    'wrong_policies',
  );
  need(
    !self.identity_policies?.length && self.orphan && !self.period,
    'unexpected_identity',
  );
  need(
    self.explicit_max_ttl ===
      (role.request.explicit_max_ttl === '1s' ? 1 : 86400),
    'wrong_maximum',
  );
  need(
    (role.request.ttl === '1s' ? self.ttl >= 0 : self.ttl > 0) &&
      self.ttl <=
        (role.request.ttl === '1s'
          ? 1
          : role.request.ttl === '1h'
            ? 3600
            : 86400),
    'wrong_ttl',
  );
  need(self.renewable === role.request.renewable, 'wrong_renewability');
  return {
    token,
    attributes: {
      policies: self.policies,
      ttl: self.ttl,
      explicitMaximum: self.explicit_max_ttl,
      renewable: self.renewable,
      orphan: self.orphan,
      period: self.period ?? 0,
    },
  };
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await api('sys/health')).status === 501) {
        ready = true;
        break;
      }
    } catch {
      /* startup only */
    }
    await sleep(200);
  }
  need(ready, 'fixture_not_ready');
  stage = 'initialize_fresh_disposable';
  const initialized = await api('sys/init', {
    secret_shares: 1,
    secret_threshold: 1,
  });
  need(initialized.status === 200, 'init_failed');
  root = initialized.value.root_token;
  live.add(root);
  need(
    (await api('sys/unseal', { key: initialized.value.keys_base64[0] }))
      .status === 200,
    'unseal_failed',
  );
  // Seal share is never persisted. This is fresh initialization, not recovery.
  initialized.value = {};
  const health = await api('sys/health');
  results.providerVersion = health.value.version;
  need(results.providerVersion === '2.7.1', 'provider_version_mismatch');
  for (const lifecycle of ['endpoint', 'trunk'])
    await required('sys/mounts/myims-' + lifecycle, {
      type: 'kv',
      options: { version: '2' },
    });
  for (const policy of [
    ...plan.policies,
    { name: human.policyName, policy: human.policy },
  ]) {
    const replacement = proposal.policies.find((p) => p.name === policy.name);
    if (replacement)
      need(
        policy.policy ===
          replacement.proposedPolicy.replaceAll(
            /("policies" = )\["([^"\n]+)"\]/g,
            '$1[["$2"]]',
          ),
        'generated_candidate_mismatch',
      );
    await required('sys/policies/acl/' + policy.name, {
      policy: replacement?.proposedPolicy ?? policy.policy,
    });
  }
  results.policyHashes = proposal.policies.map((p) => ({
    name: p.name,
    baselineSha256: p.expectedCurrentSha256,
    candidateSha256: sha(p.proposedPolicy),
  }));
  for (const role of roles)
    await required('auth/token/roles/' + role.name, role.configuration);
  await required('sys/auth/' + human.authMount, { type: 'userpass' });
  const password = randomBytes(48).toString('base64url');
  await required('auth/' + human.authMount + '/users/' + human.username, {
    ...human.userConfiguration,
    password,
  });
  // Exercise the exact bounded verifier against the fresh native TLS fixture
  // before any retained use. Track only its request names and safe outcome.
  const verificationCalls = [];
  let verificationToken;
  const verified = await verifyCustodian(
    async (path, body, token) => {
      verificationCalls.push(path);
      if (path === 'sys/capabilities-self')
        need(
          JSON.stringify(body) ===
            JSON.stringify({ paths: Object.keys(expectedCapabilities) }),
          'verification_scope_mismatch',
        );
      const response = await api(path, body, token);
      if (path === `auth/${human.authMount}/login/${human.username}`) {
        verificationToken = remember(response);
      }
      return response;
    },
    parseCustodianPassword(Buffer.from(password + '\r\n')),
  );
  results.nativeCapabilityVerification = verified;
  need(
    JSON.stringify(verificationCalls) ===
      JSON.stringify([
        `auth/${human.authMount}/login/${human.username}`,
        'auth/token/lookup-self',
        'sys/capabilities-self',
        'auth/token/revoke-self',
        'auth/token/lookup-self',
      ]),
    'verification_request_sequence_mismatch',
  );
  need(
    verified.state === 'verified' &&
      verified.loginAttempts === 1 &&
      verified.capabilityBatches === 1 &&
      verified.capabilities.length === 10 &&
      verified.differences.length === 0 &&
      verified.cleanup === 'revoked_and_denial_confirmed',
    'native_capability_verification_failed',
  );
  live.delete(verificationToken);
  results.nativeCapabilityVerification.requestSequenceVerified = true;
  const session = (
    await required(
      'auth/' + human.authMount + '/login/' + human.username,
      { password },
      undefined,
    )
  ).auth.client_token;
  const sessionAttributes = (
    await required('auth/token/lookup-self', undefined, session)
  ).data;
  // Fresh synthetic fixture only. Compare native custom-mount naming without
  // emitting any raw identity field, token, accessor or credential.
  results.nativeUserpassDisplayName = {
    customMountPrefixMatches:
      sessionAttributes.display_name === `${human.authMount}-${human.username}`,
    defaultUserpassPrefixMatches:
      sessionAttributes.display_name === `userpass-${human.username}`,
  };
  need(
    sessionAttributes.explicit_max_ttl === 900 &&
      sessionAttributes.ttl <= 900 &&
      sessionAttributes.orphan &&
      !sessionAttributes.period &&
      !sessionAttributes.identity_policies?.length,
    'human_session_mismatch',
  );
  const issuers = {};
  for (const lifecycle of ['endpoint', 'trunk']) {
    const role = human.issuerRoles.find(
      (r) => r.name === 'platform-' + lifecycle + '-issuer',
    );
    const response = await api(
      'auth/token/create/' + role.name,
      role.request,
      session,
    );
    const successor = remember(response);
    results.tests.push({
      label: 'fixed_issuer_positive',
      path: role.name,
      status: response.status,
    });
    if (successor) issuers[lifecycle] = successor;
    else {
      // Fixture-only root seeding keeps the rest of the failed-candidate matrix
      // observable; it is not a workaround accepted for retained provisioning.
      results.failures.push({
        stage,
        label: 'fixed_issuer_positive_rejected',
        path: role.name,
        status: response.status,
      });
      issuers[lifecycle] = (
        await required('auth/token/create', plan.issuerRequest(lifecycle))
      ).auth.client_token;
    }
  }
  results.humanAuthentication = 'native_userpass_900_second_orphan_session';
  stage = 'exact_path_parameter_matrix';
  for (const role of roles) {
    const caller = role.name.startsWith('platform-')
      ? session
      : issuers[role.name.split('-')[0]];
    const path = 'auth/token/create/' + role.name;
    const response = await api(path, role.request, caller);
    const positiveToken = remember(response);
    let attributes = null;
    if (positiveToken) {
      const self = (
        await required('auth/token/lookup-self', undefined, positiveToken)
      ).data;
      need(
        JSON.stringify(self.policies) ===
          JSON.stringify(role.request.policies) &&
          !self.identity_policies?.length &&
          self.orphan === true &&
          !self.period &&
          self.explicit_max_ttl ===
            (role.request.explicit_max_ttl === '1s' ? 1 : 86400) &&
          (role.request.ttl === '1s' ? self.ttl >= 0 : self.ttl > 0) &&
          self.ttl <=
            (role.request.ttl === '1s'
              ? 1
              : role.request.ttl === '1h'
                ? 3600
                : 86400) &&
          self.renewable === role.request.renewable,
        'positive_attributes_mismatch',
      );
      if (role.request.ttl === '1s')
        need(
          response.value.auth.lease_duration === 1,
          'expiry_response_ttl_mismatch',
        );
      attributes = {
        orphan: self.orphan,
        identityPolicies: self.identity_policies ?? [],
        period: self.period ?? 0,
        policies: self.policies,
        ttl: self.ttl,
        explicitMaximum: self.explicit_max_ttl,
        renewable: self.renewable,
      };
      await revoke(positiveToken);
    } else
      results.failures.push({
        stage,
        label: 'approved_positive_rejected',
        path,
        status: response.status,
      });
    const row = {
      path,
      positiveStatus: response.status,
      positive: attributes,
      negative: [],
    };
    const changes = [
      ['excessive_ttl', { ttl: '48h' }],
      ['excessive_max', { explicit_max_ttl: '48h' }],
      ['both_excessive', { ttl: '48h', explicit_max_ttl: '48h' }],
      ['zero_max', { explicit_max_ttl: 0 }],
      ['zero_ttl', { ttl: 0 }],
      [
        'equivalent_max_seconds_string',
        {
          explicit_max_ttl:
            role.request.explicit_max_ttl === '1s' ? '1000ms' : '86400s',
        },
      ],
      [
        'equivalent_max_number',
        {
          explicit_max_ttl: role.request.explicit_max_ttl === '1s' ? 1 : 86400,
        },
      ],
      [
        'equivalent_ttl_minutes',
        {
          ttl:
            role.request.ttl === '1h'
              ? '60m'
              : role.request.ttl === '24h'
                ? '1440m'
                : '1000ms',
        },
      ],
      [
        'equivalent_ttl_number',
        {
          ttl:
            role.request.ttl === '1h'
              ? 3600
              : role.request.ttl === '24h'
                ? 86400
                : 1,
        },
      ],
      ['policy_root', { policies: ['root'] }],
      ['policy_default', { policies: ['default'] }],
      [
        'policy_other_installation',
        { policies: ['trunk-verifier-' + plan.installations[1]] },
      ],
      [
        'policy_plus_default',
        { policies: [...role.request.policies, 'default'] },
      ],
      ['policy_empty', { policies: [] }],
      ['policy_string', { policies: role.request.policies[0] }],
      ['default_enabled', { no_default_policy: false }],
      ['default_string', { no_default_policy: 'true' }],
      ['renewable_changed', { renewable: !role.request.renewable }],
      ['period', { period: '1h' }],
      ['zero_period', { period: 0 }],
      ['display_name', { display_name: 'fixture' }],
      ['num_uses', { num_uses: 0 }],
      ['no_parent', { no_parent: true }],
      ['token_type', { type: 'batch' }],
      ['entity_alias', { entity_alias: 'fixture' }],
      ['unknown_parameter', { unexpected: true }],
    ];
    // The foreign-policy case must actually differ, including the second-install verifier.
    changes[11][1].policies = [
      role.request.policies[0] === 'trunk-verifier-' + plan.installations[1]
        ? 'trunk-verifier-' + plan.installations[0]
        : 'trunk-verifier-' + plan.installations[1],
    ];
    for (const key of Object.keys(role.request)) {
      const body = { ...role.request };
      delete body[key];
      row.negative.push(await deny('missing_' + key, path, body, caller));
    }
    for (const [label, change] of changes)
      row.negative.push(
        await deny(label, path, { ...role.request, ...change }, caller),
      );
    results.paths.push(row);
  }
  stage = 'constraint_diagnostics';
  const diagnosticRole = plan.roles.find((r) =>
    r.name.startsWith('trunk-verifier-'),
  );
  const diagnosticPath = 'auth/token/create/' + diagnosticRole.name;
  const diagnosticBase = proposal.policies.find(
    (p) => p.name === 'trunk-restricted-issuer',
  ).proposedPolicy;
  results.constraintDiagnostics = [];
  for (const key of Object.keys(diagnosticRole.request)) {
    const value = diagnosticRole.request[key];
    const literal = Array.isArray(value) ? value : [value];
    const rule = `path "${diagnosticPath}" {\n capabilities = ["update"]\n allowed_parameters = {\n "*" = []\n "${key}" = ${JSON.stringify(literal)}\n }\n }`;
    await required('sys/policies/acl/fixture-diagnostic', { policy: rule });
    const caller = (
      await required('auth/token/create', {
        policies: ['fixture-diagnostic'],
        no_parent: true,
        no_default_policy: true,
        ttl: '1m',
        explicit_max_ttl: '1m',
      })
    ).auth.client_token;
    const result = await api(diagnosticPath, diagnosticRole.request, caller);
    const token = remember(result);
    results.constraintDiagnostics.push({
      constrainedParameter: key,
      status: result.status,
    });
    if (token) await revoke(token);
    await revoke(caller);
  }
  // Observe whether matching the complete JSON array (rather than its scalar
  // member) is needed by this pinned evaluator. No candidate body is changed.
  const arrayRule = diagnosticBase.replaceAll(
    /("policies" = )\["([^"\n]+)"\]/g,
    '$1[["$2"]]',
  );
  await required('sys/policies/acl/fixture-array-diagnostic', {
    policy: arrayRule,
  });
  const arrayCaller = (
    await required('auth/token/create', {
      policies: ['fixture-array-diagnostic'],
      no_parent: true,
      no_default_policy: true,
      ttl: '1m',
      explicit_max_ttl: '1m',
    })
  ).auth.client_token;
  const arrayResult = await api(
    diagnosticPath,
    diagnosticRole.request,
    arrayCaller,
  );
  const arrayToken = remember(arrayResult);
  results.constraintDiagnostics.push({
    constrainedParameter: 'complete_array_with_all_other_constraints',
    status: arrayResult.status,
  });
  if (arrayToken) await revoke(arrayToken);
  await revoke(arrayCaller);
  stage = 'alternative_paths_and_identity_scope';
  for (const [lifecycle, issuer] of Object.entries(issuers)) {
    const other = lifecycle === 'trunk' ? 'endpoint' : 'trunk';
    for (const path of [
      'auth/token/create',
      'auth/token/create-orphan',
      'auth/token/create/platform-' + lifecycle + '-issuer',
      'auth/token/create/' + other + '-cleanup-' + plan.installations[0],
      'auth/token/create/' + lifecycle + '-cleanup-' + randomUUID(),
      'sys/policies/acl/' + lifecycle + '-restricted-issuer',
      'auth/token/roles/' + lifecycle + '-cleanup-' + plan.installations[0],
    ]) {
      results.tests.push(
        await deny(
          'issuer_alternative_path',
          path,
          { policies: ['root'], no_default_policy: true },
          issuer,
        ),
      );
    }
  }
  results.tests.push(
    await deny(
      'human_self_policy_write',
      'sys/policies/acl/' + human.policyName,
      { policy: human.policy },
      session,
    ),
  );
  results.tests.push(
    await deny(
      'human_snapshot_without_grant',
      'sys/storage/raft/snapshot',
      undefined,
      session,
    ),
  );
  const candidatePositivesPass = !results.failures.length;
  if (candidatePositivesPass) {
    stage = 'disposable_review';
    results.review = { overlap: [], maintenance: [], faultCheckpoints: [] };
    await reviewDisposable({
      report: results.review,
      api,
      required,
      remember,
      revoke,
      need,
      root,
      session,
      issuers,
      plan,
      human,
      proposal,
      ca,
    });
  }
  stage = 'role_configuration_variants';
  const target = plan.roles.find((r) => r.name.startsWith('trunk-verifier-'));
  for (const max of [0, 172800]) {
    await required('auth/token/roles/' + target.name, {
      ...target.configuration,
      token_explicit_max_ttl: max,
    });
    if (candidatePositivesPass) {
      const issued = await issue(target, issuers.trunk);
      await revoke(issued.token);
    }
    results.tests.push(
      await deny(
        'role_max_' + max + '_override',
        'auth/token/create/' + target.name,
        { ...target.request, explicit_max_ttl: '48h' },
        issuers.trunk,
      ),
    );
  }
  await required('auth/token/roles/' + target.name, target.configuration);
  stage = 'privileged_role_period_counterexample';
  await required('auth/token/roles/' + target.name, {
    ...target.configuration,
    token_period: 3600,
    period: 3600,
  });
  const storedPeriodRole = (await required('auth/token/roles/' + target.name))
    .data;
  const periodic = (
    await required(
      'auth/token/create/' + target.name,
      target.request,
      issuers.trunk,
    )
  ).auth.client_token;
  const periodicAttributes = (
    await required('auth/token/lookup-self', undefined, periodic)
  ).data;
  results.privilegedRolePeriodCounterexample = {
    requestContainedPeriod: false,
    rolePeriod: 3600,
    storedTokenPeriod: storedPeriodRole.token_period ?? null,
    storedLegacyPeriod: storedPeriodRole.period ?? null,
    observedPeriod: periodicAttributes.period ?? null,
    explicitMaximum: periodicAttributes.explicit_max_ttl,
  };
  await revoke(periodic);
  await required('auth/token/roles/' + target.name, {
    ...target.configuration,
    period: 0,
  });
  stage = 'overlapping_policy_behavior';
  const overlapPath = 'auth/token/create/' + target.name;
  const overlapResults = [];
  for (const [name, policy] of [
    [
      'fixture-overlap-unconstrained',
      `path "${overlapPath}" { capabilities = ["update"] }`,
    ],
    [
      'fixture-overlap-widened',
      `path "${overlapPath}" {\n capabilities = ["update"]\n allowed_parameters = {\n "policies" = [["${target.name}"]]\n "no_default_policy" = [true]\n "ttl" = ["1h"]\n "explicit_max_ttl" = ["48h"]\n "renewable" = [true]\n }\n }`,
    ],
    [
      'fixture-overlap-wildcard',
      'path "auth/token/create/trunk-*" { capabilities = ["update"] }',
    ],
  ]) {
    await required('sys/policies/acl/' + name, { policy });
    // Synthetic privileged assignment exercises merging, never an approved normal identity.
    const token = (
      await required('auth/token/create', {
        policies: ['trunk-restricted-issuer', name],
        no_default_policy: true,
        no_parent: true,
        ttl: '1m',
        explicit_max_ttl: '1m',
        renewable: false,
      })
    ).auth.client_token;
    const response = await api(
      overlapPath,
      { ...target.request, explicit_max_ttl: '48h' },
      token,
    );
    const child = remember(response);
    let maximum = null;
    if (child) {
      maximum = (await required('auth/token/lookup-self', undefined, child))
        .data.explicit_max_ttl;
      await revoke(child);
    }
    overlapResults.push({
      assignment: name,
      status: response.status,
      explicitMaximum: maximum,
      bypass: maximum > 86400,
    });
    await revoke(token);
    await api('sys/policies/acl/' + name, undefined, root, 'DELETE');
  }
  results.overlap = overlapResults;
  // Prove an ordinary issuer cannot add an overlap policy to its child identity.
  results.tests.push(
    await deny(
      'overlap_policy_cannot_be_requested',
      overlapPath,
      {
        ...target.request,
        policies: [...target.request.policies, 'fixture-overlap-unconstrained'],
      },
      issuers.trunk,
    ),
  );
  if (!candidatePositivesPass) {
    results.dependentRegressions = 'blocked_by_rejected_approved_issuance';
    throw new Error('candidate_positive_issuance_failed');
  }
  stage = 'accelerated_absolute_lifetime';
  const scaledName = 'fixture-absolute';
  const scaledSelf =
    'path "auth/token/lookup-self" { capabilities = ["read"] }\npath "auth/token/renew-self" { capabilities = ["update"] }\npath "auth/token/revoke-self" { capabilities = ["update"] }';
  await required('sys/policies/acl/' + scaledName, { policy: scaledSelf });
  await required('auth/token/roles/' + scaledName, {
    ...target.configuration,
    allowed_policies: [scaledName],
    token_explicit_max_ttl: 6,
  });
  await required('sys/policies/acl/fixture-scaled-issuer', {
    policy: `path "auth/token/create/${scaledName}" { capabilities = ["update"]\n required_parameters = ["policies", "ttl", "explicit_max_ttl", "no_default_policy", "renewable"]\n allowed_parameters = { "policies" = [["${scaledName}"]]\n "ttl" = ["2s"]\n "explicit_max_ttl" = ["6s"]\n "no_default_policy" = [true]\n "renewable" = [true]\n }\n }\n${scaledSelf}`,
  });
  const scaledIssuer = (
    await required('auth/token/create', {
      policies: ['fixture-scaled-issuer'],
      no_default_policy: true,
      no_parent: true,
      ttl: '1m',
      explicit_max_ttl: '1m',
    })
  ).auth.client_token;
  const scaledStart = Date.now();
  const scaled = (
    await required(
      'auth/token/create/' + scaledName,
      {
        policies: [scaledName],
        ttl: '2s',
        explicit_max_ttl: '6s',
        no_default_policy: true,
        renewable: true,
      },
      scaledIssuer,
    )
  ).auth.client_token;
  const scaledIdentity = (
    await required('auth/token/lookup-self', undefined, scaled)
  ).data;
  const scaledDeadline = Date.parse(scaledIdentity.issue_time) + 6000;
  results.absoluteTimestamps = {
    issueTime: scaledIdentity.issue_time,
    initialExpireTime: scaledIdentity.expire_time,
    creationTime: scaledIdentity.creation_time,
    explicitMaximum: scaledIdentity.explicit_max_ttl,
  };
  let previousExpiry = scaledIdentity.expire_time;
  let renewals = 0;
  results.acceleratedRenewalResponses = [];
  while (Date.now() - scaledStart < 7500) {
    await sleep(600);
    const response = await api(
      'auth/token/renew-self',
      { increment: '48h' },
      scaled,
    );
    const lookup = await api('auth/token/lookup-self', undefined, scaled);
    const overrunMs =
      lookup.status === 200
        ? Date.parse(lookup.value.data.expire_time) - scaledDeadline
        : null;
    if (overrunMs > 0)
      results.failures.push({
        stage,
        label: 'scaled_expiry_extended',
        overrunMs,
      });
    if (response.status !== 200 && lookup.status === 200)
      need(
        lookup.value.data.expire_time === previousExpiry,
        'failed_renewal_extended_expiry',
      );
    results.acceleratedRenewalResponses.push({
      status: response.status,
      leaseDuration: response.value.auth?.lease_duration ?? null,
      elapsedMs: Date.now() - scaledStart,
      expireTime: lookup.value.data?.expire_time ?? null,
      overrunMs,
      failedRenewalPreservedExpiry:
        response.status !== 200 && lookup.status === 200
          ? lookup.value.data.expire_time === previousExpiry
          : null,
      errors: (response.value.errors ?? []).map((e) =>
        /past.*max.*ttl/i.test(e)
          ? 'past_max_ttl'
          : /lease.*not found/i.test(e)
            ? 'lease_not_found'
            : /permission denied/i.test(e)
              ? 'permission_denied'
              : 'other_' + sha(String(e)),
      ),
      lookupStatus: lookup.status,
      expireWithinOriginalMaximum:
        lookup.status === 200
          ? Date.parse(lookup.value.data.expire_time) <= scaledDeadline
          : null,
    });
    if (lookup.status === 200) previousExpiry = lookup.value.data.expire_time;
    if (response.status === 200) {
      need(response.value.auth.lease_duration <= 6, 'scaled_renewal_unbounded');
      renewals++;
    } else if (response.status === 500) {
      // Keep this as a provider failure, then finish the independently measurable
      // absolute-boundary assertion and unrelated regressions. Never call 500 a pass.
      need(!response.value.auth, 'error_response_contains_auth');
      results.failures.push({
        stage,
        label: 'provider_500_near_absolute_expiry',
        status: 500,
      });
    } else
      need(
        [400, 403, 404].includes(response.status),
        'scaled_renewal_unexpected',
      );
  }
  need(
    (await api('auth/token/lookup-self', undefined, scaled)).status === 403,
    'scaled_absolute_boundary_failed',
  );
  await revoke(scaled);
  if (process.env.MYIMS_DISPOSABLE_DEADLINE === '1') {
    stage = 'disposable_authorization_deadline';
    results.deadlineReview = await reviewDeadline({
      api,
      required,
      remember,
      revoke,
      need,
      issuer: scaledIssuer,
      role: scaledName,
    });
  }
  await revoke(scaledIssuer);
  results.absoluteBoundary = {
    exactTokensInspectedSeconds: 86400,
    elapsed24HourTest: false,
    acceleratedMaximumSeconds: 6,
    renewals,
    finalLookup: 403,
  };
  stage = 'runtime_issuance_helper_identity_hardened';
  results.runtimeHelperChecks = [];
  for (const lifecycle of ['endpoint', 'trunk']) {
    writeFileSync('/custody/issuer.token', issuers[lifecycle], {
      mode: 0o600,
      flag: 'wx',
    });
    for (const installation of plan.installations) {
      for (const principal of lifecycle === 'endpoint'
        ? ['worker', 'cleanup']
        : ['importer', 'verifier', 'cleanup']) {
        const output = execFileSync(
          process.execPath,
          [
            '/openbao/issue-restricted-token.mjs',
            lifecycle,
            principal,
            installation,
          ],
          {
            encoding: 'utf8',
            timeout: 10000,
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        const file = `/output/${principal}-${installation}.token`;
        const token = readFileSync(file, 'utf8');
        live.add(token);
        need(JSON.parse(output).state === 'issued', 'runtime_helper_failed');
        await revoke(token);
        unlinkSync(file);
        unlinkSync(`/output/${principal}-${installation}.accessor`);
        results.runtimeHelperChecks.push({
          lifecycle,
          principal,
          installation,
          issued: true,
          revoked: true,
        });
      }
    }
    unlinkSync('/custody/issuer.token');
  }
  stage = 'endpoint_provider_regressions';
  const require = createRequire('/backend/package.json');
  const {
    OpenBaoEndpointProvider,
  } = require('/backend/dist/modules/telephony/adapters/credentials/openbao.js');
  const files = [];
  async function endpoint(principal, installation) {
    const role = plan.roles.find(
      (r) => r.name === 'endpoint-' + principal + '-' + installation,
    );
    const { token } = await issue(role, issuers.endpoint);
    const file = '/private/' + role.name + '.token';
    writeFileSync(file, token, { mode: 0o600, flag: 'wx' });
    files.push(file);
    return {
      token,
      adapter: new OpenBaoEndpointProvider({
        endpoint: 'https://endpoint-secrets:8200',
        caFile: '/custody/ca.crt',
        tokenFile: file,
        installationId: installation,
      }),
    };
  }
  const installation = plan.installations[0];
  const worker = await endpoint('worker', installation),
    cleanup = await endpoint('cleanup', installation),
    other = await endpoint('worker', plan.installations[1]);
  const binding = {
    installationId: installation,
    extensionId: randomUUID(),
    operationId: randomUUID(),
    generationId: randomUUID(),
  };
  need(
    (await worker.adapter.verify(binding)) === 'unavailable',
    'endpoint_initial_missing',
  );
  stage = 'endpoint_concurrent_cas_prepare';
  const concurrent = await Promise.allSettled([
    worker.adapter.prepare(binding),
    worker.adapter.prepare(binding),
  ]);
  results.endpointConcurrentPrepare = concurrent.map((r) => ({
    status: r.status,
    code:
      r.status === 'rejected' && /^[a-z_]+$/.test(r.reason?.code)
        ? r.reason.code
        : null,
  }));
  if (concurrent.some((r) => r.status !== 'fulfilled'))
    results.failures.push({ stage, label: 'concurrent_prepare_rejected' });
  stage = 'endpoint_replay_verify';
  await worker.adapter.prepare(binding);
  need(
    (await worker.adapter.verify(binding)) === 'verified',
    'endpoint_verify_failed',
  );
  const endpointPath =
    'myims-endpoint/data/installations/' +
    installation +
    '/extensions/' +
    binding.extensionId +
    '/operations/' +
    binding.operationId;
  await deny(
    'endpoint_other_installation',
    endpointPath,
    undefined,
    other.token,
  );
  await deny(
    'endpoint_worker_overwrite',
    endpointPath,
    { options: { cas: 1 }, data: {} },
    worker.token,
  );
  await deny(
    'endpoint_worker_destroy',
    endpointPath.replace('/data/', '/destroy/'),
    { versions: [1] },
    worker.token,
  );
  await deny(
    'endpoint_cleanup_create',
    endpointPath.replace(binding.operationId, randomUUID()),
    { options: { cas: 0 }, data: {} },
    cleanup.token,
  );
  stage = 'endpoint_repeated_races';
  results.endpointRaceReview = [];
  const rawReplay = await api(
    endpointPath,
    { options: { cas: 0 }, data: {} },
    worker.token,
  );
  need(rawReplay.status === 403, 'endpoint_create_only_acl_not_reproduced');
  results.endpointCreateOnlyReplayStatus = rawReplay.status;
  for (let i = 0; i < 20; i++) {
    const b = {
      ...binding,
      operationId: randomUUID(),
      generationId: randomUUID(),
    };
    const p = endpointPath.replace(binding.operationId, b.operationId);
    const prepared = await Promise.allSettled(
      Array.from({ length: 4 }, () => worker.adapter.prepare(b)),
    );
    need(
      prepared.every((r) => r.status === 'fulfilled'),
      'endpoint_repeated_prepare_failed',
    );
    const initial = (await required(p + '?version=1', undefined, worker.token))
      .data;
    const digest = sha(JSON.stringify(initial.data));
    await Promise.all([worker.adapter.prepare(b), worker.adapter.prepare(b)]);
    const replay = (await required(p + '?version=1', undefined, worker.token))
      .data;
    need(
      replay.metadata.version === 1 &&
        sha(JSON.stringify(replay.data)) === digest,
      'endpoint_generation_changed',
    );
    let wrongRejected = false;
    try {
      await worker.adapter.prepare({ ...b, generationId: randomUUID() });
    } catch (error) {
      wrongRejected = error.code === 'material_invalid';
    }
    need(wrongRejected, 'endpoint_wrong_generation_accepted');
    const raced = await Promise.allSettled([
      cleanup.adapter.destroy(b),
      worker.adapter.prepare(b),
      cleanup.adapter.destroy(b),
    ]);
    need(
      raced.some((r) => r.status === 'fulfilled' && r.value === 'destroyed'),
      'endpoint_cleanup_race_failed',
    );
    need(
      (await cleanup.adapter.destroy(b)) === 'destroyed',
      'endpoint_cleanup_retry_failed',
    );
    let resurrectionDenied = false;
    try {
      await worker.adapter.prepare(b);
    } catch (error) {
      resurrectionDenied = error.code === 'provider_access_denied';
    }
    need(resurrectionDenied, 'endpoint_resurrection_accepted');
    const metadata = (
      await required(
        p.replace('/data/', '/metadata/'),
        undefined,
        cleanup.token,
      )
    ).data;
    need(
      metadata.current_version === 1 &&
        metadata.versions['1'].destroyed === true,
      'endpoint_cleanup_wrong_version',
    );
    need(
      (await worker.adapter.verify(b)) === 'unavailable',
      'endpoint_cleanup_verification',
    );
    results.endpointRaceReview.push({
      iteration: i,
      concurrentCreates: 4,
      prepared: 4,
      unchangedVersion: 1,
      exactReplay: true,
      wrongGenerationRejected: true,
      cleanupRetry: 'destroyed',
      resurrectionDenied: true,
      cleanupRace: raced.map((r) => ({
        status: r.status,
        code: r.status === 'rejected' ? r.reason.code : null,
      })),
    });
  }
  stage = 'endpoint_renew_destroy_expiry';
  await worker.adapter.renew();
  const renewal = (
    await required('auth/token/lookup-self', undefined, worker.token)
  ).data;
  need(
    renewal.ttl <= 3600 && renewal.explicit_max_ttl === 86400,
    'endpoint_renewal_bounds',
  );
  need(
    (await cleanup.adapter.destroy(binding)) === 'destroyed',
    'endpoint_destroy_failed',
  );
  need(
    (await cleanup.adapter.destroy(binding)) === 'destroyed',
    'endpoint_destroy_replay_failed',
  );
  need(
    (await worker.adapter.verify(binding)) === 'unavailable',
    'endpoint_destroy_read_failed',
  );
  const expiring = plan.roles.find(
    (r) => r.name === 'endpoint-worker-expiring-' + installation,
  );
  const expired = (await issue(expiring, issuers.endpoint)).token;
  await sleep(1300);
  need(
    (await api('auth/token/lookup-self', undefined, expired)).status === 403,
    'expiry_fixture_failed',
  );
  await revoke(expired);
  for (const file of files) unlinkSync(file);
  results.endpointRegressions = [
    'missing',
    'concurrent_cas_prepare',
    'exact_replay',
    'verify',
    'cross_installation_denial',
    'overwrite_destroy_create_denials',
    'bounded_renewal',
    'destroy_replay',
    'one_second_expiry',
  ];
  stage = 'trunk_provider_regressions';
  writeFileSync('/custody/issuer.token', issuers.trunk, {
    mode: 0o600,
    flag: 'wx',
  });
  // Existing regression runs unchanged, using only fixture issuer custody.
  const trunk = execFileSync(
    process.execPath,
    ['/openbao/check-trunk-provider.mjs'],
    { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  results.trunkRegression = JSON.parse(trunk);
  unlinkSync('/custody/issuer.token');
  results.completed = true;
} catch (error) {
  results.domainFailureCode = /^[a-zA-Z_]+$/.test(error.code)
    ? error.code
    : null;
  results.failureCode = /^[a-z_]+$/.test(error.message)
    ? error.message
    : 'unclassified_local_failure';
  // Never expose thrown HTTP response objects, bearer strings, or child stderr.
  results.failures.push({ stage, label: 'execution_failed' });
} finally {
  stage = 'exact_fixture_token_cleanup';
  for (const token of [...live].filter((t) => t !== root)) {
    try {
      await revoke(token);
    } catch {
      results.failures.push({ stage, label: 'token_revocation_unverified' });
    }
  }
  if (root && live.has(root)) {
    try {
      await revoke(root);
    } catch {
      results.failures.push({
        stage,
        label: 'fixture_initial_root_revocation_unverified',
      });
    }
  }
  results.remainingKnownTokens = live.size;
  results.finishedAt = new Date().toISOString();
  results.status =
    results.completed && !results.failures.length
      ? 'contract_scenarios_passed_overlap_counterexample'
      : 'failed';
  console.log(JSON.stringify(results));
  if (results.status === 'failed') process.exitCode = 1;
}
