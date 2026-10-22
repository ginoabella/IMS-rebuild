// Disposable fixture adapter only; not a retained installation entry point.
import {
  readFileSync,
  writeFileSync,
  openSync,
  fsyncSync,
  closeSync,
  appendFileSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { ProtectedBaoClient } from '../openbao/protected-client.mjs';
import { provisionBootstrap } from '../openbao/bootstrap-provision.mjs';
const sha = (v) => createHash('sha256').update(v).digest('hex');
const [action, operation] = process.argv.slice(2);
const candidate = JSON.parse(readFileSync('/candidate.json'));
if (candidate.fixtureOnly !== true || candidate.operationId !== operation)
  throw new Error('Fixture binding refused');
let lastPath = 'fixture-input';
process.on('uncaughtException', () => {
  console.log(
    JSON.stringify({ status: 'fixture-action-failed', action, lastPath }),
  );
  process.exitCode = 1;
});
const client = new ProtectedBaoClient(
  '/recovery/custodian.token',
  '/seal/ca.crt',
);
const nativeCall = client.call.bind(client);
client.call = async (...args) => {
  lastPath = args[0];
  const result = await nativeCall(...args);
  if (
    action === 'install' &&
    Number.isInteger(candidate.fixtureFaultAfterWrite) &&
    args[2] === 'POST' &&
    args[0] === candidate.writes[candidate.fixtureFaultAfterWrite].path
  )
    throw new Error('Injected lost response after native commit');
  return result;
};
const save = (p, v) => {
  writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v), {
    mode: 0o600,
    flag: 'wx',
  });
  const fd = openSync(p, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
};
if (action === 'review') {
  const paths = [
    'sys/auth',
    'sys/mounts',
    ...candidate.writes.slice(0, 3).map((w) => w.path),
    ...candidate.roles.map((r) => 'auth/token/roles/' + r.name),
    'auth/platform-custodian/users/platform-owner-custodian',
    ...candidate.writes
      .filter((_, i) => [3, 5, 7, 8].includes(i))
      .map((w) => w.path),
  ];
  const reads = paths.map((path) => ({ path, method: 'GET' }));
  for (const path of [
    'identity/entity/id',
    'identity/group/id',
    'auth/platform-custodian/users',
  ])
    reads.push({ path, method: 'LIST' });
  const prestateReads = [];
  for (const read of reads) {
    const result = await client.call(read.path, undefined, read.method);
    if (![200, 404].includes(result.status))
      throw new Error('Fixture prestate unavailable');
    prestateReads.push({
      ...read,
      status: result.status,
      responseSha256: sha(JSON.stringify(result.value?.data ?? null)),
    });
    // No previously logged-in fixture users or groups: unknown composition stops.
    if (read.path.startsWith('identity/') && result.value?.data?.keys?.length)
      throw new Error('Unexpected fixture identity');
  }
  save('/recovery/install-plan.json', {
    ...candidate,
    prestateReads,
    prestateReviewApproved: true,
  });
  console.log(
    JSON.stringify({ status: 'fixture-prestate-pinned', reads: reads.length }),
  );
} else if (action === 'install') {
  const plan = JSON.parse(readFileSync('/recovery/install-plan.json'));
  const password = randomBytes(48).toString('base64url');
  save('/protected-output/maintenance.password', password);
  const assertFresh = async () => {
    const proof = JSON.parse(readFileSync('/proof/gate.json'));
    const age = Date.now() - Date.parse(proof.capturedAt);
    if (
      proof.operationId !== operation ||
      proof.status !== 'retrieval-verified' ||
      age < 0 ||
      age > 900000 ||
      !Number.isFinite(Date.parse(proof.guardDeadline)) ||
      Date.now() >= Date.parse(proof.guardDeadline) - 15000
    )
      throw new Error('Fixture backup gate refused');
  };
  const mark = async (event, index) => {
    const p = '/protected-output/install-journal.jsonl';
    appendFileSync(p, JSON.stringify({ event, index }) + '\n', { mode: 0o600 });
    const fd = openSync(p, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  };
  const persist = async (value) =>
    save('/protected-output/snapshot-secret.json', value);
  const result = await provisionBootstrap({
    client,
    plan,
    password,
    mark,
    persist,
    assertFresh,
  });
  const roleId = (
    await client.required(
      'auth/platform-backup/role/platform-raft-snapshot-reader/role-id',
    )
  ).data.role_id;
  const secret = JSON.parse(
    readFileSync('/protected-output/snapshot-secret.json'),
  );
  save('/protected-output/approle.json', { roleId, secretId: secret.secretId });
  save('/protected-output/ca.crt', readFileSync('/seal/ca.crt').toString());
  console.log(JSON.stringify(result));
} else if (action === 'accept') {
  const password = readFileSync(
    '/protected-output/maintenance.password',
    'utf8',
  );
  const session = await client.call(
    'auth/platform-custodian/login/platform-backup-maintainer',
    { password },
  );
  const token = session.value?.auth?.client_token;
  if (!token) throw new Error('Fixture maintenance login unavailable');
  let acceptanceFailed = false;
  try {
    if (
      JSON.stringify(session.value.auth.policies) !==
        '["platform-backup-rotation"]' ||
      session.value.auth.lease_duration > 900
    )
      throw new Error('Maintenance scope mismatch');
    for (const path of [
      'sys/storage/raft/snapshot',
      'sys/policies/acl/platform-backup-rotation',
    ]) {
      if ((await client.call(path, undefined, 'GET', token)).status !== 403)
        throw new Error('Maintenance denial missing');
    }
    const path =
      'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id';
    if (
      (
        await client.call(
          path,
          { ttl: '721h', num_uses: '1000' },
          'POST',
          token,
        )
      ).status !== 403
    )
      throw new Error('Rotation constraint missing');
    for (const write of candidate.writes.filter((w) => w.body?.policy)) {
      if ((await client.required(write.path)).data.policy !== write.body.policy)
        throw new Error('Policy readback mismatch');
    }
    console.log(
      JSON.stringify({
        status: 'fixture-policy-readback-and-maintenance-denials-passed',
      }),
    );
  } catch {
    acceptanceFailed = true;
  }
  let cleanupConfirmed;
  try {
    const revoked = await client.call(
      'auth/token/revoke-self',
      {},
      'POST',
      token,
    );
    cleanupConfirmed = [200, 204].includes(revoked.status);
  } catch {
    cleanupConfirmed = false;
  }
  try {
    cleanupConfirmed =
      (await client.call('auth/token/lookup-self', undefined, 'GET', token))
        .status === 403 && cleanupConfirmed;
  } catch {
    cleanupConfirmed = false;
  }
  if (acceptanceFailed || !cleanupConfirmed)
    throw new Error('Fixture acceptance or cleanup failed');
} else throw new Error('Fixture action refused');
