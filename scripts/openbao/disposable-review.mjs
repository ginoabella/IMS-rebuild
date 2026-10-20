// Disposable fixture extension only. Receives fresh synthetic identities in memory.
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { disposableBackupGate } from './disposable-audit-backup.mjs';
import { request } from 'node:https';
import { createHash, randomUUID } from 'node:crypto';
import { rehearseInterruptions } from './disposable-review-interruptions.mjs';
import { verifyRecoverySnapshot } from './recovery-snapshot.mjs';

export async function reviewDisposable(c) {
  const {
    api,
    required,
    remember,
    revoke,
    need,
    root,
    session,
    issuers,
    plan,
    proposal,
    ca,
  } = c;
  const out = c.report;
  const self =
    'path "auth/token/lookup-self" { capabilities = ["read"] }\npath "auth/token/revoke-self" { capabilities = ["update"] }';
  const mint = async (policies, extra = {}) =>
    (
      await required('auth/token/create', {
        policies,
        no_default_policy: true,
        no_parent: true,
        ttl: '60s',
        explicit_max_ttl: '60s',
        renewable: false,
        ...extra,
      })
    ).auth.client_token;
  const check = (condition, label) => need(condition, 'review_' + label);
  const target = plan.roles.find((r) => r.name.startsWith('trunk-verifier-'));
  const path = 'auth/token/create/' + target.name;
  const widened = `path "${path}" { capabilities = ["update"]\nallowed_parameters = { "policies" = [["${target.name}"]] "ttl" = ["1h"] "explicit_max_ttl" = ["48h"] "no_default_policy" = [true] "renewable" = [true] } }`;
  for (const [kind, body] of [
    ['exact_widened', widened],
    ['exact_deny', `path "${path}" { capabilities = ["deny"] }`],
    ['wildcard_widened', widened.replace(path, 'auth/token/create/trunk-*')],
    [
      'generic_create',
      'path "auth/token/create" { capabilities = ["update"] }',
    ],
  ]) {
    const name = 'fixture-review-' + kind;
    await required('sys/policies/acl/' + name, { policy: body });
    const caller = await mint(['trunk-restricted-issuer', name]);
    const response = await api(
      kind === 'generic_create' ? 'auth/token/create' : path,
      {
        ...target.request,
        policies:
          kind === 'generic_create'
            ? ['trunk-restricted-issuer']
            : target.request.policies,
        explicit_max_ttl: '48h',
      },
      caller,
    );
    const child = remember(response);
    const maximum = child
      ? (await required('auth/token/lookup-self', undefined, child)).data
          .explicit_max_ttl
      : null;
    out.overlap.push({ kind, status: response.status, maximum });
    check(
      kind === 'exact_widened' || kind === 'generic_create'
        ? maximum === 172800
        : response.status === 403,
      'overlap_' + kind,
    );
    if (child) await revoke(child);
    await revoke(caller);
  }
  // Native auth creates the entity; assigning an extra identity policy is privileged fixture setup.
  const aliasUser = 'fixture-identity-' + randomUUID();
  const password = randomUUID() + randomUUID();
  await required('auth/platform-custodian/users/' + aliasUser, {
    password,
    token_policies: ['trunk-restricted-issuer'],
    token_no_default_policy: true,
    token_ttl: 60,
    token_max_ttl: 60,
    token_explicit_max_ttl: 60,
  });
  const first = (
    await required(
      'auth/platform-custodian/login/' + aliasUser,
      { password },
      undefined,
    )
  ).auth.client_token;
  const entityId = (await required('auth/token/lookup-self', undefined, first))
    .data.entity_id;
  check(Boolean(entityId), 'entity_missing');
  await required('identity/entity/id/' + entityId, {
    policies: ['fixture-review-exact_widened'],
  });
  const identityCaller = (
    await required(
      'auth/platform-custodian/login/' + aliasUser,
      { password },
      undefined,
    )
  ).auth.client_token;
  const identity = (
    await required('auth/token/lookup-self', undefined, identityCaller)
  ).data;
  check(
    identity.identity_policies?.includes('fixture-review-exact_widened'),
    'identity_policy_missing',
  );
  const identityResponse = await api(
    path,
    { ...target.request, explicit_max_ttl: '48h' },
    identityCaller,
  );
  const identityChild = remember(identityResponse);
  const identityMax = identityChild
    ? (await required('auth/token/lookup-self', undefined, identityChild)).data
        .explicit_max_ttl
    : null;
  check(identityMax === 172800, 'identity_counterexample');
  out.overlap.push({
    kind: 'native_identity_exact_widened',
    status: identityResponse.status,
    maximum: identityMax,
    tokenPolicyCount: identity.policies.length,
    identityPolicyCount: identity.identity_policies.length,
    strictInventoryAccepted:
      identity.policies.length === 1 && !identity.identity_policies.length,
  });
  writeFileSync('/custody/issuer.token', identityCaller, {
    mode: 0o600,
    flag: 'wx',
  });
  let refused = false;
  try {
    execFileSync(
      process.execPath,
      [
        '/openbao/issue-restricted-token.mjs',
        'trunk',
        'verifier',
        plan.installations[0],
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 },
    );
  } catch (error) {
    refused = error.status === 1;
  }
  unlinkSync('/custody/issuer.token');
  check(
    refused &&
      !existsSync('/output/verifier-' + plan.installations[0] + '.token') &&
      !existsSync('/output/verifier-' + plan.installations[0] + '.accessor'),
    'identity_helper_fail_closed',
  );
  out.identityHelperRejected = true;
  await revoke(identityChild);
  await revoke(identityCaller);
  await revoke(first);
  await required('identity/entity/id/' + entityId, { policies: [] });
  const group = (
    await required('identity/group', {
      name: 'fixture-review-' + randomUUID(),
      type: 'internal',
      policies: ['fixture-review-exact_widened'],
      member_entity_ids: [entityId],
    })
  ).data;
  const groupCaller = (
    await required(
      'auth/platform-custodian/login/' + aliasUser,
      { password },
      undefined,
    )
  ).auth.client_token;
  const groupIdentity = (
    await required('auth/token/lookup-self', undefined, groupCaller)
  ).data;
  check(
    groupIdentity.identity_policies?.includes('fixture-review-exact_widened'),
    'group_policy_missing',
  );
  const groupResponse = await api(
    path,
    { ...target.request, explicit_max_ttl: '48h' },
    groupCaller,
  );
  const groupChild = remember(groupResponse);
  const groupMax = groupChild
    ? (await required('auth/token/lookup-self', undefined, groupChild)).data
        .explicit_max_ttl
    : null;
  check(groupMax === 172800, 'group_counterexample');
  out.overlap.push({
    kind: 'native_group_exact_widened',
    status: groupResponse.status,
    maximum: groupMax,
    identityPolicyCount: groupIdentity.identity_policies.length,
  });
  await revoke(groupChild);
  await revoke(groupCaller);
  await api('identity/group/id/' + group.id, undefined, root, 'DELETE');
  await api(
    'auth/platform-custodian/users/' + aliasUser,
    undefined,
    root,
    'DELETE',
  );
  await api('identity/entity/id/' + entityId, undefined, root, 'DELETE');

  const preserved = [];
  for (const lifecycle of ['endpoint', 'trunk']) {
    const r = plan.roles.find((r) =>
      r.name.startsWith(
        lifecycle === 'endpoint' ? 'endpoint-worker-' : 'trunk-verifier-',
      ),
    );
    const token = (
      await required(
        'auth/token/create/' + r.name,
        r.request,
        issuers[lifecycle],
      )
    ).auth.client_token;
    const identity = (
      await required('auth/token/lookup-self', undefined, token)
    ).data;
    preserved.push({ token, identity, lifecycle });
  }
  const inventory = new Map();
  const targetNames = new Set(proposal.policies.map((p) => p.name));
  for (const p of plan.policies.filter((p) => !targetNames.has(p.name))) {
    const key = 'sys/policies/acl/' + p.name;
    inventory.set(key, JSON.stringify((await required(key)).data));
  }
  for (const r of [...plan.roles, ...c.human.issuerRoles]) {
    const key = 'auth/token/roles/' + r.name;
    inventory.set(key, JSON.stringify((await required(key)).data));
  }
  // Seed the reviewed pre-hardening bodies only in this fresh disposable fixture.
  // Maintenance must demonstrate original-to-candidate transitions, not just no-op writes.
  out.maintenanceBaselines = [];
  for (const p of proposal.policies) {
    const candidate =
      p.name === c.human.policyName
        ? c.human.policy
        : plan.policies.find((x) => x.name === p.name).policy;
    // Reconstruct only the historical unconstrained issuance blocks for this
    // disposable transition rehearsal. The immutable reviewed hash below must
    // match before the fixture installs anything; production plans stay hardened.
    const body = candidate.replaceAll(
      /path "(auth\/token\/create\/[^"\n]+)" \{\n {2}capabilities = \["update"\]\n {2}required_parameters = [^\n]+\n {2}allowed_parameters = \{\n(?: {4}[^\n]+\n)+ {2}\}\n\}/g,
      'path "$1" { capabilities = ["update"] }',
    );
    check(
      createHash('sha256').update(body).digest('hex') ===
        p.expectedCurrentSha256,
      'maintenance_baseline_hash',
    );
    await required('sys/policies/acl/' + p.name, { policy: body });
    out.maintenanceBaselines.push({
      name: p.name,
      sha256: p.expectedCurrentSha256,
    });
  }
  // Ticket is minted through the real constrained issuer, never fixture root.
  const op = randomUUID();
  const name = 'endpoint-maintenance-' + op;
  const pp = 'sys/policies/acl/' + name;
  const rp = 'auth/token/roles/' + name;
  const cp = 'auth/token/create/' + name;
  const baselineEndpoint = (
    await required('sys/policies/acl/endpoint-restricted-issuer')
  ).data.policy;
  const requestBody = {
    policies: [name],
    no_default_policy: true,
    ttl: '300s',
    explicit_max_ttl: '300s',
    renewable: false,
  };
  const grant = `path "${cp}" { capabilities = ["update"]\nrequired_parameters = ["policies", "no_default_policy", "ttl", "explicit_max_ttl", "renewable"]\nallowed_parameters = { "policies" = [["${name}"]] "ttl" = ["300s"] "explicit_max_ttl" = ["300s"] "no_default_policy" = [true] "renewable" = [false] } }`;
  const initial =
    self + '\npath "sys/storage/raft/snapshot" { capabilities = ["read"] }';
  const role = {
    allowed_policies: [name],
    disallowed_policies: ['root', 'default'],
    allowed_policies_glob: [],
    disallowed_policies_glob: [],
    orphan: true,
    renewable: false,
    token_explicit_max_ttl: 300,
    token_period: 0,
    token_type: 'service',
  };
  // All three operations run under the native human's existing prefix permissions.
  await required(pp, { policy: initial }, session);
  await required(rp, role, session);
  await required(
    'sys/policies/acl/endpoint-restricted-issuer',
    { policy: baselineEndpoint + '\n' + grant },
    session,
  );
  const ticket = (await required(cp, requestBody, issuers.endpoint)).auth
    .client_token;
  const attr = (await required('auth/token/lookup-self', undefined, ticket))
    .data;
  check(
    attr.explicit_max_ttl === 300 &&
      attr.orphan &&
      !attr.renewable &&
      !attr.period &&
      attr.policies.length === 1 &&
      attr.policies[0] === name &&
      !attr.identity_policies?.length,
    'ticket_attributes',
  );
  out.ticketAttributes = {
    explicitMaximum: attr.explicit_max_ttl,
    renewable: attr.renewable,
    orphan: attr.orphan,
    policies: attr.policies,
    identityPolicies: attr.identity_policies ?? [],
  };
  for (const delta of [
    { ttl: '301s' },
    { explicit_max_ttl: '0' },
    { renewable: true },
    { period: '1s' },
    { policies: [name, 'default'] },
    { display_name: 'extra' },
    { ttl: 300 },
    { no_default_policy: false },
  ]) {
    const r = await api(cp, { ...requestBody, ...delta }, issuers.endpoint);
    const child = remember(r);
    if (child) await revoke(child);
    check(r.status === 403 && !child, 'ticket_parameter_denial');
    out.maintenance.push({
      test: 'ticket_parameter',
      changed: Object.keys(delta)[0],
      status: r.status,
    });
  }
  for (const [p, b] of [
    ['auth/token/create', requestBody],
    [pp, { policy: initial }],
    ['sys/storage/raft/snapshot', {}],
    ['sys/storage/raft/snapshot-force', {}],
    ['sys/generate-root/attempt', {}],
    ['sys/mounts/review', { type: 'kv' }],
    ['myims-endpoint/data/anything', {}],
    ['auth/token/revoke-accessor', { accessor: 'synthetic' }],
  ]) {
    const r = await api(p, b, ticket);
    check(
      r.status === 403 ||
        (p === 'sys/generate-root/attempt' && r.status === 405),
      'snapshot_scope',
    );
    out.maintenance.push({ test: 'snapshot_scope', path: p, status: r.status });
  }
  const getSnapshot = (token) =>
    new Promise((resolve, reject) => {
      const req = request(
        'https://endpoint-secrets:8200/v1/sys/storage/raft/snapshot',
        { ca, headers: { 'X-Vault-Token': token } },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on('data', (b) => {
            size += b.length;
            if (size > 16777216) req.destroy();
            else chunks.push(b);
          });
          res.on('end', () =>
            res.statusCode === 200
              ? resolve(Buffer.concat(chunks))
              : reject(new Error('review_snapshot_status')),
          );
          res.on('error', reject);
        },
      );
      req.setTimeout(10000, () => req.destroy());
      req.on('error', reject);
      req.end();
    });
  const snapshot = await getSnapshot(ticket);
  const backupGate = disposableBackupGate(need);
  out.snapshotAuditCheckpoint = backupGate.gate(snapshot);
  out.snapshot = {
    ...verifyRecoverySnapshot(snapshot),
    bytes: snapshot.length,
  };
  // Inject an invalid snapshot before the gate: no elevation or hardening may occur.
  let corruptRejected = false;
  try {
    verifyRecoverySnapshot(
      snapshot.subarray(0, Math.floor(snapshot.length / 2)),
    );
  } catch {
    corruptRejected = true;
  }
  check(corruptRejected, 'corrupt_snapshot_accepted');
  out.faultCheckpoints.push({
    checkpoint: 'snapshot_validation',
    injected: 'truncated_archive',
    rejected: true,
  });
  // Compare raw HCL parameter glob matching against base64-encoded policy bodies.
  const maintainer = proposal.policies.find(
    (p) => p.name === 'platform-deployment-maintainer',
  );
  const targetPath = 'sys/policies/acl/' + maintainer.name;
  const rawPath = 'sys/policies/acl/endpoint-maintenance-body-probe';
  await required(rawPath, { policy: maintainer.proposedPolicy });
  const constrained = (value) =>
    `path "${rawPath}" { capabilities = ["read", "update"]\nrequired_parameters = ["policy"]\nallowed_parameters = { "policy" = [${JSON.stringify(value)}] } }`;
  await required(
    pp,
    { policy: self + '\n' + constrained(maintainer.proposedPolicy) },
    session,
  );
  const rawPositive = await api(
    rawPath,
    { policy: maintainer.proposedPolicy },
    ticket,
  );
  check(rawPositive.status === 204, 'raw_exact_policy_positive');
  const mutated = maintainer.proposedPolicy.replace(
    'endpoint-*',
    'endpoint-expanded*',
  );
  const globResponse = await api(rawPath, { policy: mutated }, ticket);
  out.rawPolicyBodyGlob = {
    status: globResponse.status,
    changedBodyAccepted: globResponse.status === 204,
    exactBodyStatus: rawPositive.status,
  };
  // Restore only the fixture's candidate. This is evidence against raw-body matching.
  await api(rawPath, undefined, root, 'DELETE');
  const shaBody = (body) => createHash('sha256').update(body).digest('hex');
  const encoded = (p) => Buffer.from(p).toString('base64');
  const finalPolicy =
    self +
    '\n' +
    proposal.policies
      .map((p) => {
        const pth = 'sys/policies/acl/' + p.name;
        return `path "sys/policy/${p.name}" { capabilities = ["read"] }\npath "${pth}" { capabilities = ["update"]\nrequired_parameters = ["policy"]\nallowed_parameters = { "policy" = [${JSON.stringify(encoded(p.proposedPolicy))}] } }`;
      })
      .join('\n') +
    `\npath "${pp}" { capabilities = ["delete"] }\npath "${rp}" { capabilities = ["delete"] }`;
  await required(pp, { policy: finalPolicy }, session);
  for (const p of proposal.policies) {
    const pth = 'sys/policies/acl/' + p.name;
    for (const body of [
      { policy: p.proposedPolicy },
      { policy: encoded(p.proposedPolicy + '\n') },
      { policy: encoded(p.proposedPolicy), extra: true },
      {},
    ]) {
      const r = await api(pth, body, ticket);
      check(r.status === 403, 'exact_body_denial');
      out.maintenance.push({
        test: 'exact_body_negative',
        target: p.name,
        status: r.status,
      });
    }
    const beforeWrite = (
      await required('sys/policy/' + p.name, undefined, ticket)
    ).data;
    const beforeBody = beforeWrite.rules ?? beforeWrite.policy;
    check(
      shaBody(beforeBody) ===
        (p.name === 'endpoint-restricted-issuer'
          ? shaBody(baselineEndpoint + '\n' + grant)
          : p.expectedCurrentSha256),
      'pre_write_hash_mismatch',
    );
    const r = await api(pth, { policy: encoded(p.proposedPolicy) }, ticket);
    check(r.status === 204, 'encoded_policy_write');
    const readback = (await required('sys/policy/' + p.name, undefined, ticket))
      .data;
    const stored = readback.rules ?? readback.policy;
    check(stored === p.proposedPolicy, 'stored_policy_mismatch');
    out.maintenance.push({
      test: 'exact_body_positive',
      target: p.name,
      status: r.status,
      sha256: createHash('sha256').update(stored).digest('hex'),
    });
  }
  // Final endpoint body removed grant; an old issuer also sees current policy immediately.
  const late = await api(cp, requestBody, issuers.endpoint);
  check(late.status === 403 && !remember(late), 'grant_removal');
  out.faultCheckpoints.push({
    checkpoint: 'after_final_endpoint_write',
    test: 'old_issuer_cannot_remint',
    status: late.status,
  });
  for (const [p, b] of [
    ['auth/token/create', requestBody],
    ['auth/token/roles/platform-endpoint-issuer', {}],
    ['sys/policies/acl/trunk-unreviewed', { policy: self }],
    ['sys/storage/raft/snapshot-force', {}],
    ['auth/token/revoke-accessor', { accessor: 'synthetic' }],
    ['myims-trunk/data/anything', {}],
  ]) {
    const r = await api(p, b, ticket);
    check(r.status === 403, 'maintenance_scope');
    out.maintenance.push({
      test: 'maintenance_scope',
      path: p,
      status: r.status,
    });
  }
  const deletes = await Promise.all([
    api(rp, undefined, ticket, 'DELETE'),
    api(rp, undefined, ticket, 'DELETE'),
  ]);
  check(
    deletes.every((r) => r.status === 204),
    'role_cleanup_race',
  );
  const policyDelete = await api(pp, undefined, ticket, 'DELETE');
  check(policyDelete.status === 204, 'policy_delete');
  await required(
    'auth/token/revoke-accessor',
    { accessor: attr.accessor },
    session,
  );
  const accessorLookup = await api(
    'auth/token/lookup-accessor',
    { accessor: attr.accessor },
    session,
  );
  check(accessorLookup.status === 400, 'deleted_policy_ticket_revocation');
  await revoke(ticket);
  const revokedWrite = await api(
    targetPath,
    { policy: encoded(maintainer.proposedPolicy) },
    ticket,
  );
  check(revokedWrite.status === 403, 'revoked_ticket_write');
  out.faultCheckpoints.push(
    {
      checkpoint: 'revocation',
      status: revokedWrite.status,
      accessorLookup: accessorLookup.status,
    },
    { checkpoint: 'role_cleanup_race', statuses: deletes.map((r) => r.status) },
    {
      checkpoint: 'policy_cleanup',
      status: policyDelete.status,
      revokedByNativeHumanAccessor: true,
    },
  );
  out.exactMaintenancePolicy = finalPolicy;
  out.bootstrap = {
    name,
    policyPath: pp,
    rolePath: rp,
    createPath: cp,
    initialPolicy: initial,
    role,
    issuerAppend: grant,
    request: requestBody,
    preBackupWrites: 3,
    retainedAuthorized: false,
  };
  out.preservedLeases = [];
  for (const original of preserved) {
    const now = (
      await required('auth/token/lookup-self', undefined, original.token)
    ).data;
    check(
      now.expire_time === original.identity.expire_time &&
        now.explicit_max_ttl === original.identity.explicit_max_ttl &&
        JSON.stringify(now.policies) ===
          JSON.stringify(original.identity.policies),
      'existing_token_lease_changed',
    );
    out.preservedLeases.push({
      lifecycle: original.lifecycle,
      unchangedExpiry: true,
      unchangedMaximum: true,
      unchangedPolicies: true,
    });
    await revoke(original.token);
  }
  for (const [key, expected] of inventory) {
    check(
      JSON.stringify((await required(key)).data) === expected,
      'material_policy_or_role_changed',
    );
  }
  out.preservedMaterialPoliciesAndRoles = inventory.size;
  out.interruptions = await rehearseInterruptions({
    ...c,
    getSnapshot,
    verifyAudit: backupGate.gate,
    self,
  });
  out.auditAppendPreservation = backupGate.finalAudit();
  return out;
}
