import {
  verifyProcessRecovery,
  verifyDatabaseRecovery,
} from './worker-recovery.mjs';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client, Pool } = backend('pg');
const PgBoss = backend('pg-boss');
const { loadMigrationConfig } = backend(
  './dist/infrastructure/configuration.js',
);
const { parseWorkerConfig } = backend('@myims/config');
const { SafeLogger } = backend('./dist/infrastructure/execution/logging.js');
const { Transaction } = backend(
  './dist/infrastructure/database/transaction.js',
);
const { AuditRepository } = backend(
  './dist/modules/audit/adapters/db/audit-repository.js',
);
const { OutboxRepository } = backend(
  './dist/infrastructure/outbox/outbox-repository.js',
);
const { sampleContract } = backend('./dist/infrastructure/worker/delivery.js');
const { QUEUE } = backend('./dist/infrastructure/worker/queue.js');
const config = loadMigrationConfig();
const name = `myims_worker_${randomBytes(6).toString('hex')}`;
const runtime = new URL(config.runtimeUrl);
const deployment = new URL(config.adminUrl);
runtime.pathname = deployment.pathname = `/${name}`;
const admin = new Client({ connectionString: config.adminUrl });
const owner = new Client({ connectionString: deployment.href });
const pool = new Pool({ connectionString: runtime.href });
const boss = new PgBoss({
  db: { executeSql: (sql, values) => pool.query(sql, values) },
  migrate: false,
  supervise: false,
  schedule: false,
});
boss.on('error', () => {});
const children = new Set();
const logs = [];
const sentinel = 'SECRET_SENTINEL_worker_password_reporter';
const settings = {
  WORKER_POLL_MS: '100',
  WORKER_RETRY_SECONDS: '1',
  WORKER_TIMEOUT_SECONDS: '5',
  WORKER_CONCURRENCY: '2',
  WORKER_ATTEMPTS: '3',
  WORKER_SHUTDOWN_MS: '1000',
};
const env = {
  ...process.env,
  ...settings,
  DATABASE_URL: runtime.href,
  DATABASE_PASSWORD_FILE: undefined,
  MIGRATION_DATABASE_URL: undefined,
  MIGRATION_DATABASE_PASSWORD_FILE: undefined,
};
async function deploy() {
  const child = spawn(
    process.execPath,
    ['services/backend/dist/entrypoints/deployment/main.js', 'migrate'],
    {
      env: { ...env, MIGRATION_DATABASE_URL: deployment.href },
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
async function poll(query, predicate, timeout = 25000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const result = await query();
    if (predicate(result)) return result;
    await delay(50);
  }
  throw new Error('Bounded durable-state polling timed out');
}
function worker(stage, id, production = false, databaseUrl = runtime.href) {
  const args = [
    '--import',
    './scripts/deny-listen.mjs',
    production
      ? 'services/backend/dist/entrypoints/worker/main.js'
      : 'scripts/worker-fixture.mjs',
  ];
  if (stage) args.push(stage, id);
  const child = spawn(process.execPath, args, {
    env: { ...env, DATABASE_URL: databaseUrl },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  children.add(child);
  child.messages = [];
  child.captured = '';

  child.on('message', (message) => child.messages.push(message));
  child.stdout.on('data', (data) => {
    logs.push(String(data));
    child.captured += String(data);
    if (String(data).includes('"state":"ready"')) child.ready = true;
  });
  child.errors = '';
  child.stderr.on('data', (data) => {
    logs.push(String(data));
    child.errors += String(data);
  });
  child.on('exit', () => children.delete(child));
  return child;
}
async function barrier(child, stage) {
  await poll(
    async () => child.messages,
    (messages) => messages.some((message) => message.stage === stage),
  );
}
async function kill(child, signal = 'SIGKILL') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = once(child, 'exit');
  child.kill(signal);
  const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
  const [code, actualSignal] = await ended;
  clearTimeout(timer);
  if (signal === 'SIGTERM') assert.equal(code, 0);
  else assert.equal(actualSignal, 'SIGKILL');
}
async function insert(
  mode = 'once',
  tenant = 'tenant-a',
  type = sampleContract.type,
  version = 1,
  payload,
  key,
) {
  const id = randomUUID();
  const context = {
    actor: {
      kind: 'tenant_staff',
      reference: 'fixture-staff',
      plane: 'tenant',
      tenantId: tenant,
    },
    target: { type: 'sample', reference: id, tenantId: tenant },
    correlationId: randomUUID(),
  };
  return Transaction.run(
    pool,
    context,
    'sample.create',
    new SafeLogger('deployment', (line) => logs.push(line)),
    async (transaction) => {
      await transaction.query(
        'INSERT INTO worker_fixture.sample(id) VALUES($1)',
        [id],
      );
      await new AuditRepository().append(
        transaction,
        {
          type: 'sample.created',
          version: 1,
          fields: { revision: { kind: 'integer', min: 1, max: 1 } },
        },
        { revision: 1 },
      );
      return new OutboxRepository().insert(
        transaction,
        {
          ...sampleContract,
          type,
          version,
          ...(payload
            ? { fields: { mode: { kind: 'enum', values: [sentinel] } } }
            : {}),
        },
        key ?? id,
        payload ?? { mode },
      );
    },
  );
}
async function state(id) {
  return (
    await pool.query(
      `SELECT w.handoff_status,r.outcome,r.attempts,r.failure_code,
    (SELECT count(*)::int FROM public.sample_delivery_sink WHERE work_id=w.id) effects,
    (SELECT count(*)::int FROM public.work_receipts WHERE work_id=w.id) receipts
    FROM public.outbox_work w LEFT JOIN public.work_results r ON r.work_id=w.id WHERE w.id=$1`,
      [id],
    )
  ).rows[0];
}
async function terminal(id, outcome = 'succeeded') {
  const result = await poll(
    () => state(id),
    (row) => row.outcome === outcome,
  );
  assert.equal(result.effects, outcome === 'succeeded' ? 1 : 0);
  assert.equal(result.receipts, outcome === 'succeeded' ? 1 : 0);
  return result;
}
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await deploy();
  await deploy();
  await owner.connect();
  await owner.query(
    'CREATE SCHEMA worker_fixture; CREATE TABLE worker_fixture.sample(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA worker_fixture TO myims_runtime; GRANT INSERT ON worker_fixture.sample TO myims_runtime',
  );
  await boss.start();
  for (const sql of [
    'CREATE TABLE pgboss.denied(id int)',
    "SELECT pgboss.create_queue('denied','{}')",
    'UPDATE pgboss.version SET version=1',
    'DELETE FROM public.work_receipts',
    'DELETE FROM public.sample_delivery_sink',
  ]) {
    await assert.rejects(pool.query(sql), (error) => error.code === '42501');
  }
  assert.equal(await boss.schemaVersion(), 24);
  for (const key of Object.keys(settings))
    assert.throws(() => parseWorkerConfig({ [key]: '0' }));
  console.log(
    'PASS: fresh/rerun coordinated queue schema 24, runtime no DDL/functions/receipt deletion, bounded settings',
  );
  const pending = await insert();
  assert.equal((await state(pending)).handoff_status, 'pending');
  assert.equal((await state(pending)).effects, 0);
  const a = worker();
  const b = worker(undefined, undefined, true);
  await barrier(a, 'ready');
  await poll(async () => b.ready, Boolean);
  await terminal(pending);
  await kill(a, 'SIGTERM');
  await kill(b, 'SIGTERM');
  console.log(
    'PASS: stopped-worker persistence; two independent OS workers deliver; production entrypoint has no listener and drains',
  );
  for (const stage of ['before_enqueue', 'after_enqueue']) {
    const id = await insert();
    const crashed = worker(stage, id);
    await barrier(crashed, stage);
    assert.equal((await state(id)).handoff_status, 'pending');
    assert.equal(
      (
        await pool.query('SELECT count(*)::int n FROM pgboss.job WHERE id=$1', [
          id,
        ])
      ).rows[0].n,
      0,
    );
    await kill(crashed);
    const next = worker();
    await barrier(next, 'ready');
    await terminal(id);
    await kill(next, 'SIGTERM');
  }
  console.log(
    'PASS: hard death before/after enqueue rolls back job and handoff together; restart loses no work',
  );
  const sinkId = await insert();
  const interrupted = worker('after_sink', sinkId);
  await barrier(interrupted, 'after_sink');
  assert.equal((await state(sinkId)).effects, 1);
  assert.equal((await state(sinkId)).outcome, null);
  await kill(interrupted);
  const c = worker();
  const d = worker();
  await barrier(c, 'ready');
  await barrier(d, 'ready');
  await terminal(sinkId);
  await boss.send(QUEUE, { workId: sinkId });
  await boss.send(QUEUE, { workId: sinkId });
  const duplicated = await insert();
  await Promise.all(
    Array.from({ length: 6 }, () =>
      boss.send(
        QUEUE,
        { workId: duplicated },
        { retryLimit: 2, retryDelay: 1 },
      ),
    ),
  );
  await terminal(duplicated);
  const sharedKey = randomUUID();
  const scopedA = await insert(
    'once',
    'tenant-a',
    sampleContract.type,
    1,
    undefined,
    sharedKey,
  );
  const scopedB = await insert(
    'once',
    'tenant-b',
    sampleContract.type,
    1,
    undefined,
    sharedKey,
  );
  await terminal(scopedA);
  await terminal(scopedB);
  await assert.rejects(
    insert('once', 'tenant-a', sampleContract.type, 1, undefined, sharedKey),
    (error) => error.code === '23505',
  );
  const other = await insert('once', 'tenant-b');
  await terminal(other);
  await poll(
    async () =>
      (
        await pool.query(
          "SELECT count(*)::int n FROM pgboss.job WHERE state<'completed'",
        )
      ).rows[0].n,
    (n) => n === 0,
  );
  assert.equal((await state(sinkId)).effects, 1);
  assert.equal((await state(duplicated)).effects, 1);
  console.log(
    'PASS: sink-acceptance death converges across restart, sequential/concurrent duplicates yield one effect, tenant/work keys independent',
  );
  const transient = await insert('transient');
  assert.equal((await terminal(transient)).attempts, 2);
  const timing = (
    await pool.query(
      'SELECT extract(epoch FROM (last_attempt_at-first_attempt_at)) seconds FROM public.work_results WHERE work_id=$1',
      [transient],
    )
  ).rows[0];
  assert.ok(Number(timing.seconds) >= 1, 'retry respects backoff');
  const exhausted = await insert('exhaust');
  assert.equal((await terminal(exhausted, 'failed')).attempts, 3);
  assert.equal((await state(exhausted)).failure_code, 'retry_exhausted');
  for (const [type, version, mode, code] of [
    ['unknown.work', 1, 'once', 'invalid_work'],
    [sampleContract.type, 2, 'once', 'invalid_work'],
    [sampleContract.type, 1, 'permanent', 'permanent_failure'],
  ]) {
    const id = await insert(mode, 'tenant-a', type, version);
    assert.equal((await terminal(id, 'failed')).failure_code, code);
    assert.equal((await state(id)).attempts, 1);
  }
  const malformed = await insert('once', 'tenant-a', sampleContract.type, 1, {
    mode: sentinel,
  });
  assert.equal(
    (await terminal(malformed, 'failed')).failure_code,
    'invalid_work',
  );
  await kill(c, 'SIGTERM');
  await kill(d, 'SIGTERM');
  const crashExhausted = await insert();
  const crashWorker = worker('after_sink', crashExhausted);
  await barrier(crashWorker, 'after_sink');
  await owner.query(
    'UPDATE pgboss.job SET retry_limit=retry_count WHERE id=$1',
    [crashExhausted],
  );
  await kill(crashWorker);
  const duplicateFailure = await boss.send(
    QUEUE,
    { workId: crashExhausted },
    { retryLimit: 0 },
  );
  await owner.query(
    "UPDATE pgboss.job SET state='failed',completed_on=clock_timestamp() WHERE id=$1",
    [duplicateFailure],
  );
  const recovery = worker();
  await barrier(recovery, 'ready');
  const failure = await poll(
    () => state(crashExhausted),
    (row) => row.outcome === 'failed',
  );
  assert.equal(failure.failure_code, 'queue_exhausted');
  assert.equal(failure.effects, 1);
  assert.equal(failure.receipts, 0);
  const malformedJob = await boss.send(
    QUEUE,
    { workId: 'invalid-id' },
    { retryLimit: 2 },
  );
  await poll(
    () => boss.getJobById(QUEUE, malformedJob),
    (job) => job.state === 'failed',
  );
  const invalid = await boss.getJobById(QUEUE, malformedJob);
  assert.equal(invalid.retryCount, 0);
  await kill(recovery, 'SIGTERM');
  console.log(
    'PASS: expired hard-crash exhaustion retains failed acknowledgement evidence; malformed queue IDs terminally fail',
  );
  assert.ok(!logs.join('').includes(sentinel));
  const retained = JSON.stringify(
    (await pool.query('SELECT * FROM public.work_results')).rows,
  );
  assert.ok(!retained.includes(sentinel));
  const queueOutputs = JSON.stringify(
    (await pool.query('SELECT output FROM pgboss.job')).rows,
  );
  assert.ok(!queueOutputs.includes(sentinel));
  assert.ok(logs.join('').includes('fixture-staff'));
  const payloads = JSON.stringify(
    (await pool.query('SELECT data FROM pgboss.job')).rows,
  );
  const audit = JSON.stringify(
    (await pool.query('SELECT metadata FROM public.audit_events')).rows,
  );
  assert.ok(!payloads.includes(sentinel));
  assert.ok(!audit.includes(sentinel));
  const expected = (
    await pool.query(
      'SELECT correlation_id FROM public.outbox_work WHERE id=$1',
      [transient],
    )
  ).rows[0].correlation_id;
  const trace = logs
    .join('\n')
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.workId === transient);
  assert.ok(trace.some((entry) => entry.operation === 'work.dispatch'));
  assert.equal(
    trace.filter((entry) => entry.operation === 'work.execute').length,
    2,
  );
  assert.ok(
    trace.every(
      (entry) =>
        entry.correlationId === expected &&
        entry.actorReference === 'fixture-staff',
    ),
  );
  assert.ok(trace.some((entry) => entry.failureCode === 'retryable_delivery'));

  console.log(
    'PASS: transient retry, bounded exhaustion, unknown type/version, permanent/malformed terminal outcomes and end-to-end sentinel omission',
  );
  if (process.argv.includes('--recovery')) {
    await owner.query('REVOKE UPDATE ON pgboss.job FROM myims_runtime');
    try {
      const denied = worker(undefined, undefined, true);
      const deniedExit = once(denied, 'exit');
      const timer = setTimeout(() => denied.kill('SIGKILL'), 15000);
      const [code] = await deniedExit;
      clearTimeout(timer);
      assert.equal(code, 1);
      assert.ok(!denied.ready);
      assert.match(denied.captured, /"state":"failed"/);
      console.log(
        'PASS: worker readiness rejects missing queue claim/acknowledgement capability without listener',
      );
    } finally {
      await owner.query('GRANT UPDATE ON pgboss.job TO myims_runtime');
    }
    await verifyProcessRecovery({
      pool,
      pending,
      exhausted,
      insert,
      state,
      worker,
      barrier,
      kill,
      terminal,
    });
  }
  // Interrupt real PostgreSQL connectivity only for this test worker; no shared service outage.
  let available = true;
  const sockets = new Set();
  const proxy = net.createServer((socket) => {
    if (!available) {
      socket.destroy();
      return;
    }
    const upstream = net.connect(
      Number(runtime.port || 5432),
      runtime.hostname,
    );
    for (const connection of [socket, upstream]) {
      sockets.add(connection);
      connection.on('error', () => {
        socket.destroy();
        upstream.destroy();
      });
      connection.on('close', () => {
        sockets.delete(connection);
        socket.destroy();
        upstream.destroy();
      });
    }
    socket.pipe(upstream).pipe(socket);
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const proxied = new URL(runtime.href);
  proxied.hostname = '127.0.0.1';
  proxied.port = String(proxy.address().port);
  const isolated = worker(undefined, undefined, false, proxied.href);
  try {
    await barrier(isolated, 'ready');
    available = false;
    for (const socket of sockets) socket.destroy();
    const interruptedWork = await insert();
    const dispatchFailures = () =>
      isolated.captured
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .map((line) => JSON.parse(line))
        .filter(
          (entry) =>
            entry.state === 'degraded' && entry.component === 'dispatch',
        );
    await poll(
      async () => dispatchFailures(),
      (entries) => entries.length >= 3,
    );
    const failures = dispatchFailures();
    assert.ok(
      Date.parse(failures[1].timestamp) - Date.parse(failures[0].timestamp) >=
        190,
    );
    assert.ok(
      Date.parse(failures[2].timestamp) - Date.parse(failures[1].timestamp) >=
        390,
    );
    assert.equal((await state(interruptedWork)).handoff_status, 'pending');
    assert.equal((await state(interruptedWork)).effects, 0);
    available = true;
    await terminal(interruptedWork);
    await kill(isolated, 'SIGTERM');
    console.log(
      'PASS: worker PostgreSQL connectivity interruption retains pending work, reports degradation, backs off and recovers',
    );
    if (process.argv.includes('--recovery')) {
      await verifyDatabaseRecovery({
        pool,
        insert,
        state,
        worker,
        proxied,
        barrier,
        poll,
        terminal,
        kill,
        disable: () => {
          available = false;
          for (const socket of sockets) socket.destroy();
        },
        restore: () => {
          available = true;
        },
      });
      assert.ok(!logs.join('').includes(sentinel));
      for (const sql of [
        'SELECT * FROM public.audit_events',
        'SELECT data,output FROM pgboss.job',
        'SELECT * FROM public.work_results',
      ])
        assert.ok(
          !JSON.stringify((await pool.query(sql)).rows).includes(sentinel),
        );
      console.log(
        'PASS: real PostgreSQL interruption at handoff, active execution and accepted effect; no false success, unchanged attribution, restored one effect/receipt; sentinel exclusion',
      );
    }
  } finally {
    await kill(isolated);
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => proxy.close(resolve));
  }
} finally {
  for (const child of children) await kill(child);
  await boss.stop();
  await pool.end();
  await owner.end();
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
}
