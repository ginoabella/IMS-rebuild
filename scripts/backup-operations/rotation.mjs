// Attended rotation only. Tokens remain in memory; output contains no credentials.
import { request } from 'node:https';
import { pathToFileURL } from 'node:url';
import { boundedFile, durable, syncDirectory } from '../backup/archive.mjs';

const ROLE = 'auth/platform-backup/role/platform-raft-snapshot-reader';
const POLICY = 'platform-backup-rotation';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const only = (value, policy) =>
  Array.isArray(value) && value.length === 1 && value[0] === policy;
const noIdentity = (value) =>
  value == null || (Array.isArray(value) && !value.length);
function requireValue(value) {
  if (!value) throw new Error('Rotation unconfirmed');
}

export function tlsTransport(ca) {
  return (path, body, token) =>
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
          let bytes = 0;
          res.on('data', (chunk) => {
            bytes += chunk.length;
            if (bytes > 262144) req.destroy(new Error('Reply bound'));
            else chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                value: JSON.parse(Buffer.concat(chunks).toString() || '{}'),
              });
            } catch {
              reject(new Error('Reply refused'));
            }
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error('Provider timeout')),
        5000,
      );
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
}

async function revoked(call, token) {
  // Always attempt both independent checks, including after an uncertain revoke.
  let sent = false,
    denied = false;
  try {
    sent = [200, 204].includes(
      (await call('auth/token/revoke-self', {}, token)).status,
    );
  } catch {
    /* unconfirmed */
  }
  try {
    denied =
      (await call('auth/token/lookup-self', undefined, token)).status === 403;
  } catch {
    /* unconfirmed */
  }
  return sent && denied;
}

async function session(call, credentials, policy, maximum, action) {
  let token,
    cleaned = false;
  try {
    const login = await call(credentials.path, credentials.body);
    const auth = login.value?.auth;
    if (
      typeof auth?.client_token === 'string' &&
      /^[a-zA-Z0-9._-]{16,4096}$/.test(auth.client_token)
    )
      token = auth.client_token;
    requireValue(
      login.status === 200 &&
        token &&
        only(auth.policies, policy) &&
        noIdentity(auth.identity_policies) &&
        Number.isSafeInteger(auth.lease_duration) &&
        auth.lease_duration > 0 &&
        auth.lease_duration <= maximum,
    );
    const lookup = await call('auth/token/lookup-self', undefined, token);
    const self = lookup.value?.data;
    requireValue(
      lookup.status === 200 &&
        self?.id === token &&
        only(self.policies, policy) &&
        noIdentity(self.identity_policies) &&
        self.type === 'service' &&
        self.explicit_max_ttl === maximum &&
        (self.period ?? 0) === 0 &&
        Number.isSafeInteger(self.ttl) &&
        self.ttl > 0 &&
        self.ttl <= maximum &&
        Number.isSafeInteger(self.creation_ttl) &&
        self.creation_ttl > 0 &&
        self.creation_ttl <= maximum &&
        self.path === credentials.path,
    );
    return await action(token);
  } finally {
    if (token) cleaned = await revoked(call, token);
    requireValue(cleaned);
  }
}

async function maintenance(call, password, action) {
  return session(
    call,
    {
      path: 'auth/platform-custodian/login/platform-backup-maintainer',
      body: { password },
    },
    POLICY,
    900,
    async (token) => {
      const paths = {
        [`${ROLE}/role-id`]: ['read'],
        [`${ROLE}/secret-id`]: ['update'],
        [`${ROLE}/secret-id-accessor/lookup`]: ['update'],
        [`${ROLE}/secret-id-accessor/destroy`]: ['update'],
        'sys/storage/raft/snapshot': ['deny'],
        'sys/policies/acl/platform-backup-rotation': ['deny'],
        'sys/auth/platform-backup': ['deny'],
        'auth/token/create': ['deny'],
        'secret/data/fixture': ['deny'],
      };
      const result = await call(
        'sys/capabilities-self',
        { paths: Object.keys(paths) },
        token,
      );
      requireValue(
        result.status === 200 &&
          Object.entries(paths).every(
            ([p, v]) => JSON.stringify(result.value?.[p]) === JSON.stringify(v),
          ),
      );
      return action(token);
    },
  );
}

async function verifyWorkload(call, auth) {
  return session(
    call,
    {
      path: 'auth/platform-backup/login',
      body: { role_id: auth.roleId, secret_id: auth.secretId },
    },
    'platform-raft-snapshot-reader',
    300,
    async (token) => {
      const paths = {
        'sys/storage/raft/snapshot': ['read'],
        'sys/storage/raft/snapshot-force': ['deny'],
        'auth/token/create': ['deny'],
        'auth/token/renew-self': ['deny'],
        [`${ROLE}/secret-id`]: ['deny'],
        'sys/auth/platform-backup': ['deny'],
        'sys/policies/acl/platform-raft-snapshot-reader': ['deny'],
        'secret/data/fixture': ['deny'],
      };
      const result = await call(
        'sys/capabilities-self',
        { paths: Object.keys(paths) },
        token,
      );
      requireValue(
        result.status === 200 &&
          Object.entries(paths).every(
            ([p, v]) => JSON.stringify(result.value?.[p]) === JSON.stringify(v),
          ),
      );
    },
  );
}

export async function issueReplacement({ call, password, old, persist, mark }) {
  requireValue(UUID.test(old.roleId) && UUID.test(old.secretId));
  const createdAt = new Date().toISOString();
  await maintenance(call, password, async (token) => {
    const role = await call(`${ROLE}/role-id`, undefined, token);
    requireValue(
      role.status === 200 && role.value?.data?.role_id === old.roleId,
    );
    await mark('issuance-started');
    // Deliberately one POST. A lost response is never retried.
    const reply = await call(
      `${ROLE}/secret-id`,
      { ttl: '720h', num_uses: '1000' },
      token,
    );
    const data = reply.value?.data;
    requireValue(
      reply.status === 200 &&
        UUID.test(data?.secret_id) &&
        UUID.test(data?.secret_id_accessor) &&
        data.secret_id !== old.secretId,
    );
    await persist({
      roleId: old.roleId,
      secretId: data.secret_id,
      accessor: data.secret_id_accessor,
      createdAt,
    });
    await mark('issuance-acknowledged');
    const checked = await call(
      `${ROLE}/secret-id-accessor/lookup`,
      { secret_id_accessor: data.secret_id_accessor },
      token,
    );
    requireValue(
      checked.status === 200 &&
        checked.value?.data?.secret_id_ttl === 2592000 &&
        checked.value.data.secret_id_num_uses === 1000,
    );
    await verifyWorkload(call, {
      roleId: old.roleId,
      secretId: data.secret_id,
    });
    await mark('replacement-verified');
  });
  return {
    status: 'replacement-verified',
    maintenanceRevoked403: true,
    workloadRevoked403: true,
    createdAt,
  };
}

export async function retirePrevious({ call, password, old, accessor, mark }) {
  requireValue(
    UUID.test(accessor) && UUID.test(old.roleId) && UUID.test(old.secretId),
  );
  await maintenance(call, password, async (token) => {
    await mark('retirement-started');
    requireValue(
      [200, 204].includes(
        (
          await call(
            `${ROLE}/secret-id-accessor/destroy`,
            { secret_id_accessor: accessor },
            token,
          )
        ).status,
      ),
    );
    await mark('retirement-acknowledged');
    requireValue(
      [400, 404].includes(
        (
          await call(
            `${ROLE}/secret-id-accessor/lookup`,
            { secret_id_accessor: accessor },
            token,
          )
        ).status,
      ),
    );
    const login = await call('auth/platform-backup/login', {
      role_id: old.roleId,
      secret_id: old.secretId,
    });
    if (typeof login.value?.auth?.client_token === 'string') {
      await revoked(call, login.value.auth.client_token);
      throw new Error('Old login still usable');
    }
    requireValue(
      [400, 403].includes(login.status) && login.value?.auth == null,
    );
    await mark('old-login-denied');
  });
  return {
    status: 'previous-retired',
    maintenanceRevoked403: true,
    oldLoginDenied: true,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.umask(0o077);
  try {
    const action = process.argv[2];
    requireValue(
      process.argv.length === 3 && ['issue', 'retire'].includes(action),
    );
    const old = JSON.parse(boundedFile('/current/approle.json', 4096).bytes);
    const ca = boundedFile('/current/ca.crt', 65536, false).bytes;
    const passwordFile = boundedFile('/password', 128);
    requireValue(
      passwordFile.stat.uid === 1002 &&
        passwordFile.stat.gid === 1002 &&
        passwordFile.stat.nlink === 1 &&
        (passwordFile.stat.mode & 511) === 384,
    );
    const password = passwordFile.bytes.toString();
    requireValue(/^[A-Za-z0-9_-]{43,128}$/.test(password));
    const call = tlsTransport(ca);
    const mark = async (event) => {
      durable('/stage/' + event + '.json', JSON.stringify({ event }));
      syncDirectory('/stage');
    };
    let result;
    if (action === 'issue')
      result = await issueReplacement({
        call,
        password,
        old,
        mark,
        persist: async (value) => {
          durable(
            '/candidate/approle.json',
            JSON.stringify({ roleId: value.roleId, secretId: value.secretId }),
          );
          durable('/candidate/ca.crt', ca);
          durable(
            '/stage/accessor.json',
            JSON.stringify({ accessor: value.accessor }),
          );
          syncDirectory('/candidate');
          syncDirectory('/stage');
        },
      });
    else {
      const accessor = JSON.parse(
        boundedFile('/old-accessor', 4096).bytes,
      ).accessor;
      result = await retirePrevious({ call, password, old, accessor, mark });
    }
    console.log(JSON.stringify(result));
  } catch {
    console.error(
      JSON.stringify({ status: 'rotation-unconfirmed', automaticRetry: false }),
    );
    process.exitCode = 1;
  }
}
