import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client, Pool } = backend('pg');
const { loadBackendConfig, loadMigrationConfig } = backend(
  './dist/infrastructure/configuration.js',
);
const { Transaction } = backend(
  './dist/infrastructure/database/transaction.js',
);
const { AuditRepository } = backend(
  './dist/modules/audit/adapters/db/audit-repository.js',
);
const { OutboxRepository } = backend(
  './dist/infrastructure/outbox/outbox-repository.js',
);
const { executionContext, correlationId, WriteValidationError } = backend(
  './dist/infrastructure/execution/context.js',
);
const { SafeLogger } = backend('./dist/infrastructure/execution/logging.js');
const name = `myims_audit_${randomBytes(6).toString('hex')}`;
const runtime = loadBackendConfig();
const migration = loadMigrationConfig();
const runtimeUrl = new URL(runtime.database.url);
const adminUrl = new URL(migration.adminUrl);
runtimeUrl.pathname = adminUrl.pathname = `/${name}`;
const admin = new Client({ connectionString: migration.adminUrl });
const owner = new Client({ connectionString: adminUrl.href });
const pool = new Pool({
  connectionString: runtimeUrl.href,
  max: runtime.databasePoolMax,
  connectionTimeoutMillis: runtime.dependencyTimeoutMs,
  statement_timeout: 5000,
});
const observer = new Client({ connectionString: runtimeUrl.href });
const logs = [];
const logger = new SafeLogger('deployment', (line) => logs.push(line));
const audit = new AuditRepository();
const outbox = new OutboxRepository();
const event = {
  type: 'fixture.changed',
  version: 1,
  fields: { revision: { kind: 'integer', min: 1, max: 100 } },
};
const work = {
  type: 'fixture.deliver',
  version: 1,
  fields: { mode: { kind: 'enum', values: ['once'] } },
};
const platform = {
  kind: 'platform_operator',
  reference: 'operator-fixture',
  plane: 'platform',
  tenantId: null,
};
const staff = {
  kind: 'tenant_staff',
  reference: 'staff-fixture',
  plane: 'tenant',
  tenantId: 'tenant-fixture',
};
const system = {
  kind: 'system',
  reference: 'deployment.fixture',
  plane: 'system',
  tenantId: null,
  reason: 'acceptance-check',
};
function context(id, actor = platform) {
  return {
    actor,
    target: { type: 'fixture', reference: id, tenantId: 'tenant-fixture' },
    correlationId: correlationId(),
  };
}
async function deploy() {
  const child = spawn(
    process.execPath,
    ['services/backend/dist/entrypoints/deployment/main.js', 'migrate'],
    {
      env: {
        ...process.env,
        DATABASE_URL: runtimeUrl.href,
        DATABASE_PASSWORD_FILE: undefined,
        MIGRATION_DATABASE_URL: adminUrl.href,
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
async function counts(id) {
  const result = await observer.query(
    `SELECT
    (SELECT count(*)::int FROM audit_fixture.sample WHERE id=$1) AS sample,
    (SELECT count(*)::int FROM public.audit_events WHERE target_reference=$1) AS audit,
    (SELECT count(*)::int FROM public.outbox_work WHERE target_reference=$1) AS outbox,
    (SELECT count(*)::int FROM audit_fixture.delivery_sink WHERE id=$1) AS effects`,
    [id],
  );
  return result.rows[0];
}
async function writes(tx, id) {
  await tx.query('INSERT INTO audit_fixture.sample (id) VALUES ($1)', [id]);
  const auditId = await audit.append(tx, event, { revision: 1 });
  const workId = await outbox.insert(tx, work, id, { mode: 'once' });
  return { auditId, workId };
}
async function denied(sql, values = []) {
  await assert.rejects(
    observer.query(sql, values),
    (error) => error.code === '42501',
  );
}
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await deploy();
  await deploy();
  await owner.connect();
  await observer.connect();
  const history = await observer.query(
    'SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL',
  );
  assert.equal(history.rows[0].count, 6);
  await owner.query(`CREATE SCHEMA audit_fixture;
    CREATE TABLE audit_fixture.sample (id text PRIMARY KEY);
    CREATE TABLE audit_fixture.delivery_sink (id text PRIMARY KEY);
    GRANT USAGE ON SCHEMA audit_fixture TO myims_runtime;
    GRANT SELECT, INSERT ON audit_fixture.sample TO myims_runtime;
    GRANT SELECT ON audit_fixture.delivery_sink TO myims_runtime;`);
  console.log(
    'PASS: fresh deployment and rerun apply five versioned migrations; fixtures exist only in disposable database',
  );
  let retained;
  const ctx = context('commit');
  const result = await Transaction.run(
    pool,
    ctx,
    'fixture.change',
    logger,
    async (tx) => {
      retained = tx;
      const ids = await writes(tx, 'commit');
      assert.deepEqual(await counts('commit'), {
        sample: 0,
        audit: 0,
        outbox: 0,
        effects: 0,
      });
      // Mutation of the caller object cannot change the transaction's attribution snapshot.
      ctx.actor = staff;
      return ids;
    },
  );
  assert.deepEqual(await counts('commit'), {
    sample: 1,
    audit: 1,
    outbox: 1,
    effects: 0,
  });
  assert.throws(() => retained.query('SELECT 1'), /no longer active/);
  const persisted = await observer.query(
    `SELECT a.*, w.id AS work_id, w.handoff_status, w.payload, w.actor_reference AS work_actor, w.correlation_id AS work_correlation
    FROM public.audit_events a JOIN public.outbox_work w ON w.target_reference = a.target_reference WHERE a.id=$1`,
    [result.auditId],
  );
  const row = persisted.rows[0];
  assert.equal(row.actor_kind, 'platform_operator');
  assert.equal(row.actor_tenant_id, null);
  assert.equal(row.tenant_id, 'tenant-fixture');
  assert.equal(row.work_actor, row.actor_reference);
  assert.equal(row.work_correlation, ctx.correlationId);
  assert.equal(row.correlation_id, ctx.correlationId);
  assert.equal(row.work_id, result.workId);
  assert.equal(row.handoff_status, 'pending');
  assert.ok(row.recorded_at instanceof Date);
  assert.deepEqual(row.metadata, { revision: 1 });
  assert.deepEqual(row.payload, { mode: 'once' });
  console.log(
    'PASS: same-connection writes invisible while transaction held; commit retains trusted attribution, correlation and pending intent without delivery',
  );
  await assert.rejects(
    Transaction.run(
      pool,
      context('rollback'),
      'fixture.change',
      logger,
      async (tx) => {
        await writes(tx, 'rollback');
        throw new Error('forced rollback');
      },
    ),
  );
  assert.deepEqual(await counts('rollback'), {
    sample: 0,
    audit: 0,
    outbox: 0,
    effects: 0,
  });
  // Force database-side audit and outbox INSERT failures independently after earlier writes.
  for (const table of ['audit_events', 'outbox_work']) {
    const id = `fail-${table}`;
    await owner.query(
      `ALTER TABLE public.${table} ADD CONSTRAINT fixture_fail CHECK (target_reference <> '${id}')`,
    );
    await assert.rejects(
      Transaction.run(pool, context(id), 'fixture.change', logger, (tx) =>
        writes(tx, id),
      ),
      (error) => error.code === '23514',
    );
    assert.deepEqual(await counts(id), {
      sample: 0,
      audit: 0,
      outbox: 0,
      effects: 0,
    });
    await owner.query(
      `ALTER TABLE public.${table} DROP CONSTRAINT fixture_fail`,
    );
  }
  // PostgreSQL returns ROLLBACK for COMMIT on an aborted transaction; never report success.
  await assert.rejects(
    Transaction.run(
      pool,
      context('caught-sql'),
      'fixture.change',
      logger,
      async (tx) => {
        try {
          await tx.query('INSERT INTO audit_fixture.sample (id) VALUES ($1)', [
            'commit',
          ]);
        } catch {
          /* Deliberate caller misuse. */
        }
      },
    ),
    /Required transaction write failed/,
  );
  console.log(
    'PASS: explicit rollback, forced audit failure, forced outbox failure and swallowed SQL failure cannot return committed success',
  );
  await assert.rejects(
    Transaction.run(
      pool,
      context('caught-validation'),
      'fixture.change',
      logger,
      async (tx) => {
        await tx.query('INSERT INTO audit_fixture.sample (id) VALUES ($1)', [
          'caught-validation',
        ]);
        try {
          await audit.append(tx, event, {
            revision: 1,
            token: 'SECRET_SENTINEL',
          });
        } catch {
          /* Required validation failures cannot be swallowed. */
        }
      },
    ),
    /Required transaction write failed/,
  );
  assert.deepEqual(await counts('caught-validation'), {
    sample: 0,
    audit: 0,
    outbox: 0,
    effects: 0,
  });
  for (const actor of [staff, system]) {
    const id = actor.kind;
    await Transaction.run(
      pool,
      context(id, actor),
      'fixture.change',
      logger,
      (tx) => writes(tx, id),
    );
    const result = await observer.query(
      'SELECT actor_kind, actor_tenant_id, system_reason FROM public.audit_events WHERE target_reference=$1',
      [id],
    );
    assert.equal(result.rows[0].actor_kind, actor.kind);
    assert.equal(result.rows[0].actor_tenant_id, actor.tenantId);
    assert.equal(result.rows[0].system_reason, actor.reason ?? null);
  }
  for (const actor of [
    { ...platform, tenantId: 'tenant-fixture' },
    { ...staff, tenantId: null },
    { ...staff, plane: 'platform' },
    { ...staff, tenantId: 'other-tenant' },
    { ...system, reason: undefined },
    { ...system, tenantId: 'tenant-fixture' },
    { ...platform, password: 'SECRET_SENTINEL' },
  ]) {
    let entered = false;
    await assert.rejects(
      Transaction.run(
        pool,
        context('invalid', actor),
        'fixture.change',
        logger,
        async () => {
          entered = true;
        },
      ),
      WriteValidationError,
    );
    assert.equal(entered, false);
  }
  assert.throws(
    () =>
      executionContext({
        ...context('invalid'),
        correlationId: 'x'.repeat(81),
      }),
    WriteValidationError,
  );
  assert.throws(
    () =>
      executionContext({
        ...context('invalid'),
        target: { type: 'fixture', reference: 'invalid' },
      }),
    WriteValidationError,
  );
  assert.match(correlationId('bad\nheader'), /^[a-f0-9-]{36}$/);
  assert.equal(correlationId('trusted-correlation'), 'trusted-correlation');
  assert.deepEqual(await counts('invalid'), {
    sample: 0,
    audit: 0,
    outbox: 0,
    effects: 0,
  });
  console.log(
    'PASS: platform/staff/system attribution and tenant separation; invalid structural combinations fail before transaction action',
  );
  for (const sql of [
    'UPDATE public.audit_events SET event_type=event_type',
    'DELETE FROM public.audit_events',
    'TRUNCATE public.audit_events',
    'ALTER TABLE public.audit_events DISABLE TRIGGER ALL',
    'DROP TRIGGER audit_events_append_only ON public.audit_events',
    'ALTER TABLE public.audit_events OWNER TO myims_runtime',
    'CREATE OR REPLACE FUNCTION public.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$',
    'SET session_replication_role = replica',
    'GRANT UPDATE ON public.audit_events TO myims_runtime',
    'UPDATE public.outbox_work SET actor_reference=actor_reference',
    'DELETE FROM public.outbox_work',
    'TRUNCATE public.outbox_work',
  ]) {
    // GRANT by a non-owner may warn and grant nothing, so prove effective permission separately.
    if (sql.startsWith('GRANT')) {
      await observer.query(sql);
      const privilege = await observer.query(
        "SELECT has_table_privilege(current_user,'public.audit_events','UPDATE') AS allowed",
      );
      assert.equal(privilege.rows[0].allowed, false);
    } else await denied(sql);
  }
  for (const table of ['audit_events', 'outbox_work']) {
    const typeColumn = table === 'audit_events' ? 'event_type' : 'work_type';
    const dataColumn = table === 'audit_events' ? 'metadata' : 'payload';
    const columns = `id,${typeColumn},schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,${dataColumn}${table === 'outbox_work' ? ',idempotency_key' : ''}`;
    for (const [kind, plane, tenant, reason] of [
      ['platform_operator', 'platform', 'forbidden-actor-tenant', null],
      ['tenant_staff', 'tenant', null, null],
      ['tenant_staff', 'tenant', 'other-tenant', null],
      ['system', 'system', null, null],
    ]) {
      await assert.rejects(
        observer.query(
          `INSERT INTO public.${table} (${columns})
        SELECT $1,${typeColumn},schema_version,$2,actor_reference,$3,$4,$5,target_type,target_reference,tenant_id,correlation_id,${dataColumn}${table === 'outbox_work' ? ',$6' : ''}
        FROM public.${table} WHERE target_reference='commit'`,
          [
            randomUUID(),
            kind,
            plane,
            tenant,
            reason,
            ...(table === 'outbox_work' ? [randomUUID()] : []),
          ],
        ),
        (error) => error.code === '23514',
      );
    }
  }
  await denied(
    "INSERT INTO public.outbox_work (id, handoff_status, accepted_at) VALUES ($1,'accepted',now())",
    [randomUUID()],
  );
  console.log(
    'PASS: database constraints independently reject invalid actor/scope combinations; runtime cannot override initial pending state',
  );
  const ownerRole = await owner.query('SELECT current_user AS name');
  const roleName = ownerRole.rows[0].name.replaceAll('"', '""');
  await denied(`SET ROLE "${roleName}"`);
  await denied(
    'INSERT INTO public.audit_events (id, recorded_at) VALUES ($1, now())',
    [randomUUID()],
  );
  await assert.rejects(
    owner.query('UPDATE public.audit_events SET event_type=event_type'),
    (error) => error.code === '42501',
  );
  const roles = await observer.query(
    'SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname=current_user',
  );
  assert.ok(Object.values(roles.rows[0]).every((value) => value === false));
  console.log(
    'PASS: actual runtime credentials INSERT succeeds; audit rewrite/truncate, timestamp override, trigger/owner bypass and owner-role acquisition denied; intent immutable',
  );
  const sentinels = [
    'SECRET_SENTINEL',
    'TOKEN',
    'PERSONAL_SENTINEL',
    'TOKEN_SENTINEL',
    'LOCATION_SENTINEL',
  ];
  for (const [index, sentinel] of sentinels.entries()) {
    const id = `unsafe-${index}`;
    await assert.rejects(
      Transaction.run(
        pool,
        context(id),
        'fixture.change',
        logger,
        async (tx) => {
          await tx.query('INSERT INTO audit_fixture.sample (id) VALUES ($1)', [
            id,
          ]);
          await audit.append(tx, event, { revision: 1, rawRequest: sentinel });
        },
      ),
      WriteValidationError,
    );
    await assert.rejects(
      Transaction.run(
        pool,
        context(id),
        'fixture.change',
        logger,
        async (tx) => {
          await tx.query('INSERT INTO audit_fixture.sample (id) VALUES ($1)', [
            id,
          ]);
          await audit.append(tx, event, { revision: 1 });
          await outbox.insert(tx, work, id, { mode: sentinel });
        },
      ),
      WriteValidationError,
    );
    logger.write({
      operation: 'fixture.failure',
      correlationId: ctx.correlationId,
      workId: result.workId,
      attempt: 2,
      outcome: 'failed',
      error: Object.assign(new Error(sentinel), {
        detail: sentinel,
        token: sentinel,
        code: sentinel,
      }),
    });
    assert.deepEqual(await counts(id), {
      sample: 0,
      audit: 0,
      outbox: 0,
      effects: 0,
    });
  }
  const data = await observer.query(
    'SELECT row_to_json(a)::text AS data FROM public.audit_events a UNION ALL SELECT row_to_json(w)::text FROM public.outbox_work w',
  );
  const captured = logs.join('\n') + JSON.stringify(data.rows);
  for (const sentinel of sentinels) assert.ok(!captured.includes(sentinel));
  for (const line of logs) {
    const log = JSON.parse(line);
    assert.ok(
      log.timestamp &&
        log.level &&
        log.entrypoint &&
        log.operation &&
        log.correlationId,
    );
    assert.ok(Number.isInteger(log.attempt));
    assert.ok(!('error' in log) && !('stack' in log));
  }
  console.log(
    'PASS: event-specific field allowlists reject secret/personal sentinels; captured logs sanitize arbitrary exceptions and retain safe correlation/work/attempt fields',
  );
  // Mutable handoff never rewrites history or means that an effect succeeded.
  await observer.query(
    "UPDATE public.outbox_work SET handoff_status='accepted', accepted_at=clock_timestamp() WHERE id=$1",
    [result.workId],
  );
  assert.deepEqual(await counts('commit'), {
    sample: 1,
    audit: 1,
    outbox: 1,
    effects: 0,
  });
  console.log(
    'PASS: handoff status is separately mutable while audit history and initiating intent remain retained',
  );
} finally {
  await pool.end();
  await observer.end();
  await owner.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
