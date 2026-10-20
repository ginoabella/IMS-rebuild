// MANUAL ONLY. Prepared native human-auth handoff; never called by normal startup.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';
import { protectedFile, ProtectedBaoClient } from './protected-client.mjs';
import { requireRecoveryCheckpoint } from './recovery-checkpoint.mjs';
import { readCustodianPassword } from './custodian-password.mjs';
process.umask(0o077);
let stage = 'approval',
  issuedToken;
try {
  const [action, value] = process.argv.slice(2);
  if (process.argv.length !== 4) throw new Error();
  if (action === 'plan') {
    console.log(JSON.stringify(custodianSuccessionPlan(value)));
  } else {
    if (
      action !== 'apply' ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value ?? '')
    )
      throw new Error();
    const approval = JSON.parse(
      protectedFile('/recovery/custodian-succession-approved.json').toString(
        'utf8',
      ),
    );
    const age = Date.now() - Date.parse(approval.approvedAt);
    if (
      Object.keys(approval).sort().join(',') !==
        'approvedAt,operationId,username' ||
      approval.operationId !== value ||
      approval.username !== 'platform-owner-custodian' ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 300000
    )
      throw new Error();
    const plan = custodianSuccessionPlan(approval.username);
    if (
      !readFileSync('/proc/self/mountinfo', 'utf8')
        .split('\n')
        .some(
          (line) =>
            line.split(' ')[4] === '/recovery' && line.includes(' - tmpfs '),
        )
    )
      throw new Error();
    const operation = JSON.parse(
      protectedFile('/recovery/recovery-started.json').toString('utf8'),
    );
    if (
      operation.operationId !== value ||
      existsSync('/recovery/root-revoked.json') ||
      existsSync('/recovery/successor.token') ||
      existsSync('/recovery/successor.accessor') ||
      existsSync('/recovery/succession-started.json')
    )
      throw new Error();
    requireRecoveryCheckpoint(value);
    // The human must retain this exact password in separate protected custody.
    // No generation or unattended login mechanism is introduced here.
    const password = readCustodianPassword();
    const provider = new ProtectedBaoClient(
      '/recovery/custodian.token',
      '/seal/ca.crt',
    );
    stage = 'read_only_preflight';
    const identity = await provider.required('auth/token/lookup-self');
    if (JSON.stringify(identity.data?.policies) !== JSON.stringify(['root']))
      throw new Error();
    const auth = await provider.required('sys/auth');
    if (auth.data?.[`${plan.authMount}/`]) throw new Error();
    for (const path of [
      `sys/policies/acl/${plan.policyName}`,
      ...plan.issuerRoles.map((r) => `auth/token/roles/${r.name}`),
    ]) {
      if ((await provider.call(path)).status !== 404) throw new Error();
    }
    writeFileSync(
      '/recovery/succession-started.json',
      JSON.stringify({ operationId: value, username: plan.username }),
      { mode: 0o600, flag: 'wx' },
    );
    stage = 'approved_configuration';
    await provider.required(`sys/policies/acl/${plan.policyName}`, {
      policy: plan.policy,
    });
    for (const r of plan.issuerRoles)
      await provider.required(`auth/token/roles/${r.name}`, r.configuration);
    await provider.required(`sys/auth/${plan.authMount}`, {
      type: plan.authType,
      config: { default_lease_ttl: 900, max_lease_ttl: 900 },
    });
    await provider.required(`auth/${plan.authMount}/users/${plan.username}`, {
      ...plan.userConfiguration,
      password,
    });
    stage = 'fresh_human_login';
    const login = await provider.required(
      `auth/${plan.authMount}/login/${plan.username}`,
      { password },
    );
    issuedToken = login.auth?.client_token;
    if (!issuedToken) throw new Error();
    // Persist known revocation metadata before any further I/O; lost responses
    // remain uncertain and must be inventoried, never automatically retried.
    writeFileSync('/recovery/successor.accessor', login.auth.accessor, {
      mode: 0o600,
      flag: 'wx',
    });
    writeFileSync('/recovery/successor.token', issuedToken, {
      mode: 0o600,
      flag: 'wx',
    });
    const self = await provider.call(
      'auth/token/lookup-self',
      undefined,
      'GET',
      issuedToken,
    );
    const d = self.value.data;
    if (
      self.status !== 200 ||
      JSON.stringify(d?.policies) !== JSON.stringify([plan.policyName]) ||
      (d.identity_policies?.length ?? 0) !== 0 ||
      d.orphan !== true ||
      !Number.isInteger(d.ttl) ||
      d.ttl < 1 ||
      d.ttl > 900 ||
      d.explicit_max_ttl !== 900 ||
      d.period
    )
      throw new Error();
    stage = 'capability_verification';
    const denyPaths = [
      'auth/token/create',
      'auth/token/create-orphan',
      'auth/token/renew-self',
      `sys/policies/acl/${plan.policyName}`,
      `auth/${plan.authMount}/users/${plan.username}`,
      'sys/auth/unreviewed',
      'myims-endpoint/data/unreviewed',
      'myims-trunk/data/unreviewed',
      'sys/generate-root/attempt',
    ];
    const capabilities = await provider.call(
      'sys/capabilities-self',
      { paths: denyPaths },
      'POST',
      issuedToken,
    );
    if (
      capabilities.status !== 200 ||
      denyPaths.some(
        (p) =>
          JSON.stringify(
            capabilities.value[p] ?? capabilities.value.data?.[p],
          ) !== JSON.stringify(['deny']),
      )
    )
      throw new Error();
    // Issuer replacement and root-revocation independence still need separate
    // real checks before old-administrator retirement. This is not success yet.
    console.log(
      JSON.stringify({
        entrypoint: 'deployment',
        state: 'human_handoff_prepared',
        operationId: value,
        remaining: 'issuer_acl_lifetime_and_revocation_independence_checks',
      }),
    );
  }
} catch {
  // Keep known successor custody for exact revocation/reconciliation by the same
  // trusted operator. Do not rollback auth state or revoke unrelated tokens.
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      stage,
      failureCode: 'custodian_handoff_incomplete_stop_for_review',
      knownSuccessor: !!issuedToken,
    }),
  );
  process.exitCode = 1;
}
