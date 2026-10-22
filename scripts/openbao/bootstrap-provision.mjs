// Operation-bound provisioning core. No root generation, CLI or startup hook.
import { createHash } from 'node:crypto';
const sha = (v) => createHash('sha256').update(v).digest('hex');
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export async function provisionBootstrap({
  client,
  plan,
  password,
  mark,
  persist,
  assertFresh,
}) {
  // The host controller supplies and independently verifies backup proof. Its
  // operation-specific installation plan also pins every provider pre-state read.
  if (
    !uuid.test(plan.operationId ?? '') ||
    plan.writes?.length !== 9 ||
    sha(JSON.stringify(plan.writes)) !== plan.writesSha256 ||
    !Array.isArray(plan.prestateReads) ||
    !plan.prestateReads.length ||
    plan.prestateReviewApproved !== true ||
    typeof password !== 'string' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(password)
  )
    throw new Error('Bootstrap plan refused');
  const exactPaths = [
    'sys/policies/acl/endpoint-restricted-issuer',
    'sys/policies/acl/trunk-restricted-issuer',
    'sys/policies/acl/platform-deployment-maintainer',
    'sys/policies/acl/platform-raft-snapshot-reader',
    'sys/auth/platform-backup',
    'auth/platform-backup/role/platform-raft-snapshot-reader',
    'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
    'sys/policies/acl/platform-backup-rotation',
    'auth/platform-custodian/users/platform-backup-maintainer',
  ];
  if (
    JSON.stringify(plan.writes.map((w) => w.path)) !==
    JSON.stringify(exactPaths)
  )
    throw new Error('Write scope refused');
  const identity = await client.required('auth/token/lookup-self');
  if (JSON.stringify(identity.data?.policies) !== '["root"]')
    throw new Error('Bootstrap identity refused');
  for (const read of plan.prestateReads) {
    if (
      !['GET', 'LIST'].includes(read.method) ||
      !/^[a-zA-Z0-9/_-]+$/.test(read.path)
    )
      throw new Error('Prestate plan refused');
    const value = await client.call(read.path, undefined, read.method);
    if (
      value.status !== read.status ||
      sha(JSON.stringify(value.value?.data ?? null)) !== read.responseSha256
    )
      throw new Error('Prestate changed');
  }
  await assertFresh();
  for (let i = 0; i < plan.writes.length; i++) {
    const write = plan.writes[i];
    if (write.method !== 'POST' || !/^[a-zA-Z0-9/_-]+$/.test(write.path))
      throw new Error('Write plan refused');
    await assertFresh();
    // Durable before-send marker is essential: a dropped reply may have committed.
    await mark('write-started', i);
    const body =
      i === 8
        ? { ...write.bodyWithoutProtectedPassword, password }
        : write.body;
    const response = await client.call(write.path, body, 'POST');
    if (response.status < 200 || response.status > 299)
      throw new Error('Write rejected or uncertain');
    if (i === 6) {
      const d = response.value?.data;
      if (
        typeof d?.secret_id !== 'string' ||
        typeof d?.secret_id_accessor !== 'string'
      )
        throw new Error('Credential output uncertain');
      // This adapter must use exclusive protected, fsynced storage. No response
      // or credential is returned to the host, journal, receipt, or error message.
      await persist({ secretId: d.secret_id, accessor: d.secret_id_accessor });
    }
    await mark('write-acknowledged', i);
  }
  return { status: 'nine-writes-acknowledged', operationId: plan.operationId };
}
