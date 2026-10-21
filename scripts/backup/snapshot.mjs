// Inactive candidate. Explicit snapshot-only AppRole capture; never called at startup.
import { request } from 'node:https';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { boundedFile, directory, durable, syncDirectory } from './archive.mjs';
import { verifyRecoverySnapshot } from '../openbao/recovery-snapshot.mjs';

const POLICY = 'platform-raft-snapshot-reader';
const SNAPSHOT = 'sys/storage/raft/snapshot';
const FORBIDDEN = [
  'sys/storage/raft/snapshot-force',
  'sys/policies/acl/platform-deployment-maintainer',
  'secret/data/fixture',
  'auth/token/create',
  'auth/token/renew-self',
  'sys/auth/platform-backup',
  'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
  'sys/policies/acl/platform-raft-snapshot-reader',
];
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
function fail() {
  throw new Error('Snapshot capture rejected');
}
function onlyPolicy(value) {
  return Array.isArray(value) && value.length === 1 && value[0] === POLICY;
}
function tlsTransport(ca) {
  return (path, token, body, snapshot = false) =>
    new Promise((resolve, reject) => {
      const req = request(
        'https://endpoint-secrets:8200/v1/' + path,
        {
          method: body === undefined ? 'GET' : 'POST',
          ca,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Vault-Token': token } : {}),
          },
        },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > (snapshot ? 134217728 : 262144)) req.destroy();
            else chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              const bytes = Buffer.concat(chunks);
              resolve({
                status: res.statusCode,
                value: snapshot
                  ? bytes
                  : JSON.parse(bytes.toString('utf8') || '{}'),
              });
            } catch {
              reject(new Error('Invalid provider reply'));
            }
          });
        },
      );
      const timeout = setTimeout(
        () => req.destroy(new Error('Provider timeout')),
        snapshot ? 30000 : 5000,
      );
      req.on('close', () => clearTimeout(timeout));
      req.on('error', reject);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
}

export async function captureSnapshot(credentials, output, state, transport) {
  directory(credentials);
  directory(output);
  directory(state);
  const auth = JSON.parse(
    boundedFile(join(credentials, 'approle.json'), 4096).bytes,
  );
  if (
    Object.keys(auth).sort().join(',') !== 'roleId,secretId' ||
    !UUID.test(auth.roleId) ||
    !UUID.test(auth.secretId)
  )
    fail();
  const call =
    transport ??
    tlsTransport(boundedFile(join(credentials, 'ca.crt'), 65536, false).bytes);
  const lock = join(state, 'capture.lock');
  mkdirSync(lock, { mode: 0o700 });
  try {
    return await captureLocked(auth, output, state, call);
  } finally {
    rmSync(lock, { recursive: true });
  }
}

async function captureLocked(auth, output, state, call) {
  let token,
    operationId,
    cleanupConfirmed = false,
    successful = false,
    capture,
    integrity;
  try {
    const files = readdirSync(state).filter((n) => n !== 'capture.lock');
    if (
      files.length > 4096 ||
      files.some((n) => !/^(attempt|result)-[a-f0-9-]{36}\.json$/.test(n))
    )
      fail();
    // An interrupted/uncertain login or cleanup never authorizes another login.
    for (const name of files.filter((n) => n.startsWith('attempt-'))) {
      const result = name.replace('attempt-', 'result-');
      if (
        !files.includes(result) ||
        JSON.parse(boundedFile(join(state, result), 4096).bytes)
          .cleanupConfirmed !== true
      )
        fail();
    }
    if (readdirSync(output).length > 256) fail();
    operationId = randomUUID();
    durable(
      join(state, 'attempt-' + operationId + '.json'),
      JSON.stringify({ operationId, startedAt: new Date().toISOString() }),
    );
    syncDirectory(state);
    const login = await call('auth/platform-backup/login', undefined, {
      role_id: auth.roleId,
      secret_id: auth.secretId,
    });
    if (
      typeof login.value?.auth?.client_token === 'string' &&
      /^[a-zA-Z0-9._-]{16,4096}$/.test(login.value.auth.client_token)
    )
      token = login.value.auth.client_token;
    if (
      [401, 403].includes(login.status) &&
      login.value &&
      typeof login.value === 'object' &&
      !Array.isArray(login.value) &&
      login.value.auth == null
    ) {
      cleanupConfirmed = true;
      fail();
    }
    if (
      login.status !== 200 ||
      !token ||
      !onlyPolicy(login.value.auth.policies) ||
      !Number.isSafeInteger(login.value.auth.lease_duration) ||
      login.value.auth.lease_duration < 60 ||
      login.value.auth.lease_duration > 300
    )
      fail();
    const lookup = await call('auth/token/lookup-self', token);
    const self = lookup.value?.data;
    if (
      lookup.status !== 200 ||
      self?.id !== token ||
      !onlyPolicy(self?.policies) ||
      !(
        self.identity_policies == null ||
        (Array.isArray(self.identity_policies) &&
          self.identity_policies.length === 0)
      ) ||
      self.type !== 'service' ||
      self.explicit_max_ttl !== 300 ||
      !Number.isSafeInteger(self.ttl) ||
      self.ttl < 60 ||
      self.ttl > 300 ||
      !Number.isSafeInteger(self.creation_ttl) ||
      self.creation_ttl < 60 ||
      self.creation_ttl > 300 ||
      (self.period ?? 0) !== 0 ||
      self.path !== 'auth/platform-backup/login' ||
      self.meta?.role_name !== POLICY
    )
      fail();
    const capabilities = await call('sys/capabilities-self', token, {
      paths: [SNAPSHOT, ...FORBIDDEN],
    });
    if (
      capabilities.status !== 200 ||
      JSON.stringify(capabilities.value?.[SNAPSHOT]) !== '["read"]' ||
      FORBIDDEN.some(
        (p) => JSON.stringify(capabilities.value?.[p]) !== '["deny"]',
      )
    )
      fail();
    const result = await call(SNAPSHOT, token, undefined, true);
    if (result.status !== 200 || !Buffer.isBuffer(result.value)) fail();
    capture = result.value;
    integrity = verifyRecoverySnapshot(capture);
    successful = true;
  } finally {
    if (token) {
      try {
        const revoked = await call('auth/token/revoke-self', token, {});
        const denied = await call('auth/token/lookup-self', token);
        cleanupConfirmed =
          [200, 204].includes(revoked.status) && denied.status === 403;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (operationId && cleanupConfirmed) {
      durable(
        join(state, 'result-' + operationId + '.json'),
        JSON.stringify({
          operationId,
          cleanupConfirmed,
          outcome: successful ? 'captured' : 'failed',
          finishedAt: new Date().toISOString(),
        }),
      );
      syncDirectory(state);
    }
  }
  if (!cleanupConfirmed || !successful) fail();
  // Snapshot plaintext/provider state is released only after owned-token revoke/403.
  durable(join(output, operationId + '.snap'), capture);
  durable(
    join(output, operationId + '.json'),
    JSON.stringify({
      operationId,
      ...integrity,
      tokenCleanupConfirmed: true,
      capturedAt: new Date().toISOString(),
    }),
  );
  syncDirectory(output);
  return operationId;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.umask(0o077);
  try {
    if (process.argv.length !== 5) fail();
    const operationId = await captureSnapshot(...process.argv.slice(2));
    console.log(
      JSON.stringify({
        status: 'passed',
        operationId,
        tokenCleanupConfirmed: true,
      }),
    );
  } catch {
    console.error(
      JSON.stringify({
        status: 'failed',
        stage: 'snapshot_capture',
        retryAutomatically: false,
      }),
    );
    process.exitCode = 1;
  }
}
