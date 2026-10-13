// Explicit development-only test data. No production activation or auth bypass.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { request } from 'node:https';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (path) => backend(`./dist/${path}.js`);
const directory = resolve('.local/staff-native-fixture');
const stateFile = join(directory, 'state.json');
const handoffFile = join(directory, 'handoff.json');
const fixtureKind = 'P2-U4C-development-acceptance';
const displayName = 'P2-U4C NATIVE ACCEPTANCE ONLY';
const { Pool } = backend('pg');
const { loadBackendConfig } = load('infrastructure/configuration');
const { Transaction } = load('infrastructure/database/transaction');
const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
const { SafeLogger } = load('infrastructure/execution/logging');
const { TenantRepository } = load(
  'modules/tenancy/adapters/db/tenant-repository',
);
const { TenantAuthorityMutations } = load(
  'modules/tenancy/adapters/db/authority-mutations',
);
const { StaffRepository } = load(
  'modules/identity/adapters/db/staff-repository',
);
const { StaffAuthorityRepository } = load(
  'modules/identity/adapters/db/authority-read',
);
const { CredentialRuntime } = load(
  'modules/identity/adapters/db/credential-runtime',
);
const { hashPassword } = load('infrastructure/password/scrypt');
const { permissions } = load('modules/identity/domain/roles');
let pool,
  snapshots,
  credentials,
  state,
  created = false,
  phase = 'development guard';
const save = (path, value, exclusive = false) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600,
    flag: exclusive ? 'wx' : 'w',
  });
function privateJson(path) {
  assert.equal(statSync(path).mode & 0o077, 0);
  return JSON.parse(readFileSync(path, 'utf8'));
}
function context(type, id, tenantId = null) {
  return {
    actor: {
      kind: 'system',
      plane: 'system',
      tenantId: null,
      reference: 'p2-u4c-native-fixture',
      reason: 'development-acceptance',
    },
    target: { type, reference: id, tenantId },
    correlationId: randomUUID(),
  };
}
async function mutate(type, id, tenantId, action) {
  return Transaction.run(
    pool,
    context(type, id, tenantId),
    'native-fixture.prepare',
    new SafeLogger('deployment', () => {}),
    async (tx) => {
      const result = await action(tx);
      assert.equal(result.kind, 'found');
      return result.value;
    },
  );
}
async function fixtureTenant() {
  const row = (
    await pool.query(
      'SELECT id,normalized_code,display_name,status,version FROM public.tenants WHERE id=$1',
      [state.tenantId],
    )
  ).rows[0];
  if (row) {
    assert.equal(row.normalized_code, state.tenantCode);
    assert.equal(row.display_name, displayName);
  }
  return row;
}
async function retire() {
  const row = await fixtureTenant();
  if (row && row.status !== 'retired')
    await mutate('tenant', state.tenantId, null, (tx) =>
      new TenantAuthorityMutations().status(
        tx,
        { tenantId: state.tenantId },
        row.version,
        'retired',
      ),
    );
  state.state = 'retired';
  save(stateFile, state);
}
async function ordinaryDraftSnapshot() {
  return (
    await pool.query(
      'SELECT t.id,t.status,t.version,t.authority_version,s.id AS staff_id,s.status AS staff_status,s.credential_state,s.version AS staff_version,s.authentication_version FROM public.tenants t LEFT JOIN public.staff_users s ON s.tenant_id=t.id WHERE t.normalized_code=$1 ORDER BY s.id',
      ['t001'],
    )
  ).rows;
}
try {
  const mode = process.argv[2];
  assert.ok(['--prepare', '--check', '--retire'].includes(mode));
  assert.equal(process.argv.length, 3);
  assert.notEqual(process.env.NODE_ENV, 'production');
  const config = loadBackendConfig();
  // This utility deliberately supports only this declared Docker dev database.
  const db = new URL(config.database.url);
  assert.equal(db.hostname, 'postgres');
  assert.equal(db.pathname, '/myims');
  const ingress = privateJson('private/staff-access-config.json');
  assert.equal(ingress.origin, 'https://localhost:3444');
  const ca = readFileSync('private/mkcert-rootCA.pem');
  const origin = new URL(ingress.origin);
  const host = ['0.0.0.0', '::'].includes(ingress.bind)
    ? Object.values(networkInterfaces())
        .flat()
        .find((entry) => entry && !entry.internal && entry.family === 'IPv4')
        ?.address
    : ingress.bind;
  assert.ok(host);
  pool = new Pool({
    connectionString: config.database.url,
    max: 2,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  pool.on('error', () => {});
  const before = await ordinaryDraftSnapshot();
  function native(path, body, token) {
    return new Promise((accept, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      const req = request(
        {
          hostname: host,
          port: ingress.port,
          servername: origin.hostname,
          ca,
          timeout: 8000,
          path: `/staff/auth/mobile/${path}`,
          method: path === 'session' ? 'GET' : 'POST',
          headers: {
            host: origin.host,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(data ? { 'Content-Type': 'application/json' } : {}),
          },
        },
        (res) => {
          const authorized = res.socket.authorized;
          let text = '';
          res.on('data', (chunk) => {
            text += chunk;
            if (text.length > 8192)
              res.destroy(new Error('Oversized response'));
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              assert.equal(authorized, true);
              assert.match(res.headers['cache-control'] ?? '', /no-store/);
              accept({ status: res.statusCode, value: JSON.parse(text) });
            } catch {
              reject(new Error('Native response invalid'));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('Native request timeout')));
      req.end(data);
    });
  }
  if (mode === '--prepare') {
    phase = 'reserve private handoff';
    mkdirSync(directory, { mode: 0o700 }); // Refuse duplicate preparation.
    const adminId = randomUUID();
    state = {
      kind: fixtureKind,
      state: 'preparing',
      createdAt: new Date().toISOString(),
      tenantId: randomUUID(),
      tenantCode: `native-p2u4c-${randomBytes(4).toString('hex')}`,
      accounts: [
        {
          id: adminId,
          username: 'native.admin',
          roles: ['tenant_admin'],
          control: true,
        },
        {
          id: randomUUID(),
          username: 'native.responder',
          roles: ['responder'],
          control: false,
        },
        {
          id: randomUUID(),
          username: 'native.other',
          roles: ['responder'],
          control: false,
        },
      ],
    };
    save(stateFile, state, true);
    const handoff = {
      tenantCode: state.tenantCode,
      origin: ingress.origin,
      notice:
        'Private test credentials. Do not paste, commit, screenshot, or use for real tenants.',
      accounts: state.accounts.map((account) => ({
        username: account.username,
        staffId: account.id,
        password: randomBytes(24).toString('base64url'),
      })),
    };
    save(handoffFile, handoff, true);
    phase = 'audited draft fixture creation';
    created = true;
    await mutate('tenant', state.tenantId, null, (tx) =>
      new TenantRepository().createDraft(tx, {
        id: state.tenantId,
        code: state.tenantCode,
        displayName,
      }),
    );
    const adminPassword = Buffer.from(handoff.accounts[0].password);
    let adminHash;
    try {
      adminHash = await hashPassword(adminPassword);
    } finally {
      adminPassword.fill(0);
    }
    for (const account of state.accounts)
      await mutate('staff', account.id, state.tenantId, (tx) =>
        new StaffRepository().create(tx, {
          plane: 'tenant',
          id: account.id,
          tenantId: state.tenantId,
          username: account.username,
          roles: account.roles,
          status: 'active',
          credentialState: account.control ? 'ready' : 'unset',
          passwordHash: account.control ? adminHash : null,
          credentialChangedAt: account.control ? new Date() : null,
        }),
      );
    phase = 'test-only active fixture transition';
    const tenant = await fixtureTenant();
    await mutate('tenant', state.tenantId, null, (tx) =>
      new TenantAuthorityMutations().status(
        tx,
        { tenantId: state.tenantId },
        tenant.version,
        'active',
      ),
    );
    // A control admin is seeded for this fixture only. Responder passwords use a's
    // actual single-use issue/exchange service, not direct ready/hash insertion.
    snapshots = new SnapshotDatabase(config.database.url);
    const eligible = await new StaffAuthorityRepository(
      snapshots,
      new TenantRepository(),
    ).byId({
      plane: 'tenant',
      tenantId: state.tenantId,
      staffId: adminId,
    });
    assert.equal(eligible.kind, 'eligible');
    const s = eligible.snapshot;
    const principal = {
      plane: 'tenant',
      tenantId: s.tenantId,
      staffId: s.staffId,
      authenticationVersion: s.authenticationVersion,
      tenantAuthorityVersion: s.tenantAuthorityVersion,
      roles: s.roles,
      grants: permissions(s.roles),
    };
    credentials = new CredentialRuntime(config);
    for (const account of state.accounts.filter(
      (account) => !account.control,
    )) {
      phase = 'real credential action issue/exchange';
      const issued = await credentials.service.issue(
        principal,
        state.tenantId,
        {
          tenantId: state.tenantId,
          staffId: account.id,
          operation: 'issue',
          purpose: 'setup',
          verificationMethod: 'in_person',
        },
        host,
        account.id,
      );
      assert.equal(issued.kind, 'issued');
      const completed = await credentials.service.exchange(
        {
          capability: issued.capability,
          password: handoff.accounts.find((a) => a.staffId === account.id)
            .password,
        },
        host,
      );
      assert.equal(completed.kind, 'completed');
    }
    state.state = 'ready';
    save(stateFile, state);
  } else {
    assert.equal(statSync(directory).mode & 0o077, 0);
    state = privateJson(stateFile);
    assert.equal(state.kind, fixtureKind);
    assert.match(state.tenantCode, /^native-p2u4c-[a-f0-9]{8}$/);
    assert.equal(state.accounts.length, 3);
  }
  if (mode === '--retire') {
    phase = 'audited fixture retirement';
    await retire();
    console.log(
      'PASS fixture retired; canonical admission blocks its retained tokens.',
    );
  } else {
    phase = 'fixture status';
    const tenant = await fixtureTenant();
    assert.equal(tenant.status, 'active');
    assert.equal(state.state, 'ready');
    const handoff = privateJson(handoffFile);
    const consumed = await pool.query(
      "SELECT count(*)::int AS count FROM public.credential_actions WHERE tenant_id=$1 AND state='consumed' AND purpose='setup'",
      [state.tenantId],
    );
    assert.equal(consumed.rows[0].count, 2);
    for (const account of state.accounts) {
      phase = `HTTPS verification for ${account.username}`;
      const password = handoff.accounts.find(
        (a) => a.staffId === account.id,
      ).password;
      const signedIn = await native('sign-in', {
        tenantCode: state.tenantCode,
        username: account.username,
        password,
      });
      assert.equal(signedIn.status, 201);
      const token = signedIn.value.token;
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      try {
        const checked = await native('session', undefined, token);
        assert.equal(checked.status, 200);
        assert.equal(checked.value.tenantId, state.tenantId);
        assert.equal(checked.value.staffId, account.id);
        assert.deepEqual(checked.value.roles, account.roles);
      } finally {
        const loggedOut = await native('logout', undefined, token);
        assert.equal(loggedOut.status, 201);
        assert.equal(loggedOut.value.signedOut, true);
      }
      assert.equal((await native('session', undefined, token)).status, 401);
      console.log(
        `PASS ${account.username}: HTTPS sign-in/session/logout and revoked-token denial.`,
      );
    }
    console.log(`Ready test tenant: ${state.tenantCode}`);
    console.log(
      'Private credentials: .local/staff-native-fixture/handoff.json (not printed).',
    );
  }
  assert.deepEqual(await ordinaryDraftSnapshot(), before);
  console.log(
    'PASS existing t001 tenant/staff status and authority versions unchanged.',
  );
  console.log('Native OS acceptance and P2-U4C completion are still pending.');
} catch (error) {
  console.error(`FAIL native fixture during ${phase}; secret values omitted.`);
  if (
    error instanceof assert.AssertionError &&
    typeof error.actual === 'number'
  )
    console.error(`Finite observed result: ${error.actual}`);
  if (created) {
    try {
      await retire();
      console.error(
        'Incomplete fixture retired; no automatic retry performed.',
      );
    } catch {
      console.error(
        'Fixture cleanup uncertain; use --retire after restoring dependencies.',
      );
    }
  }
  process.exitCode = 1;
} finally {
  await credentials?.onApplicationShutdown();
  await snapshots?.close();
  await pool?.end();
}
