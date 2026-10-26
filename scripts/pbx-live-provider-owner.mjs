// Protected actual consumer -> private native socket -> disposable real Asterisk.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/owner-executor.js',
);
const { LiveOwnerExecutor } = load('./owner-executor.js');
const { LiveMaterialResolver } = load('./material-resolver.js');
const { ExactLiveMaterialConsumer } = load('./exact-material.js');
const { liveConfiguration } = load('./configuration.js');
const { NativeOwnerClient } = load('./native-transport.js');
const { LiveExecutionStore } = load('./execution-store.js');
const { ObservationRepository } = load('../db/observation-repository.js');
const { observationSettings } = load('../../domain/observation-settings.js');
const { InventoryRuntime } = load('../db/inventory-runtime.js');
const { TransactionAuthority } = load(
  '../../../identity/application/transaction-authority.js',
);
const { PlatformAuthorityRepository } = load(
  '../../../platform/adapters/db/authority-read.js',
);
const m = JSON.parse(process.argv[2]);
const config = liveConfiguration(
  '/run/pbx-live-consumer/configuration.json',
  true,
);
assert.equal(m.installationId, config.installationId);
assert.match(m.database, /^myims_session_[a-f0-9]{12}$/);
const executor = new URL(config.database);
executor.pathname = '/' + m.database;
const runtime = new URL(executor.href);
runtime.username = 'myims_runtime';
runtime.password = readFileSync('/input/runtime.password', 'utf8').trim();
const store = new LiveExecutionStore(executor.href);
const ownership = new ObservationRepository(
  runtime.href,
  observationSettings(),
);
const http = new InventoryRuntime(
  runtime.href,
  new TransactionAuthority(
    { lockedById: async () => ({ kind: 'denied' }) },
    new PlatformAuthorityRepository(store.database),
  ),
);
const consumer = new ExactLiveMaterialConsumer({
  installationId: m.installationId,
  endpoint: 'https://endpoint-secrets:8200',
  tokenFile: config.providerTokenFile,
  caFile: config.providerCaFile,
});
const resolver = new LiveMaterialResolver(store.pool, consumer);
let resolutions = 0,
  interruption = null;
const owner = new LiveOwnerExecutor(
  m.installationId,
  m.nodeId,
  store,
  {
    resolve: async (...args) => {
      resolutions++;
      if (interruption === 'before') {
        interruption = null;
        stop.abort();
        throw new Error('Owned consumer interruption before exact read');
      }
      const material = await resolver.resolve(...args);
      if (interruption === 'after') {
        interruption = null;
        stop.abort();
      }
      return material;
    },
  },
  new NativeOwnerClient('/run/pbx-live/native.sock'),
);
const principal = {
  plane: 'platform',
  operatorId: m.operatorId,
  authenticationVersion: 1,
  grants: ['platform_operator'],
};
let token = await ownership.acquire(m.nodeId, randomUUID());
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
let stop = new globalThis.AbortController();
let loop = owner.run(
  { id: m.nodeId, installationId: m.installationId },
  () => token,
  stop.signal,
);
async function until(query, passed) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const value = await query();
    if (passed(value)) return value;
    await delay(100);
  }
  throw new Error('Owned protected native acceptance deadline');
}
async function runtimeState() {
  return (
    await store.pool.query(
      'SELECT * FROM public.pbx_live_runtime WHERE node_id=$1',
      [m.nodeId],
    )
  ).rows[0];
}
try {
  const baseline = await until(
    runtimeState,
    (row) => row?.baseline_verified_at,
  );
  let trunk = (
    await http.pool.query(
      'SELECT id,name,direction,settings,version FROM public.sip_trunks WHERE node_id=$1',
      [m.nodeId],
    )
  ).rows[0];
  const revisions = [];
  for (const version of [1, 2]) {
    const edit = await http.peers.write(
      principal,
      'trunks',
      m.nodeId,
      trunk.id,
      'edit',
      {
        expectedVersion: trunk.version,
        name: trunk.name,
        direction: trunk.direction,
        settings: {
          ...trunk.settings,
          credential: { ...trunk.settings.credential, version },
        },
      },
      randomUUID(),
    );
    assert.equal(edit.status, 200, JSON.stringify(edit));
    trunk = (
      await http.pool.query(
        'SELECT id,name,direction,settings,version FROM public.sip_trunks WHERE id=$1',
        [trunk.id],
      )
    ).rows[0];
    const capture = await http.revisions.write(
      principal,
      m.nodeId,
      null,
      { requestId: randomUUID() },
      randomUUID(),
    );
    assert.equal(capture.status, 201);
    const revision = capture.value.revision;
    const validated = await http.revisions.write(
      principal,
      m.nodeId,
      revision.id,
      {},
      randomUUID(),
    );
    assert.equal(
      validated.value.validation.local,
      'passed',
      JSON.stringify(validated),
    );
    const live = await runtimeState();
    interruption = version === 1 ? 'before' : 'after';
    const interruptedAt = interruption;
    const accepted = await http.live.accept(
      principal,
      m.nodeId,
      'apply',
      {
        requestId: randomUUID(),
        revisionId: revision.id,
        expectedBaselineId: live.verified_id,
      },
      randomUUID(),
    );
    assert.equal(accepted.status, 202, JSON.stringify(accepted));
    const mutations = await Promise.all([
      http.peers.write(
        principal,
        'trunks',
        m.nodeId,
        trunk.id,
        'remove',
        { expectedVersion: trunk.version },
        randomUUID(),
      ),
      http.peers.write(
        principal,
        'trunks',
        m.nodeId,
        trunk.id,
        'edit',
        {
          expectedVersion: trunk.version,
          name: trunk.name,
          direction: trunk.direction,
          settings: { ...trunk.settings, host: '127.0.0.2' },
        },
        randomUUID(),
      ),
    ]);
    assert.ok(mutations.every((result) => result.status === 409));

    await until(
      async () => stop.signal.aborted,
      (value) => value,
    );
    await loop;
    assert.equal((await runtimeState()).verified_id, live.verified_id);
    assert.equal(
      (await runtimeState()).active_operation_id,
      accepted.value.operation.id,
    );
    assert.equal(
      (await store.intent(m.nodeId, accepted.value.operation.id)).state,
      'queued',
    );
    const previous = token;
    await ownership.release(token);
    token = await ownership.acquire(m.nodeId, randomUUID());
    assert.ok(token);
    assert.ok(BigInt(token.epoch) > BigInt(previous.epoch));
    stop = new globalThis.AbortController();
    loop = owner.run(
      { id: m.nodeId, installationId: m.installationId },
      () => token,
      stop.signal,
    );
    console.log(
      'PASS protected consumer interruption ' +
        JSON.stringify({
          boundary: interruptedAt,
          version,
          operationId: accepted.value.operation.id,
          revisionId: revision.id,
          previousEpoch: previous.epoch,
          successorEpoch: token.epoch,
          observed:
            'accepted intent retained, no installation before successor',
        }),
    );

    await until(
      runtimeState,
      (row) =>
        row?.active_operation_id === null &&
        row.verified_id === revision.id &&
        row.runtime_state === 'verified',
    );
    revisions.push(revision.id);
  }
  const retained = (
    await store.pool.query(
      "SELECT DISTINCT material_version FROM public.pbx_live_pins WHERE revision_id=ANY($1::uuid[]) AND kind='credentials' AND released_at IS NULL ORDER BY material_version",
      [revisions],
    )
  ).rows.map((row) => row.material_version);
  assert.deepEqual(retained, [1, 2]);
  const before = resolutions;
  const recovery = await http.live.accept(
    principal,
    m.nodeId,
    'recover',
    {
      requestId: randomUUID(),
      targetId: revisions[0],
      expectedBaselineId: revisions[1],
    },
    randomUUID(),
  );
  assert.equal(recovery.status, 202);
  await until(
    runtimeState,
    (row) =>
      row?.active_operation_id === null &&
      row.verified_id === revisions[0] &&
      row.runtime_state === 'verified',
  );
  assert.equal(
    resolutions,
    before,
    'rollback must use the retained exact protected artifact without reading latest/provider',
  );
  assert.notEqual(baseline.verified_id, revisions[0]);
  for (const [operation, input] of [
    ['remove', { expectedVersion: trunk.version }],
    [
      'edit',
      {
        expectedVersion: trunk.version,
        name: trunk.name,
        direction: trunk.direction,
        settings: { ...trunk.settings, host: '127.0.0.2' },
      },
    ],
  ]) {
    const blocked = await http.peers.write(
      principal,
      'trunks',
      m.nodeId,
      trunk.id,
      operation,
      input,
      randomUUID(),
    );
    assert.equal(blocked.status, 409);
    assert.equal(blocked.value.reason, 'referenced');
  }
  console.log(
    'PASS real provider/native: private GET-only consumer resolves existing canonical versions 1 then 2 through the actual renewed owner loop and private socket; actual Asterisk independently verifies loaded exact auth after both applies; older pins survive replacement, explicit rollback verifies retained version 1 without another provider resolution, and actual known-good pins block resource removal/structural edits; no provider writes, token in PBX, registration or calls',
  );
} finally {
  stop.abort();
  await loop;
  clearInterval(timer);
  await ownership.release(token).catch(() => {});
  await ownership.close();
  await http.onApplicationShutdown();
  await store.close();
}
