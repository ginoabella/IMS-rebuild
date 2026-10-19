// MANUAL ONLY. Authenticated read-only backup/inventory for one confirmed recovery.
// Never called by startup. Does not install policies/auth, issue tokens or restore data.
import {
  constants,
  closeSync,
  copyFileSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { request } from 'node:https';
import { protectedFile, ProtectedBaoClient } from './protected-client.mjs';
import { verifyRecoverySnapshot } from './recovery-snapshot.mjs';

process.umask(0o077);
let stage = 'operation';
const save = (name, value) =>
  writeFileSync(`/backup/${name}`, JSON.stringify(value), {
    flag: 'wx',
    mode: 0o600,
  });
// lookup-self contains a bearer ID. Persist only revocation/lease metadata.
const tokenMetadata = (value) =>
  Object.fromEntries(
    [
      'accessor',
      'policies',
      'identity_policies',
      'orphan',
      'path',
      'ttl',
      'creation_ttl',
      'explicit_max_ttl',
      'expire_time',
      'renewable',
      'period',
      'type',
    ]
      .filter((key) => Object.hasOwn(value, key))
      .map((key) => [key, value[key]]),
  );
function syncFile(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
try {
  const [operationId] = process.argv.slice(2);
  if (
    process.argv.length !== 3 ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId ?? '')
  )
    throw new Error();
  const op = JSON.parse(protectedFile('/recovery/recovery-started.json'));
  const backup = lstatSync('/backup');
  if (
    op.operationId !== operationId ||
    !backup.isDirectory() ||
    backup.isSymbolicLink() ||
    backup.mode & 0o077 ||
    !readFileSync('/proc/self/mountinfo', 'utf8')
      .split('\n')
      .some(
        (line) =>
          line.split(' ')[4] === '/recovery' && line.includes(' - tmpfs '),
      )
  )
    throw new Error();
  const client = new ProtectedBaoClient(
    '/recovery/custodian.token',
    '/seal/ca.crt',
  );
  const self = await client.required('auth/token/lookup-self');
  if (JSON.stringify(self.data?.policies) !== JSON.stringify(['root']))
    throw new Error();
  stage = 'audit_configuration';
  const audit = await client.required('sys/audit');
  save('audit-configuration.json', audit);
  const a = audit.data?.['endpoint/'];
  if (
    Object.keys(audit.data ?? {}).join(',') !== 'endpoint/' ||
    a?.type !== 'file' ||
    a.options?.file_path !== '/bao/audit/endpoint.json' ||
    a.options?.log_raw !== 'false'
  )
    throw new Error();

  stage = 'consistent_snapshot';
  const token = protectedFile('/recovery/custodian.token')
    .toString('utf8')
    .trim();
  const ca = readFileSync('/seal/ca.crt');
  const snapshot = await new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Snapshot unavailable'));
    const req = request(
      'https://endpoint-secrets:8200/v1/sys/storage/raft/snapshot',
      { method: 'GET', ca, headers: { 'X-Vault-Token': token } },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 134217728) req.destroy();
          else chunks.push(chunk);
        });
        res.on('error', fail);
        res.on('end', () => {
          if (res.statusCode !== 200 || size < 512) return fail();
          resolve(Buffer.concat(chunks));
        });
      },
    );
    const timer = setTimeout(() => req.destroy(), 30000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', fail);
    req.end();
  });
  writeFileSync('/backup/before.snapshot', snapshot, {
    flag: 'wx',
    mode: 0o600,
  });
  syncFile('/backup/before.snapshot');
  stage = 'offline_snapshot_integrity';
  save('snapshot-integrity.json', verifyRecoverySnapshot(snapshot));

  stage = 'separate_audit_preservation';
  const before = lstatSync('/audit/endpoint.json');
  if (!before.isFile() || before.isSymbolicLink()) throw new Error();
  copyFileSync(
    '/audit/endpoint.json',
    '/backup/before.audit.json',
    constants.COPYFILE_EXCL,
  );
  // copyFile preserves the original mode; the backup directory is owner-only.
  // The trusted host must also verify the resulting file mode before acceptance.
  const after = lstatSync('/audit/endpoint.json');
  const saved = lstatSync('/backup/before.audit.json');
  if (
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    saved.size !== before.size ||
    saved.mode & 0o077
  )
    throw new Error();
  syncFile('/backup/before.audit.json');

  stage = 'read_only_inventory';
  const inventory = {
    operationId,
    capturedAt: new Date().toISOString(),
    self: tokenMetadata(self.data),
    mounts: (await client.required('sys/mounts')).data,
    auth: (await client.required('sys/auth')).data,
    audit: audit.data,
    policies: {},
    roles: {},
    tokens: [],
    leases: [],
  };
  // Persist each known response before further I/O. All inventory stays protected.
  save('inventory-start.json', inventory);
  const policies = (
    await client.required('sys/policies/acl', undefined, 'LIST')
  ).data?.keys;
  if (!Array.isArray(policies) || policies.length > 512) throw new Error();
  for (const name of policies) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error();
    if (name !== 'root')
      inventory.policies[name] = (
        await client.required(`sys/policies/acl/${name}`)
      ).data;
  }
  const roles = await client.call('auth/token/roles', undefined, 'LIST');
  if (![200, 404].includes(roles.status)) throw new Error();
  const names = roles.value.data?.keys ?? [];
  if (!Array.isArray(names) || names.length > 256) throw new Error();
  for (const name of names) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error();
    inventory.roles[name] = (
      await client.required(`auth/token/roles/${name}`)
    ).data;
  }
  const accessors = (
    await client.required('auth/token/accessors', undefined, 'LIST')
  ).data?.keys;
  if (!Array.isArray(accessors) || accessors.length > 512) throw new Error();
  for (const accessor of accessors)
    inventory.tokens.push(
      tokenMetadata(
        (await client.required('auth/token/lookup-accessor', { accessor }))
          .data,
      ),
    );
  const queue = [''];
  while (queue.length) {
    const prefix = queue.shift();
    const result = await client.call(
      `sys/leases/lookup${prefix ? `/${prefix}` : ''}`,
      undefined,
      'LIST',
    );
    if (![200, 404].includes(result.status)) throw new Error();
    const keys = result.value.data?.keys ?? [];
    if (!Array.isArray(keys) || keys.length + queue.length > 1024)
      throw new Error();
    for (const key of keys) {
      const path = prefix + key;
      if (!/^[a-zA-Z0-9/_.-]+$/.test(path) || path.includes('..'))
        throw new Error();
      if (key.endsWith('/')) queue.push(path);
      else {
        inventory.leases.push(
          (await client.required('sys/leases/lookup', { lease_id: path })).data,
        );
        if (inventory.leases.length > 1024) throw new Error();
      }
    }
  }
  save('inventory.json', inventory);
  syncFile('/backup/inventory.json');
  save('download-complete.json', {
    operationId,
    snapshotSha256: createHash('sha256').update(snapshot).digest('hex'),
    capturedAt: new Date().toISOString(),
    checkpoint: 'requires_offline_integrity_and_exact_privilege_review',
  });
  console.log(
    JSON.stringify({
      state: 'backup_and_inventory_preserved',
      operationId,
      privilegedWritesAuthorizedByThisHelper: false,
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      state: 'stopped_before_privileged_changes',
      stage,
      failureCode: 'backup_or_inventory_unverified',
    }),
  );
  process.exitCode = 1;
}
