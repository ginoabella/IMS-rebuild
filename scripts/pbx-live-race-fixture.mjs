// Acceptance-only real SQL lease / dispatched native command / helper-death race.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/native-application.js',
);
const { ProtectedArtifactStore } = load('./artifact-store.js'),
  { NativeAdmissionBarrier } = load('./admission.js'),
  { NativePbxDriver } = load('./native-driver.js'),
  { NativeDenyProbes } = load('./native-probes.js'),
  { NativeLiveApplication } = load('./native-application.js'),
  { LiveExecutionStore } = load('./execution-store.js');
const { ObservationRepository } = load('../db/observation-repository.js'),
  { observationSettings } = load('../../domain/observation-settings.js'),
  { InventoryRuntime } = load('../db/inventory-runtime.js'),
  { TransactionAuthority } = load(
    '../../../identity/application/transaction-authority.js',
  ),
  { PlatformAuthorityRepository } = load(
    '../../../platform/adapters/db/authority-read.js',
  ),
  { DeliveryWorker } = load('../../../../infrastructure/worker/delivery.js'),
  { parseWorkerConfig } = load('@myims/config');
const metadata = JSON.parse(readFileSync('/input/integration.json', 'utf8')),
  mode = process.argv[2];
const connection = (user, file) => {
  const value = new URL(
    `postgresql://${user}@postgres:5432/${metadata.database}`,
  );
  value.password = readFileSync(file, 'utf8').trim();
  return value.href;
};
const runtime = connection('myims_runtime', '/input/runtime.password'),
  ownership = new ObservationRepository(runtime, observationSettings());
if (mode === 'acquire') {
  try {
    const deadline = Date.now() + 20000;
    let token;
    while (Date.now() < deadline) {
      token = await ownership.acquire(metadata.nodeId, randomUUID());
      if (token) break;
      await delay(100);
    }
    assert.ok(token);
    writeFileSync('/race-successor.json', JSON.stringify(token), {
      mode: 0o600,
    });
  } finally {
    await ownership.close();
  }
} else {
  const store = new LiveExecutionStore(
    connection('myims_pbx_executor', '/input/executor.password'),
  );
  const http = new InventoryRuntime(
    runtime,
    new TransactionAuthority(
      { lockedById: async () => ({ kind: 'denied' }) },
      new PlatformAuthorityRepository(store.database),
    ),
  );
  const root = `/var/lib/myims-pbx/control/${metadata.nodeId}`;
  const artifacts = new ProtectedArtifactStore(
      root + '/staging',
      metadata.installationId,
      metadata.nodeId,
    ),
    barrier = new NativeAdmissionBarrier(['127.0.0.1']),
    driver = new NativePbxDriver(
      root,
      '/var/lib/myims-pbx/managed',
      artifacts,
      barrier,
    );
  const application = new NativeLiveApplication(
    root,
    metadata.nodeId,
    metadata.installationId,
    store,
    artifacts,
    driver,
    barrier,
    new NativeDenyProbes(artifacts),
  );
  const worker = new DeliveryWorker(
    runtime,
    parseWorkerConfig({ WORKER_CONCURRENCY: '1', WORKER_POLL_MS: '100' }),
  );
  const principal = {
    plane: 'platform',
    operatorId: metadata.operatorId,
    authenticationVersion: (
      await store.pool.query(
        "SELECT authentication_version FROM public.platform_operators WHERE id=$1 AND status='active'",
        [metadata.operatorId],
      )
    ).rows[0]?.authentication_version,
    grants: ['platform_operator'],
  };
  let token =
    mode === 'old'
      ? await ownership.acquire(metadata.nodeId, randomUUID())
      : JSON.parse(readFileSync('/race-successor.json', 'utf8'));
  assert.ok(token);
  let renewing = false;
  const timer = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      const next = await ownership.renew(token);
      if (next) token = next;
    } finally {
      renewing = false;
    }
  }, 1000);
  async function delivered(id) {
    for (let i = 0; i < 200; i++) {
      if (
        (
          await store.pool.query(
            'SELECT delivered_at FROM public.pbx_live_progress WHERE operation_id=$1',
            [id],
          )
        ).rows[0]?.delivered_at
      )
        return;
      await delay(50);
    }
    throw new Error('Race worker delivery deadline');
  }
  try {
    await application.connect(token);
    await worker.start();
    if (mode === 'old') {
      writeFileSync('/race-old.pid', String(process.pid), { mode: 0o600 });
      const baseline = (
        await store.pool.query(
          'SELECT known_good_id FROM public.pbx_live_runtime WHERE node_id=$1',
          [metadata.nodeId],
        )
      ).rows[0].known_good_id;
      const capture = await http.revisions.write(
        principal,
        metadata.nodeId,
        null,
        { requestId: randomUUID() },
        randomUUID(),
      );
      assert.equal(capture.status, 201);
      const revision = capture.value.revision;
      await http.revisions.write(
        principal,
        metadata.nodeId,
        revision.id,
        {},
        randomUUID(),
      );
      const accepted = await http.live.accept(
        principal,
        metadata.nodeId,
        'apply',
        {
          requestId: randomUUID(),
          revisionId: revision.id,
          expectedBaselineId: baseline,
        },
        randomUUID(),
      );
      assert.equal(accepted.status, 202);
      const operation = accepted.value.operation;
      writeFileSync(
        '/race-request.json',
        JSON.stringify({ operationId: operation.id, baseline, token }),
        { mode: 0o600 },
      );
      await delivered(operation.id);
      const reload = driver.reload.bind(driver);
      driver.reload = async (guard) => {
        clearInterval(timer);
        writeFileSync('/race-ready', 'ready');
        const deadline = Date.now() + 5000;
        while (!existsSync('/race-paused') && Date.now() < deadline)
          await delay(25);
        assert.ok(existsSync('/race-paused'));
        try {
          return await reload(guard);
        } catch (error) {
          writeFileSync('/race-timeout', 'timeout');
          throw error;
        }
      };
      await application.execute(token, operation.id, {
        material: { endpoints: new Map(), trunks: new Map() },
      });
      throw new Error(
        'Old helper must be terminated while its dispatched command remains fenced',
      );
    } else {
      const predecessor = JSON.parse(
        readFileSync('/race-request.json', 'utf8'),
      );
      assert.ok(BigInt(token.epoch) > BigInt(predecessor.token.epoch));
      await assert.rejects(
        application.inspect(predecessor.token, predecessor.operationId),
      );
      let reloads = 0;
      const reload = driver.reload.bind(driver);
      driver.reload = async (guard) => {
        reloads++;
        return reload(guard);
      };
      await application.execute(token, predecessor.operationId, null);
      assert.equal(reloads, 0, 'uncertain candidate reload must not replay');
      assert.equal(
        (
          await store.pool.query(
            'SELECT state FROM public.pbx_live_progress WHERE operation_id=$1',
            [predecessor.operationId],
          )
        ).rows[0].state,
        'unknown',
      );
      await barrier.assertClosed();
      const recovery = await http.live.accept(
        principal,
        metadata.nodeId,
        'reconcile',
        {
          requestId: randomUUID(),
          targetId: predecessor.baseline,
          expectedBaselineId: predecessor.baseline,
        },
        randomUUID(),
      );
      assert.equal(recovery.status, 202);
      await delivered(recovery.value.operation.id);
      await application.execute(token, recovery.value.operation.id, null);
      const current = (
        await store.pool.query(
          'SELECT runtime_state,verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
          [metadata.nodeId],
        )
      ).rows[0];
      assert.equal(current.runtime_state, 'verified');
      assert.equal(current.verified_id, predecessor.baseline);
      assert.equal(
        reloads,
        1,
        'only explicit audited baseline restoration may reload',
      );
      console.log(
        'PASS integrated dispatch race: real SQL lease expiry/takeover during paused dispatched reload; helper SIGKILL retains kernel fence, successor waits for actual completion, rejects old owner and reconciles partial runtime without candidate replay before audited verified restoration',
      );
    }
  } finally {
    clearInterval(timer);
    await driver.drain();
    await worker.stop();
    await ownership.release(token).catch(() => {});
    await http.onApplicationShutdown();
    await ownership.close();
    await store.close();
  }
}
