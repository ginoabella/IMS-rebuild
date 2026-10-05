import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const selection = process.argv.slice(2);
assert.ok(
  selection.length === 0 ||
    (selection.length === 1 && selection[0] === '--storage'),
  'Supported selection: --storage',
);
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client, Pool } = backend('pg');
const { loadMigrationConfig } = backend(
  './dist/infrastructure/configuration.js',
);
const { Transaction } = backend(
  './dist/infrastructure/database/transaction.js',
);
const { SafeLogger } = backend('./dist/infrastructure/execution/logging.js');
const { normalizeTenantCode, normalizeUsername } = backend(
  './dist/modules/identity/domain/storage.js',
);
const { TenantRepository } = backend(
  './dist/modules/tenancy/adapters/db/tenant-repository.js',
);
const { StaffRepository } = backend(
  './dist/modules/identity/adapters/db/staff-repository.js',
);
const { OperatorRepository } = backend(
  './dist/modules/platform/adapters/db/operator-repository.js',
);
const { adminUrl, runtimeUrl } = loadMigrationConfig();
const name = `myims_identity_${randomBytes(6).toString('hex')}`;
const trustedUrl = new URL(adminUrl);
const appUrl = new URL(runtimeUrl);
trustedUrl.pathname = appUrl.pathname = `/${name}`;
const admin = new Client({ connectionString: adminUrl });
const owner = new Client({ connectionString: trustedUrl.href });
const runtime = new Client({
  connectionString: appUrl.href,
  statement_timeout: 5000,
});
const pool = new Pool({
  connectionString: appUrl.href,
  max: 4,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
});
// Test tooling owns connection event handling during deliberate termination.
pool.on('connect', (client) => client.on('error', () => {}));
pool.on('error', () => {});
const logs = [];
const logger = new SafeLogger('deployment', (line) => logs.push(line));
const tenants = new TenantRepository();
const staff = new StaffRepository();
const operators = new OperatorRepository();
function context(type, id, tenantId = null) {
  return {
    actor: {
      kind: 'system',
      reference: 'identity.fixture',
      plane: 'system',
      tenantId: null,
      reason: 'acceptance-check',
    },
    target: { type, reference: id, tenantId },
    correlationId: randomUUID(),
  };
}
function run(type, id, tenantId, action) {
  return Transaction.run(
    pool,
    context(type, id, tenantId),
    'identity.fixture',
    logger,
    action,
  );
}
async function failedWrite(type, id, tenantId, kind, action) {
  let outcome;
  await assert.rejects(
    run(type, id, tenantId, async (tx) => {
      outcome = await action(tx);
    }),
  );
  assert.deepEqual(outcome, { kind });
}
async function rejected(client, sql, values, code) {
  await assert.rejects(
    client.query(sql, values),
    (error) => error.code === code,
  );
}
async function deploy() {
  const child = spawn(
    process.execPath,
    ['services/backend/dist/entrypoints/deployment/main.js', 'migrate'],
    {
      env: {
        ...process.env,
        DATABASE_URL: appUrl.href,
        DATABASE_PASSWORD_FILE: undefined,
        MIGRATION_DATABASE_URL: trustedUrl.href,
        MIGRATION_DATABASE_PASSWORD_FILE: undefined,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 90000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  assert.equal(code, 0, output);
}
async function count(table, id) {
  const result = await runtime.query(
    `SELECT count(*)::int AS n FROM public.${table} WHERE ${table === 'audit_events' ? 'target_reference' : 'id'}=$1`,
    [id],
  );
  return result.rows[0].n;
}
const tenantInsert =
  'INSERT INTO public.tenants (id,normalized_code,display_name,status) VALUES ($1,$2,$3,$4)';
const staffInsert =
  'INSERT INTO public.staff_users (id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES ($1,$2,$3,$4,$5,$6,$7)';
const operatorInsert =
  'INSERT INTO public.platform_operators (id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES ($1,$2,$3,$4,$5,$6)';
const staffInput = (
  id,
  tenantId,
  username = ' Same.Name ',
  status = 'disabled',
) => ({
  id,
  plane: 'tenant',
  tenantId,
  username,
  status,
  credentialState: 'unset',
  passwordHash: null,
  credentialChangedAt: null,
});
// Winner remains uncommitted; contender is proved blocked on a PostgreSQL lock
// before releasing the winner, making the uniqueness race deterministic.
async function collision(sql, first, second) {
  const a = new Client({
    connectionString: appUrl.href,
    statement_timeout: 5000,
  });
  const b = new Client({
    connectionString: appUrl.href,
    statement_timeout: 5000,
  });
  try {
    await a.connect();
    await b.connect();
    const pid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await a.query('BEGIN');
    await a.query(sql, first);
    const contender = b.query(sql, second).then(
      () => ({ kind: 'unexpected' }),
      (error) => ({ kind: error.code }),
    );
    const deadline = Date.now() + 3000;
    let blocked = false;
    while (Date.now() < deadline) {
      const state = await owner.query(
        'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',
        [pid],
      );
      if (state.rows[0]?.wait_event_type === 'Lock') {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await a.query('COMMIT');
    assert.deepEqual(await contender, { kind: '23505' });
    assert.ok(blocked, 'contender must wait for uncommitted winner');
  } finally {
    await a.end();
    await b.end();
  }
}
let created = false;
let phase = 'normalization and deployment';
try {
  for (const [normalize, limit] of [
    [normalizeTenantCode, 64],
    [normalizeUsername, 128],
  ]) {
    for (const input of [
      ' AbC.Def_1-2 ',
      '\tAbC\n',
      '\u00a0AbC\u00a0',
      'a'.repeat(limit),
    ]) {
      const value = normalize(input);
      assert.ok(value);
      assert.equal(normalize(value), value);
    }
    for (const input of [
      '',
      ' ',
      'a b',
      'a\tb',
      '-abc',
      'é',
      'Ａ',
      'K',
      'a'.repeat(limit + 1),
      null,
      2,
    ])
      assert.equal(normalize(input), null);
  }
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await deploy();
  await deploy();
  await owner.connect();
  await runtime.connect();
  assert.equal(
    (
      await runtime.query(
        'SELECT count(*)::int AS n FROM public._prisma_migrations WHERE finished_at IS NOT NULL',
      )
    ).rows[0].n,
    5,
  );
  for (const table of [
    'tenants',
    'staff_users',
    'platform_operators',
    'operator_bootstrap_provenance',
  ])
    assert.equal(
      (await owner.query(`SELECT count(*)::int AS n FROM public.${table}`))
        .rows[0].n,
      0,
    );
  assert.equal(
    (await owner.query('SHOW server_encoding')).rows[0].server_encoding,
    'UTF8',
  );
  const collations = (
    await owner.query(
      "SELECT collation_name FROM information_schema.columns WHERE table_schema='public' AND (table_name='tenants' AND column_name='normalized_code' OR table_name IN ('staff_users','platform_operators') AND column_name='normalized_username')",
    )
  ).rows;
  assert.equal(collations.length, 3);
  assert.ok(collations.every((row) => row.collation_name === 'C'));
  console.log(
    'PASS: fresh/rerun five migrations; no production identity seeds; canonical ASCII normalization and bounds',
  );
  phase = 'tenant constraints';
  const t1 = randomUUID(),
    t2 = randomUUID();
  for (const [id, code, status] of [
    [t1, ' First.Code ', 'draft'],
    [t2, 'second', 'active'],
  ]) {
    const result = await run('tenant', id, null, async (tx) => {
      const result = await tenants.create(tx, {
        id,
        code,
        displayName: 'Fixture',
        status,
      });
      assert.equal(await count('tenants', id), 0);
      assert.equal(await count('audit_events', id), 0);
      return result;
    });
    assert.equal(result.kind, 'found');
    assert.equal(result.value.id, id);
    assert.equal(await count('audit_events', id), 1);
  }
  for (const status of ['suspended', 'retired'])
    await runtime.query(tenantInsert, [
      randomUUID(),
      status,
      'Fixture',
      status,
    ]);
  for (const code of [
    '',
    'Upper',
    ' outer ',
    'a b',
    'é',
    'a'.repeat(65),
    'abc\n',
  ])
    await rejected(
      runtime,
      tenantInsert,
      [randomUUID(), code, 'Fixture', 'draft'],
      '23514',
    );
  await rejected(
    runtime,
    tenantInsert,
    [randomUUID(), 'first.code', 'Fixture', 'retired'],
    '23505',
  );
  await rejected(
    runtime,
    tenantInsert,
    [randomUUID(), 'retired', 'Fixture', 'draft'],
    '23505',
  );
  await rejected(
    runtime,
    'UPDATE public.tenants SET normalized_code=$2 WHERE id=$1',
    [t1, 'other'],
    '42501',
  );
  await rejected(
    owner,
    'UPDATE public.tenants SET normalized_code=$2 WHERE id=$1',
    [t1, 'other'],
    '23514',
  );
  const renamed = await run('tenant', t1, null, (tx) =>
    tenants.rename(tx, t1, 1, 'Renamed'),
  );
  assert.equal(renamed.value.normalized_code, 'first.code');
  assert.equal(renamed.value.version, 2);
  assert.equal(renamed.value.authority_version, 1);
  assert.equal(
    (await run('tenant', t1, null, (tx) => tenants.rename(tx, t1, 1, 'Stale')))
      .kind,
    'stale',
  );
  await run('tenant', t1, null, (tx) => tenants.rename(tx, t1, 2, 'Renamed'));
  assert.equal(await count('audit_events', t1), 2);
  assert.equal(
    (await run('tenant', t1, null, (tx) => tenants.find(tx, ' FIRST.Code ')))
      .value.id,
    t1,
  );
  await failedWrite('tenant', randomUUID(), null, 'duplicate', async (tx) => {
    const id = tx.context.target.reference;
    return tenants.create(tx, {
      id,
      code: 'FIRST.CODE',
      displayName: 'Fixture',
      status: 'draft',
    });
  });
  console.log(
    'PASS: tenant namespace across statuses, retired-code reuse denied, immutable codes; audited display-name change and stale/no-op behavior',
  );
  phase = 'staff ownership and collisions';
  const u1 = randomUUID(),
    u2 = randomUUID();
  for (const [id, tenantId] of [
    [u1, t1],
    [u2, t2],
  ]) {
    const result = await run('staff', id, tenantId, (tx) =>
      staff.create(tx, staffInput(id, tenantId)),
    );
    assert.ok(!('normalized_username' in result.value));
    assert.equal(
      (
        await owner.query(
          'SELECT normalized_username FROM public.staff_users WHERE id=$1',
          [id],
        )
      ).rows[0].normalized_username,
      'same.name',
    );
    assert.ok(!('password_hash' in result.value));
  }
  await failedWrite('staff', randomUUID(), t1, 'duplicate', async (tx) =>
    staff.create(
      tx,
      staffInput(tx.context.target.reference, t1, ' SAME.NAME ', 'active'),
    ),
  );
  const orphan = randomUUID(),
    missingTenant = randomUUID();
  await failedWrite('staff', orphan, missingTenant, 'missing', (tx) =>
    staff.create(tx, staffInput(orphan, missingTenant)),
  );
  assert.equal(await count('staff_users', orphan), 0);
  assert.equal(await count('audit_events', orphan), 0);
  await rejected(
    runtime,
    staffInsert,
    [randomUUID(), null, 'x', 'active', 'unset', null, null],
    '23502',
  );
  for (const username of ['', 'Upper', ' outer ', 'a b', 'é', 'x'.repeat(129)])
    await rejected(
      runtime,
      staffInsert,
      [randomUUID(), t1, username, 'disabled', 'unset', null, null],
      '23514',
    );
  await rejected(
    runtime,
    'UPDATE public.staff_users SET tenant_id=$2 WHERE id=$1',
    [u1, t2],
    '42501',
  );
  await rejected(
    owner,
    'UPDATE public.staff_users SET tenant_id=$2 WHERE id=$1',
    [u1, t2],
    '23514',
  );
  await rejected(
    owner,
    'DELETE FROM public.tenants WHERE id=$1',
    [t1],
    '23503',
  );
  const foreign = { plane: 'tenant', tenantId: t2, staffId: u1 };
  assert.equal(
    (await run('staff', u1, t2, (tx) => staff.find(tx, foreign))).kind,
    'missing',
  );
  assert.equal(
    (
      await run('staff', u1, t2, (tx) =>
        staff.rename(tx, foreign, 1, 'foreign'),
      )
    ).kind,
    'missing',
  );
  assert.equal(
    (
      await run('staff', u1, t1, (tx) =>
        staff.find(tx, { plane: 'platform', tenantId: t1, staffId: u1 }),
      )
    ).kind,
    'invalid',
  );
  assert.equal(
    (
      await run('staff', u1, t1, (tx) =>
        staff.lookup(tx, {
          plane: 'tenant',
          tenantId: t1,
          username: ' SAME.NAME ',
        }),
      )
    ).value.id,
    u1,
  );
  const own = { plane: 'tenant', tenantId: t1, staffId: u1 };
  const named = await run('staff', u1, t1, (tx) =>
    staff.rename(tx, own, 1, ' New.Name '),
  );
  assert.equal(named.value.version, 2);
  assert.equal(named.value.authentication_version, 2);
  assert.equal(
    (await run('staff', u1, t1, (tx) => staff.rename(tx, own, 1, 'stale')))
      .kind,
    'stale',
  );
  await run('staff', u1, t1, (tx) => staff.rename(tx, own, 2, ' NEW.NAME '));
  assert.equal(await count('audit_events', u1), 2);
  await collision(
    tenantInsert,
    [randomUUID(), 'race', 'Fixture', 'draft'],
    [randomUUID(), 'race', 'Fixture', 'retired'],
  );
  await collision(
    staffInsert,
    [randomUUID(), t1, 'race', 'active', 'unset', null, null],
    [randomUUID(), t1, 'race', 'disabled', 'unset', null, null],
  );
  console.log(
    'PASS: tenant-qualified staff reads/writes, restrictive FK, immutable ownership; independent runtime collision barriers settle one winner',
  );
  phase = 'operator and credential storage';
  // Identical UUIDs in different stores still require the explicit plane.
  await owner.query(operatorInsert, [
    u2,
    'other.operator',
    'disabled',
    'unset',
    null,
    null,
  ]);
  assert.equal(
    (
      await run('operator', u2, null, (tx) =>
        operators.find(tx, { plane: 'platform', operatorId: u2 }),
      )
    ).value.id,
    u2,
  );
  assert.equal(
    (
      await run('staff', u2, t2, (tx) =>
        staff.find(tx, { plane: 'tenant', tenantId: t2, staffId: u2 }),
      )
    ).value.tenant_id,
    t2,
  );
  const op = randomUUID();
  const hash = 'HASH_SENTINEL_Secret:MiXeD';
  await owner.query(operatorInsert, [
    op,
    'same.name',
    'disabled',
    'ready',
    hash,
    new Date(),
  ]);
  await owner.query(
    'INSERT INTO public.operator_bootstrap_provenance (singleton,operator_id,command_reference) VALUES (true,$1,$2)',
    [op, 'fixture.only'],
  );
  const operator = await run('operator', op, null, (tx) =>
    operators.lookup(tx, { plane: 'platform', username: ' SAME.NAME ' }),
  );
  assert.equal(operator.value.id, op);
  assert.ok(!('password_hash' in operator.value));
  assert.ok(!('tenant_id' in operator.value));
  assert.equal(
    (
      await run('operator', op, null, (tx) =>
        operators.find(tx, { plane: 'tenant', operatorId: op }),
      )
    ).kind,
    'invalid',
  );
  assert.equal(
    (
      await run('operator', op, null, (tx) =>
        operators.find(tx, { plane: 'platform', operatorId: u1 }),
      )
    ).kind,
    'missing',
  );
  assert.equal(
    (
      await run('staff', op, t2, (tx) =>
        staff.find(tx, { plane: 'tenant', tenantId: t2, staffId: op }),
      )
    ).kind,
    'missing',
  );
  await rejected(
    owner,
    operatorInsert,
    [randomUUID(), 'same.name', 'active', 'unset', null, null],
    '23505',
  );
  await rejected(
    runtime,
    operatorInsert,
    [randomUUID(), 'new', 'active', 'unset', null, null],
    '42501',
  );
  await rejected(
    runtime,
    'INSERT INTO public.operator_bootstrap_provenance (singleton,operator_id,command_reference) VALUES (true,$1,$2)',
    [op, 'fixture.only'],
    '42501',
  );
  await rejected(
    runtime,
    'UPDATE public.operator_bootstrap_provenance SET command_reference=$1',
    ['other'],
    '42501',
  );
  await rejected(
    owner,
    'DELETE FROM public.platform_operators WHERE id=$1',
    [op],
    '23503',
  );
  const tenantColumns = await owner.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='platform_operators' AND column_name='tenant_id'",
  );
  assert.equal(tenantColumns.rows.length, 0);
  for (const [state, password, changed] of [
    ['ready', null, new Date()],
    ['ready', hash, null],
    ['unset', hash, null],
    ['unset', null, new Date()],
    ['unknown', null, null],
    ['ready', '', new Date()],
  ]) {
    await rejected(
      runtime,
      staffInsert,
      [randomUUID(), t1, randomUUID(), 'active', state, password, changed],
      '23514',
    );
    await rejected(
      owner,
      operatorInsert,
      [randomUUID(), randomUUID(), 'active', state, password, changed],
      '23514',
    );
  }
  await rejected(
    runtime,
    staffInsert,
    [randomUUID(), t1, 'unknown-status', 'unknown', 'unset', null, null],
    '23514',
  );
  await runtime.query(tenantInsert, [
    randomUUID(),
    'a'.repeat(64),
    'Fixture',
    'draft',
  ]);
  await runtime.query(staffInsert, [
    randomUUID(),
    t1,
    'a'.repeat(128),
    'active',
    'unset',
    null,
    null,
  ]);
  await owner.query(operatorInsert, [
    randomUUID(),
    'a'.repeat(128),
    'active',
    'unset',
    null,
    null,
  ]);
  for (const username of ['', 'Upper', ' outer ', 'a b', 'é', 'a'.repeat(129)])
    await rejected(
      owner,
      operatorInsert,
      [randomUUID(), username, 'disabled', 'unset', null, null],
      '23514',
    );
  for (const field of ['status', 'credential_state']) {
    const omitColumns =
      field === 'status'
        ? 'id,tenant_id,normalized_username,credential_state'
        : 'id,tenant_id,normalized_username,status';
    const omitValues = field === 'status' ? 'unset' : 'disabled';
    await rejected(
      runtime,
      `INSERT INTO public.staff_users (${omitColumns}) VALUES ($1,$2,$3,$4)`,
      [randomUUID(), t1, randomUUID(), omitValues],
      '23502',
    );
  }
  const readyId = randomUUID();
  const ready = await run('staff', readyId, t1, (tx) =>
    staff.create(tx, {
      ...staffInput(readyId, t1, 'Identity_SENTINEL'),
      credentialState: 'ready',
      passwordHash: hash,
      credentialChangedAt: new Date(),
    }),
  );
  assert.ok(!('password_hash' in ready.value));
  assert.equal(
    (
      await owner.query(
        'SELECT password_hash FROM public.staff_users WHERE id=$1',
        [readyId],
      )
    ).rows[0].password_hash,
    hash,
  );
  const failed = randomUUID();
  await owner.query(
    `ALTER TABLE public.audit_events ADD CONSTRAINT identity_fixture_failure CHECK (target_reference <> '${failed}')`,
  );
  await failedWrite('staff', failed, t1, 'invalid', (tx) =>
    staff.create(tx, staffInput(failed, t1, 'Failure_SENTINEL')),
  );
  assert.equal(await count('staff_users', failed), 0);
  assert.equal(await count('audit_events', failed), 0);
  await owner.query(
    'ALTER TABLE public.audit_events DROP CONSTRAINT identity_fixture_failure',
  );
  const before = await run('staff', u1, t1, (tx) => staff.find(tx, own));
  await owner.query(
    `ALTER TABLE public.audit_events ADD CONSTRAINT identity_fixture_failure CHECK (target_reference <> '${u1}') NOT VALID`,
  );
  await failedWrite('staff', u1, t1, 'invalid', (tx) =>
    staff.rename(tx, own, 2, 'Rollback_SENTINEL'),
  );
  await owner.query(
    'ALTER TABLE public.audit_events DROP CONSTRAINT identity_fixture_failure',
  );
  assert.deepEqual(
    await run('staff', u1, t1, (tx) => staff.find(tx, own)),
    before,
  );
  console.log(
    'PASS: distinct tenantless operator store, runtime bootstrap writes denied, credential coherence/hash preservation, audit failure rolls back versions and identity writes',
  );
  phase = 'privileges and diagnostics';
  for (const table of ['tenants', 'staff_users', 'platform_operators']) {
    await rejected(runtime, `DELETE FROM public.${table}`, [], '42501');
    await rejected(runtime, `TRUNCATE public.${table}`, [], '42501');
    await rejected(
      runtime,
      `ALTER TABLE public.${table} DISABLE TRIGGER ALL`,
      [],
      '42501',
    );
    await rejected(
      runtime,
      `ALTER TABLE public.${table} OWNER TO myims_runtime`,
      [],
      '42501',
    );
    await rejected(
      runtime,
      `UPDATE public.${table} SET id=$1`,
      [randomUUID()],
      '42501',
    );
    await rejected(
      runtime,
      `UPDATE public.${table} SET version=0`,
      [],
      '23514',
    );
    await rejected(
      owner,
      `UPDATE public.${table} SET id=$1`,
      [randomUUID()],
      '23514',
    );
  }
  for (const sql of [
    'UPDATE public.audit_events SET metadata=metadata',
    'DELETE FROM public.audit_events',
    'TRUNCATE public.audit_events',
    'SET session_replication_role=replica',
    'CREATE TABLE public.forbidden (id int)',
  ])
    await rejected(runtime, sql, [], '42501');
  const ownerName = (
    await owner.query('SELECT current_user AS name')
  ).rows[0].name.replaceAll('"', '""');
  await rejected(runtime, `SET ROLE "${ownerName}"`, [], '42501');
  await rejected(
    runtime,
    'SELECT public.protect_identity_ownership()',
    [],
    '42501',
  );
  await rejected(
    runtime,
    'UPDATE public.tenants SET version=1 WHERE id=$1',
    [t1],
    '23514',
  );
  await rejected(
    runtime,
    'UPDATE public.staff_users SET authentication_version=1 WHERE id=$1',
    [u1],
    '23514',
  );
  await runtime.query(
    'UPDATE public.tenants SET authority_version=2 WHERE id=$1',
    [t1],
  );
  await rejected(
    runtime,
    'UPDATE public.tenants SET authority_version=1 WHERE id=$1',
    [t1],
    '23514',
  );
  await runtime.query(
    'UPDATE public.platform_operators SET authentication_version=2 WHERE id=$1',
    [op],
  );
  await rejected(
    runtime,
    'UPDATE public.platform_operators SET authentication_version=1 WHERE id=$1',
    [op],
    '23514',
  );
  await rejected(
    runtime,
    'DROP TRIGGER staff_ownership ON public.staff_users',
    [],
    '42501',
  );
  await rejected(
    runtime,
    'CREATE OR REPLACE FUNCTION public.protect_identity_ownership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$',
    [],
    '42501',
  );
  const retainedId = randomUUID();
  await run('staff', retainedId, t1, (tx) =>
    staff.create(tx, staffInput(retainedId, t1, 'retained.audit')),
  );
  await owner.query('DELETE FROM public.staff_users WHERE id=$1', [retainedId]);
  assert.equal(await count('audit_events', retainedId), 1);
  // Force a real query failure on an independent transaction connection.
  let unavailable;
  await assert.rejects(
    run('operator', op, null, async (tx) => {
      const pid = (await tx.query('SELECT pg_backend_pid() AS pid')).rows[0]
        .pid;
      await owner.query('SELECT pg_terminate_backend($1)', [pid]);
      unavailable = await operators.find(tx, {
        plane: 'platform',
        operatorId: op,
      });
    }),
  );
  assert.deepEqual(unavailable, { kind: 'unavailable' });
  const auditRows = (
    await runtime.query(
      "SELECT metadata::text AS metadata FROM public.audit_events WHERE event_type='identity.storage.changed'",
    )
  ).rows;
  const diagnostic =
    logs.join('\n') +
    JSON.stringify(auditRows) +
    JSON.stringify(operator) +
    JSON.stringify(ready);
  for (const sentinel of [
    hash,
    'Failure_SENTINEL',
    'Rollback_SENTINEL',
    'identity_sentinel',
  ])
    assert.ok(!diagnostic.includes(sentinel));
  for (const line of logs) {
    assert.ok(!line.includes('Identity_SENTINEL'));
    assert.ok(!line.includes('same.name'));
  }
  for (const row of auditRows)
    assert.ok(!row.metadata.includes('identity_sentinel'));
  console.log(
    'PASS: runtime least privilege and retained audit; real connection failure returns unavailable; diagnostic/hash sentinels absent',
  );
} catch {
  console.error(`FAIL: identity storage acceptance during ${phase}`);
  process.exitCode = 1;
} finally {
  await pool.end();
  await runtime.end();
  await owner.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
