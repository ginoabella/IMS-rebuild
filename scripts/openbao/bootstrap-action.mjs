// Explicit isolated bootstrap helper. The host must authorize and bind this operation.
import {
  readFileSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
  appendFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ProtectedBaoClient } from './protected-client.mjs';
import { provisionBootstrap } from './bootstrap-provision.mjs';
import { reviewBootstrapPrestate } from './bootstrap-prestate.mjs';
import { stdioGuardGate } from './guard-gate.mjs';
process.umask(0o077);
const [action, operation] = process.argv.slice(2);
let stage = 'operation';
process.on('uncaughtException', (error) => {
  const safe = new Set([
    'Baseline refused',
    'Review bound exceeded',
    'Review status mismatch',
    'List unavailable',
    'List malformed',
    'Unexpected principal or resource',
    'Auth composition changed',
    'Policy baseline changed',
    'Role or alias changed',
    'Custodian mapping changed',
    'Unexpected entity',
    'Entity authority changed',
    'Entity alias changed',
    'Alias mapping changed',
  ]);
  const code = safe.has(error.message)
    ? error.message.toLowerCase().replaceAll(' ', '-')
    : 'details-suppressed';
  console.error(
    JSON.stringify({ status: 'bootstrap-action-failed', stage, code }),
  );
  process.exitCode = 1;
});
const candidate = JSON.parse(readFileSync('/candidate.json'));
const recovery = JSON.parse(readFileSync('/recovery/recovery-started.json'));
if (
  process.argv.length !== 4 ||
  candidate.operationId !== operation ||
  recovery.operationId !== operation ||
  !/^[a-f0-9-]{36}$/.test(operation)
)
  throw new Error('Operation refused');
const client = new ProtectedBaoClient(
  '/recovery/custodian.token',
  '/seal/ca.crt',
);
const save = (path, data) => {
  writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data), {
    mode: 0o600,
    flag: 'wx',
  });
  for (const p of [path, path.slice(0, path.lastIndexOf('/'))]) {
    const fd = openSync(p, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
};
if (action === 'review') {
  stage = 'semantic-prestate';
  const reviewed = await reviewBootstrapPrestate(client, candidate);
  save('/recovery/install-plan.json', { ...candidate, ...reviewed });
  console.log(
    JSON.stringify({
      status: 'prestate-reviewed',
      reads: reviewed.prestateReads.length,
      reviewDigest: reviewed.reviewDigest,
      entityCount: reviewed.entityCount,
      policyCount: reviewed.policyCount,
    }),
  );
} else if (action === 'install') {
  stage = 'provisioning';
  const password = randomBytes(48).toString('base64url');
  save('/maintenance-output/password', password);
  const gate = stdioGuardGate(operation);
  const mark = async (event, index) => {
    const path = '/install-state/journal.jsonl';
    appendFileSync(
      path,
      JSON.stringify({ operationId: operation, event, index }) + '\n',
      { mode: 0o600 },
    );
    for (const p of [path, '/install-state']) {
      const fd = openSync(p, 'r');
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    }
  };
  try {
    const result = await provisionBootstrap({
      client,
      plan: JSON.parse(readFileSync('/recovery/install-plan.json')),
      password,
      mark,
      persist: async (value) =>
        save('/install-state/snapshot-secret.json', value),
      assertFresh: gate.check,
    });
    const roleId = (
      await client.required(
        'auth/platform-backup/role/platform-raft-snapshot-reader/role-id',
      )
    ).data.role_id;
    const secret = JSON.parse(
      readFileSync('/install-state/snapshot-secret.json'),
    );
    save('/snapshot-credentials/approle.json', {
      roleId,
      secretId: secret.secretId,
    });
    save(
      '/snapshot-credentials/ca.crt',
      readFileSync('/seal/ca.crt').toString(),
    );
    console.log(JSON.stringify(result));
  } finally {
    gate.close();
  }
} else if (action === 'accept') {
  stage = 'acceptance';
  for (const write of candidate.writes.filter((w) => w.body?.policy)) {
    if ((await client.required(write.path)).data.policy !== write.body.policy)
      throw new Error('Policy readback failed');
  }
  const role = (
    await client.required(
      'auth/platform-backup/role/platform-raft-snapshot-reader',
    )
  ).data;
  const expected = {
    bind_secret_id: true,
    secret_id_ttl: 2592000,
    secret_id_num_uses: 1000,
    token_policies: ['platform-raft-snapshot-reader'],
    token_no_default_policy: true,
    token_type: 'service',
    token_ttl: 300,
    token_max_ttl: 300,
    token_explicit_max_ttl: 300,
    token_period: 0,
    token_num_uses: 0,
  };
  if (
    Object.entries(expected).some(
      ([k, v]) => JSON.stringify(role[k]) !== JSON.stringify(v),
    )
  )
    throw new Error('Role readback failed');
  const session = await client.call(
    'auth/platform-custodian/login/platform-backup-maintainer',
    {
      password: readFileSync('/maintenance-output/password', 'utf8'),
    },
  );
  const token = session.value?.auth?.client_token;
  if (!token) throw new Error('Maintenance login uncertain');
  let failed = false;
  try {
    const auth = session.value.auth;
    if (
      session.status !== 200 ||
      JSON.stringify(auth.policies) !== '["platform-backup-rotation"]' ||
      (auth.identity_policies?.length ?? 0) ||
      auth.lease_duration < 1 ||
      auth.lease_duration > 900
    )
      throw new Error('Maintenance scope failed');
    for (const path of [
      'sys/storage/raft/snapshot',
      'sys/policies/acl/platform-backup-rotation',
      'sys/policies/acl/platform-deployment-maintainer',
    ]) {
      if ((await client.call(path, undefined, 'GET', token)).status !== 403)
        throw new Error('Denial failed');
    }
    if (
      (
        await client.call(
          'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
          { ttl: '721h', num_uses: '1000' },
          'POST',
          token,
        )
      ).status !== 403
    )
      throw new Error('Issuance denial failed');
  } catch {
    failed = true;
  }
  let revoked, denied;
  try {
    revoked = [200, 204].includes(
      (await client.call('auth/token/revoke-self', {}, 'POST', token)).status,
    );
  } catch {
    revoked = false;
  }
  try {
    denied =
      (await client.call('auth/token/lookup-self', undefined, 'GET', token))
        .status === 403;
  } catch {
    denied = false;
  }
  if (failed || !revoked || !denied) throw new Error('Acceptance incomplete');
  console.log(
    JSON.stringify({
      status: 'bootstrap-acceptance-passed',
      maintenanceRevoked403: true,
    }),
  );
} else throw new Error('Action refused');
