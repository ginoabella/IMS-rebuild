// Fresh isolated PostgreSQL/pg-boss only; no real credentials, workers or providers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const database = process.env.TRUNK_OWNER_FIXTURE_DATABASE;
assert.match(database ?? '', /^myims_trunk_fixture_[0-9a-f]{32}$/);
const backend = createRequire(
  '/workspace/services/backend/dist/infrastructure/worker/delivery.js',
);
const { DeliveryWorker, sampleContract } = backend('./delivery.js');
const { provisionQueue, QUEUE } = backend('./queue.js');
const { Transaction } = backend('../database/transaction.js');
const { SafeLogger } = backend('../execution/logging.js');
const { OutboxRepository } = backend('../outbox/outbox-repository.js');
const { Pool } = backend('pg');
const { parseWorkerConfig } = backend('@myims/config');
const admin = new Pool({
  connectionString: `postgresql://postgres@127.0.0.1:5432/${database}`,
});
const runtimeUrl = `postgresql://myims_runtime@127.0.0.1:5432/${database}`;
const settings = parseWorkerConfig({
  WORKER_POLL_MS: '100',
  WORKER_RETRY_SECONDS: '1',
  WORKER_TIMEOUT_SECONDS: '5',
  WORKER_CONCURRENCY: '1',
  WORKER_ATTEMPTS: '3',
  WORKER_SHUTDOWN_MS: '1000',
});
let endpointPolls = 0,
  endpointCalls = 0;
const ordinary = new DeliveryWorker(runtimeUrl, settings);
const endpoint = new DeliveryWorker(
  runtimeUrl,
  settings,
  {},
  {
    installationId: '00000000-0000-4000-8000-000000000201',
    execute: async () => {
      endpointCalls++;
    },
    reconcileExhausted: async () => {
      endpointPolls++;
    },
  },
);
const workers = [];
const context = {
  actor: {
    kind: 'platform_operator',
    reference: '00000000-0000-4000-8000-000000000001',
    plane: 'platform',
    tenantId: null,
  },
  target: {
    type: 'trunk_credential_operation',
    reference: randomUUID(),
    tenantId: null,
  },
  correlationId: 'protected-work-fixture',
};
const logger = new SafeLogger('deployment', () => {});
async function insert(type, payload = {}) {
  const contract =
    type === sampleContract.type
      ? sampleContract
      : { type, version: 1, fields: {} };
  return Transaction.run(
    admin,
    context,
    'protected-work-fixture',
    logger,
    (t) => new OutboxRepository().insert(t, contract, randomUUID(), payload),
  );
}
async function until(predicate) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error('fixture_poll_timeout');
}
try {
  const client = await admin.connect();
  try {
    await provisionQueue(client);
  } finally {
    client.release();
  }
  const types = [
    'trunk.credential.verify',
    'trunk.credential.import',
    'trunk.credential.cleanup',
    'endpoint.credential.future',
  ];
  const protectedIds = [];
  for (const type of types) protectedIds.push(await insert(type));
  const ordinaryId = await insert(sampleContract.type, { mode: 'once' });
  await ordinary.start();
  workers.push(ordinary);
  await endpoint.start();
  workers.push(endpoint);
  await until(
    async () =>
      (
        await admin.query(
          "SELECT 1 FROM public.work_results WHERE work_id=$1 AND outcome='succeeded'",
          [ordinaryId],
        )
      ).rows.length === 1,
  );
  const invalidJob = await ordinary.boss.send(QUEUE, {
    workId: 'invalid-fixture-id',
  });
  await until(
    async () =>
      (
        await admin.query(
          "SELECT 1 FROM pgboss.job WHERE name=$1 AND id=$2 AND state='failed'",
          [QUEUE, invalidJob],
        )
      ).rows.length === 1,
  );
  await until(() => endpointPolls >= 2);
  const jobs = (
    await admin.query(
      "SELECT data, state, retry_count FROM pgboss.job WHERE name=$1 AND data->>'workId'=ANY($2::text[])",
      [QUEUE, protectedIds],
    )
  ).rows;
  assert.equal(jobs.length, protectedIds.length);
  assert.ok(jobs.every((j) => j.state === 'created' && j.retry_count === 0));
  assert.equal(
    (
      await admin.query(
        'SELECT 1 FROM public.work_results WHERE work_id=ANY($1::uuid[])',
        [protectedIds],
      )
    ).rows.length,
    0,
  );
  assert.equal(endpointCalls, 0);
  // Inject queue exhaustion; generic reconciliation must not manufacture a sample
  // result for work owned by a future protected installation consumer.
  await admin.query(
    "UPDATE pgboss.job SET state='failed',started_on=clock_timestamp(),completed_on=clock_timestamp() WHERE name=$1 AND data->>'workId'=ANY($2::text[])",
    [QUEUE, protectedIds],
  );
  const before = endpointPolls;
  await until(() => endpointPolls >= before + 2);
  assert.equal(
    (
      await admin.query(
        'SELECT 1 FROM public.work_results WHERE work_id=ANY($1::uuid[])',
        [protectedIds],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await admin.query(
        'SELECT 1 FROM public.work_receipts WHERE work_id=ANY($1::uuid[])',
        [protectedIds],
      )
    ).rows.length,
    0,
  );
  assert.equal(endpointCalls, 0);
  console.log(
    JSON.stringify({
      status: 'passed',
      checks: [
        'ordinary_delivery_and_invalid_job_failure_remain_functional',
        'ordinary_and_endpoint_consumers_leave_reserved_trunk_and_future_endpoint_jobs_unclaimed',
        'generic_exhaustion_reconciliation_does_not_write_protected_results_or_receipts',
      ],
      providerAccess: false,
    }),
  );
} catch (error) {
  console.error(
    `TRUNK_ADAPTER_FAILURE_${error?.code ?? error?.name ?? 'unknown'}_queue_isolation`,
  );
  process.exitCode = 1;
} finally {
  for (const worker of workers.reverse()) await worker.stop();
  await admin.end();
}
