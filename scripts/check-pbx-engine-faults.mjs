// Synthetic adapters and owner ports test limits/cancellation, not live PBX access.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { ObservationEngine } = backend(
  './dist/modules/telephony/application/observation-engine.js',
);
const { observationSettings, developmentObservationSettings } = backend(
  './dist/modules/telephony/domain/observation-settings.js',
);
export async function checkEngineFaults() {
  const settings = observationSettings({
    ...developmentObservationSettings,
    leaseMs: 150,
    renewMs: 30,
    databaseMs: 10,
    snapshotMs: 80,
    ioMs: 20,
    cadenceMs: 10,
    freshnessMs: 100,
    drainMs: 100,
    retryMaxMs: 20,
    rotationMs: 30,
  });
  const targets = Array.from({ length: 6 }, (_, i) => ({
    id: randomUUID(),
    version: 1,
    installationId: randomUUID(),
    targetAlias: `synthetic-${i}`,
    credentialAlias: 'synthetic-observer',
  }));
  const owners = new Map(),
    published = new Map(),
    failures = new Map();
  let active = 0,
    maximum = 0,
    renewLoss = false;
  const store = {
    async discover() {
      return targets;
    },
    async acquire(nodeId, incarnation) {
      if (owners.has(nodeId)) return null;
      const token = { nodeId, incarnation, epoch: '1', desiredVersion: 1 };
      owners.set(nodeId, token);
      return token;
    },
    async renew(token) {
      if (renewLoss) throw new Error('Injected response loss');
      return owners.get(token.nodeId) ?? null;
    },
    async release(token) {
      owners.delete(token.nodeId);
      return true;
    },
    async verify(token) {
      return owners.has(token.nodeId);
    },
    async publish(token, sequence, registrations) {
      published.set(token.nodeId, { sequence, registrations });
      return owners.has(token.nodeId);
    },
    async fail(token, failure) {
      failures.set(token.nodeId, failure);
      return owners.has(token.nodeId);
    },
  };
  const catalog = {
    resolve(alias) {
      return targets.find((t) => t.targetAlias === alias);
    },
  };
  const adapter = {
    async open(profile) {
      if (profile.targetAlias === 'synthetic-0')
        return { kind: 'failed', failure: 'secret_unavailable' };
      let closed = false;
      const ending = new globalThis.AbortController();
      active++;
      maximum = Math.max(maximum, active);
      return {
        kind: 'connected',
        session: {
          ended: ending.signal,
          async snapshot(signal) {
            if (closed) return { kind: 'failed', failure: 'disconnected' };
            await delay(1, undefined, { signal });
            return { kind: 'complete', registrations: [] };
          },
          close() {
            if (!closed) {
              closed = true;
              ending.abort();
              active--;
            }
          },
        },
      };
    },
  };
  const engine = new ObservationEngine(store, catalog, adapter, settings);
  await engine.start();
  await delay(60);
  assert.equal(owners.size, 4);
  assert.ok(published.size >= 3);
  assert.equal(failures.get(targets[0].id), 'secret_unavailable');
  assert.ok(maximum <= 4);
  assert.equal(
    failures.get(targets[1].id),
    'disconnected',
    'Forced rotation requires reconciliation',
  );
  renewLoss = true;
  await delay(65);
  assert.equal(active, 0);
  assert.equal(owners.size, 0);
  const count = published.size;
  await engine.stop();
  assert.equal(published.size, count);
  assert.equal(active, 0);
  let staleOpened = 0,
    stalePublished = 0,
    staleReleased = 0;
  const staleStore = {
    ...store,
    async discover() {
      return [targets[0]];
    },
    async acquire(nodeId, incarnation) {
      return { nodeId, incarnation, epoch: '2', desiredVersion: 2 };
    },
    async release() {
      staleReleased++;
      return true;
    },
    async publish() {
      stalePublished++;
      return true;
    },
  };
  const staleAdapter = {
    async open() {
      staleOpened++;
      return { kind: 'failed', failure: 'connect_failed' };
    },
  };
  const raced = new ObservationEngine(
    staleStore,
    catalog,
    staleAdapter,
    settings,
  );
  await raced.start();
  await delay(10);
  await raced.stop();
  assert.equal(staleOpened, 0);
  assert.equal(stalePublished, 0);
  assert.equal(staleReleased, 1);
  console.log(
    'PASS B-05/B-08 synthetic engine: per-node secret failure isolation, at most four owners/sessions, renewal uncertainty cancels every connection, bounded shutdown and no post-loss publication.',
  );
}
