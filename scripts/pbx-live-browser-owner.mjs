// Acceptance-only owner in a disposable PBX. Provider access always rejects;
// this browser journey applies disabled/unbound desired stock and needs no secret.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
  { LiveExecutionStore } = load('./execution-store.js'),
  { NativeOwnerServer, NativeOwnerClient } = load('./native-transport.js');
const { ObservationRepository } = load('../db/observation-repository.js'),
  { observationSettings } = load('../../domain/observation-settings.js'),
  { DeliveryWorker } = load('../../../../infrastructure/worker/delivery.js'),
  { parseWorkerConfig } = load('@myims/config');
async function main() {
  const metadata = JSON.parse(readFileSync('/input/integration.json', 'utf8'));
  const url = (user, file) => {
    const value = new URL(
      `postgresql://${user}@postgres:5432/${metadata.database}`,
    );
    value.password = readFileSync(file, 'utf8').trim();
    return value.href;
  };
  const runtime = url('myims_runtime', '/input/runtime.password'),
    store = new LiveExecutionStore(
      url('myims_pbx_executor', '/input/executor.password'),
    );
  const ownership = new ObservationRepository(runtime, observationSettings()),
    worker = new DeliveryWorker(
      runtime,
      parseWorkerConfig({ WORKER_CONCURRENCY: '1', WORKER_POLL_MS: '100' }),
    );
  const root = `/var/lib/myims-pbx/control/${metadata.nodeId}`;
  mkdirSync(root + '/staging', { recursive: true, mode: 0o700 });
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
  const server = new NativeOwnerServer(
      '/var/lib/myims-pbx/browser.sock',
      application,
    ),
    client = new NativeOwnerClient('/var/lib/myims-pbx/browser.sock');
  let token = await ownership.acquire(metadata.nodeId, randomUUID());
  if (!token) throw new Error('Owned browser lease unavailable');
  let stopped = false,
    renewing = false;
  const timer = setInterval(async () => {
    if (renewing || stopped) return;
    renewing = true;
    try {
      const next = await ownership.renew(token);
      if (!next) stopped = true;
      else token = next;
    } catch {
      stopped = true;
    } finally {
      renewing = false;
    }
  }, 1000);
  process.once('SIGTERM', () => {
    stopped = true;
  });
  try {
    await server.start();
    await client.connect(token);
    await worker.start();
    writeFileSync('/ready', 'ready');
    while (!stopped) {
      await client.connect(token);
      await store.heartbeat(token);
      const operation = await store.next(metadata.nodeId);
      if (operation) {
        const row = await store.intent(metadata.nodeId, operation);
        let preparation = null;
        if (
          row.kind === 'apply' &&
          (await client.inspect(token, operation)) === 'not_started'
        ) {
          if (
            row.snapshot.extensions.some(
              (entry) => entry.administrativeStatus === 'enabled',
            ) ||
            row.snapshot.trunks.some((entry) => entry.settings.credential)
          )
            preparation = { failure: 'material_denied' };
          else
            preparation = {
              material: { endpoints: new Map(), trunks: new Map() },
            };
        }
        await client.execute(token, operation, preparation);
      }
      await delay(250);
    }
  } finally {
    clearInterval(timer);
    await driver.drain();
    await server.close();
    await worker.stop();
    await ownership.release(token);
    await ownership.close();
    await store.close();
  }
}
void main().catch(() => {
  console.error(
    JSON.stringify({
      fixture: 'live-browser-owner',
      state: 'failed',
      failureCode: 'fixture_failed',
    }),
  );
  process.exit(1);
});
