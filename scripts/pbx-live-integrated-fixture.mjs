// Actual native PBX + isolated real PostgreSQL, executed under the native flock.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  readFileSync,
  mkdirSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/native-application.js',
);
const { ProtectedArtifactStore } = load('./artifact-store.js');
const { NativeAdmissionBarrier } = load('./admission.js');
const { NativePbxDriver } = load('./native-driver.js');
const { NativeDenyProbes } = load('./native-probes.js');
const { NativeLiveApplication } = load('./native-application.js');
const { NativeOwnerServer, NativeOwnerClient } = load('./native-transport.js');
const { LiveExecutionStore } = load('./execution-store.js');
const { LiveOwnerExecutor } = load('./owner-executor.js');
const { ObservationRepository } = load('../db/observation-repository.js');
const { observationSettings } = load('../../domain/observation-settings.js');
const { InventoryRuntime } = load('../db/inventory-runtime.js');
const { TransactionAuthority } = load(
  '../../../identity/application/transaction-authority.js',
);
const { PlatformAuthorityRepository } = load(
  '../../../platform/adapters/db/authority-read.js',
);
const { DeliveryWorker } = load(
  '../../../../infrastructure/worker/delivery.js',
);
const { parseWorkerConfig } = load('@myims/config');
const metadata = JSON.parse(readFileSync('/input/integration.json', 'utf8'));
const connection = (user, file) => {
  const url = new URL(
    `postgresql://${user}@postgres:5432/${metadata.database}`,
  );
  url.password = readFileSync(file, 'utf8').trim();
  return url.href;
};
const runtimeUrl = connection('myims_runtime', '/input/runtime.password'),
  executorUrl = connection('myims_pbx_executor', '/input/executor.password');
const store = new LiveExecutionStore(executorUrl);
const ownership = new ObservationRepository(runtimeUrl, observationSettings());
const principal = {
  plane: 'platform',
  operatorId: metadata.operatorId,
  authenticationVersion: 1,
  grants: ['platform_operator'],
};
const authority = new TransactionAuthority(
  { lockedById: async () => ({ kind: 'denied' }) },
  new PlatformAuthorityRepository(store.database),
);
const http = new InventoryRuntime(runtimeUrl, authority);
const worker = new DeliveryWorker(
  runtimeUrl,
  parseWorkerConfig({ WORKER_CONCURRENCY: '1', WORKER_POLL_MS: '100' }),
);
const root = `/var/lib/myims-pbx/control/${metadata.nodeId}`;
mkdirSync(root + '/staging', { recursive: true, mode: 0o700 });
const artifacts = new ProtectedArtifactStore(
    root + '/staging',
    metadata.installationId,
    metadata.nodeId,
  ),
  barrier = new NativeAdmissionBarrier(['127.0.0.1']);
const driver = new NativePbxDriver(
  root,
  '/var/lib/myims-pbx/managed',
  artifacts,
  barrier,
);
let proofMode = 'pass',
  rejectRevision = null;
const selectCompleteSet = driver.select.bind(driver);
driver.select = (identity) => {
  if (proofMode === 'install' && identity.revisionId === rejectRevision) {
    // A real filesystem type conflict makes atomic selection fail before it can
    // change the pointer; the intact baseline remains eligible for restoration.
    writeFileSync(
      `/var/lib/myims-pbx/managed/${identity.revisionId}`,
      'owned-fault',
      {
        mode: 0o600,
        flag: 'wx',
      },
    );
  }
  selectCompleteSet(identity);
  if (proofMode === 'candidate' && identity.revisionId === rejectRevision) {
    // Real run-owned post-validation drift: reload the selected extra deny-only
    // context, then let the actual installed/runtime proof detect the mismatch.
    appendFileSync(
      `/var/lib/myims-pbx/managed/${identity.revisionId}/extensions.conf`,
      '\n[ims-owned-verification-fault]\nexten => s,1,Hangup()\n',
    );
  }
};
const independentProbes = new NativeDenyProbes(artifacts);
const native = new NativeLiveApplication(
  root,
  metadata.nodeId,
  metadata.installationId,
  store,
  artifacts,
  driver,
  barrier,
  {
    verify: async (artifact, signal) => {
      if (proofMode === 'all') throw new Error('Owned verification fault');
      await independentProbes.verify(artifact, signal);
    },
  },
);
const server = new NativeOwnerServer(
  '/var/lib/myims-pbx/native-test.sock',
  native,
);
const client = new NativeOwnerClient('/var/lib/myims-pbx/native-test.sock');
let token = await ownership.acquire(metadata.nodeId, randomUUID());
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
try {
  await server.start();
  await client.connect(token);
  const baseline = (
    await store.pool.query(
      'SELECT known_good_id FROM public.pbx_live_runtime WHERE node_id=$1',
      [metadata.nodeId],
    )
  ).rows[0].known_good_id;
  assert.ok(baseline);
  async function capture() {
    const value = await http.revisions.write(
      principal,
      metadata.nodeId,
      null,
      { requestId: randomUUID() },
      randomUUID(),
    );
    assert.equal(value.status, 201);
    const revision = value.value.revision;
    assert.equal(
      (
        await http.revisions.write(
          principal,
          metadata.nodeId,
          revision.id,
          {},
          randomUUID(),
        )
      ).value.validation.local,
      'passed',
    );
    return revision;
  }
  async function accept(kind, body) {
    const value = await http.live.accept(
      principal,
      metadata.nodeId,
      kind,
      { requestId: randomUUID(), ...body },
      randomUUID(),
    );
    assert.equal(value.status, 202, JSON.stringify(value));
    return value.value.operation;
  }
  async function delivered(id) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const row = await store.intent(metadata.nodeId, id);
      const receipt = (
        await store.pool.query(
          'SELECT delivered_at FROM public.pbx_live_progress WHERE operation_id=$1',
          [id],
        )
      ).rows[0];
      if (row && receipt?.delivered_at) return row;
      await delay(50);
    }
    throw new Error('Actual worker delivery deadline');
  }
  async function finished(id, state) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const row = (
        await store.pool.query(
          'SELECT state FROM public.pbx_live_progress WHERE operation_id=$1',
          [id],
        )
      ).rows[0];
      if (row?.state === state) return;
      await delay(50);
    }
    throw new Error('Native durable outcome deadline');
  }
  const revision = await capture();
  const apply = await accept('apply', {
    revisionId: revision.id,
    expectedBaselineId: baseline,
  });
  assert.equal(await store.next(metadata.nodeId), apply.id);
  assert.equal(
    (
      await store.pool.query(
        'SELECT delivered_at FROM public.pbx_live_progress WHERE operation_id=$1',
        [apply.id],
      )
    ).rows[0].delivered_at,
    null,
  );
  const owner = new LiveOwnerExecutor(
    metadata.installationId,
    metadata.nodeId,
    store,
    { resolve: async () => ({ endpoints: new Map(), trunks: new Map() }) },
    client,
  );
  const ownerStop = new globalThis.AbortController();
  const ownerLoop = owner.run(
    { id: metadata.nodeId, installationId: metadata.installationId },
    () => token,
    ownerStop.signal,
  );
  try {
    await finished(apply.id, 'verified');
  } finally {
    ownerStop.abort();
    await ownerLoop;
  }
  const beforeNotification = (
    await store.pool.query(
      'SELECT attempt FROM public.pbx_live_progress WHERE operation_id=$1',
      [apply.id],
    )
  ).rows[0].attempt;
  await worker.start();
  await delivered(apply.id);
  assert.equal(
    (
      await store.pool.query(
        'SELECT attempt FROM public.pbx_live_progress WHERE operation_id=$1',
        [apply.id],
      )
    ).rows[0].attempt,
    beforeNotification,
  );
  assert.equal(await client.inspect(token, apply.id), 'complete');
  console.log(
    'PASS integrated delivery outage: the actual fenced owner completes committed intent while the ordinary worker is stopped; late real worker notification records delivery without repeating native effects',
  );
  assert.equal(
    (
      await store.pool.query(
        'SELECT verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
        [metadata.nodeId],
      )
    ).rows[0].verified_id,
    revision.id,
  );
  await client.execute(token, apply.id, {
    material: { endpoints: new Map(), trunks: new Map() },
  });
  await delay(100);
  const recovery = await accept('recover', {
    targetId: baseline,
    expectedBaselineId: revision.id,
  });
  await delivered(recovery.id);
  await client.execute(token, recovery.id, null);
  await finished(recovery.id, 'recovered');
  assert.equal(
    (
      await store.pool.query(
        'SELECT verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
        [metadata.nodeId],
      )
    ).rows[0].verified_id,
    baseline,
  );
  const revokedRevision = await capture();
  const revokedOperation = await accept('apply', {
    revisionId: revokedRevision.id,
    expectedBaselineId: baseline,
  });
  await delivered(revokedOperation.id);
  const begin = barrier.begin.bind(barrier),
    select = driver.select.bind(driver);
  let selections = 0;
  driver.select = (identity) => {
    selections++;
    return select(identity);
  };
  barrier.begin = async (...args) => {
    await begin(...args);
    await http.pool.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
      [metadata.operatorId],
    );
  };
  await client.execute(token, revokedOperation.id, {
    material: { endpoints: new Map(), trunks: new Map() },
  });
  await finished(revokedOperation.id, 'revoked');
  assert.equal(
    selections,
    0,
    'authority revoked while waiting must reject before physical selection',
  );
  assert.equal(
    (
      await store.pool.query(
        'SELECT verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
        [metadata.nodeId],
      )
    ).rows[0].verified_id,
    baseline,
  );
  barrier.begin = begin;
  driver.select = select;
  principal.authenticationVersion = (
    await http.pool.query(
      "UPDATE public.platform_operators SET status='active',version=version+1,authentication_version=authentication_version+1 WHERE id=$1 RETURNING authentication_version",
      [metadata.operatorId],
    )
  ).rows[0].authentication_version;
  console.log(
    'PASS integrated authority: canonical account revocation after actual admission/drain rejects accepted intent before any selection; prior verified runtime survives and the unchanged gate reopens',
  );
  const installRevision = await capture();
  rejectRevision = installRevision.id;
  proofMode = 'install';
  const installFailure = await accept('apply', {
    revisionId: installRevision.id,
    expectedBaselineId: baseline,
  });
  await delivered(installFailure.id);
  await client.execute(token, installFailure.id, {
    material: { endpoints: new Map(), trunks: new Map() },
  });
  await finished(installFailure.id, 'recovered');
  const installPhase = (
    await store.pool.query(
      'SELECT installation,verification,recovery,failure FROM public.pbx_live_progress WHERE operation_id=$1',
      [installFailure.id],
    )
  ).rows[0];
  assert.equal(installPhase.installation, 'failed');
  assert.equal(installPhase.verification, 'pending');
  assert.equal(installPhase.recovery, 'passed');
  assert.equal(installPhase.failure, 'install_failed');
  console.log(
    'PASS integrated install failure: actual filesystem selection conflict leaves candidate installation failed and candidate verification pending while independent baseline recovery passes',
  );
  const failedRevision = await capture();
  rejectRevision = failedRevision.id;
  proofMode = 'candidate';
  const auto = await accept('apply', {
    revisionId: failedRevision.id,
    expectedBaselineId: baseline,
  });
  await delivered(auto.id);
  await client.execute(token, auto.id, {
    material: { endpoints: new Map(), trunks: new Map() },
  });
  await finished(auto.id, 'recovered');
  const failedPhase = (
    await store.pool.query(
      'SELECT verification,recovery,failure FROM public.pbx_live_progress WHERE operation_id=$1',
      [auto.id],
    )
  ).rows[0];
  assert.equal(failedPhase.verification, 'failed');
  assert.equal(failedPhase.recovery, 'passed');
  assert.equal(failedPhase.failure, 'verification_failed');
  const unknownRevision = await capture();
  proofMode = 'all';
  const uncertain = await accept('apply', {
    revisionId: unknownRevision.id,
    expectedBaselineId: baseline,
  });
  await delivered(uncertain.id);
  await client.execute(token, uncertain.id, {
    material: { endpoints: new Map(), trunks: new Map() },
  });
  await finished(uncertain.id, 'unknown');
  await barrier.assertClosed();
  assert.ok(
    (
      await store.pool.query(
        'SELECT 1 FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
        [unknownRevision.id],
      )
    ).rows.length,
  );
  const blocked = await http.live.accept(
    principal,
    metadata.nodeId,
    'apply',
    {
      requestId: randomUUID(),
      revisionId: unknownRevision.id,
      expectedBaselineId: baseline,
    },
    randomUUID(),
  );
  assert.equal(blocked.status, 409);
  assert.equal(blocked.value.reason, 'operation_unresolved');
  proofMode = 'pass';
  const interruptedReconciliation = await accept('reconcile', {
    targetId: baseline,
    expectedBaselineId: baseline,
  });
  const quiet = barrier.quiet.bind(barrier);
  let revokeDuringRecovery = true;
  barrier.quiet = async (...args) => {
    await quiet(...args);
    if (revokeDuringRecovery) {
      revokeDuringRecovery = false;
      await http.pool.query(
        "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
        [metadata.operatorId],
      );
    }
  };
  await client.execute(token, interruptedReconciliation.id, null);
  await finished(interruptedReconciliation.id, 'unknown');
  barrier.quiet = quiet;
  await barrier.assertClosed();
  assert.equal(revokeDuringRecovery, false);
  principal.authenticationVersion = (
    await http.pool.query(
      "UPDATE public.platform_operators SET status='active',version=version+1,authentication_version=authentication_version+1 WHERE id=$1 RETURNING authentication_version",
      [metadata.operatorId],
    )
  ).rows[0].authentication_version;
  const reconcile = await accept('reconcile', {
    targetId: baseline,
    expectedBaselineId: baseline,
  });
  await delivered(reconcile.id);
  await client.execute(token, reconcile.id, null);
  await finished(reconcile.id, 'recovered');
  await finished(interruptedReconciliation.id, 'recovered');
  assert.equal(
    (
      await store.pool.query(
        'SELECT runtime_state,verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
        [metadata.nodeId],
      )
    ).rows[0].verified_id,
    baseline,
  );
  assert.equal(
    (
      await store.pool.query(
        'SELECT state FROM public.pbx_live_progress WHERE operation_id=$1',
        [uncertain.id],
      )
    ).rows[0].state,
    'recovered',
  );
  console.log(
    'PASS integrated recovery: authority revoked after recovery quiet check retains denial; fresh audited retry resolves original pending ancestor and failed reconciliation with recovered canonical history; real selected-file/runtime drift is detected after actual reload and restores the verified initial set with separate failed-candidate/passed-recovery phases; uncertain recovery retains actual barrier/pins, blocks conflicting intent and resolves through explicit audited predecessor reconciliation',
  );
  const sqlLossRevision = await capture();
  const sqlLoss = await accept('apply', {
    revisionId: sqlLossRevision.id,
    expectedBaselineId: baseline,
  });
  const finish = store.finish.bind(store);
  let disconnect = true;
  store.finish = async (...args) => {
    if (disconnect) {
      disconnect = false;
      // Actual loss of this scoped executor connection at the SQL result boundary.
      // This is not a shared-server outage and affects only the owned fixture.
      await store.pool.query('SELECT pg_terminate_backend(pg_backend_pid())');
    }
    return finish(...args);
  };
  try {
    await client.execute(token, sqlLoss.id, {
      material: { endpoints: new Map(), trunks: new Map() },
    });
    await finished(sqlLoss.id, 'unknown');
    assert.equal(
      disconnect,
      false,
      'actual result-commit connection fault must run',
    );
  } finally {
    store.finish = finish;
  }
  assert.equal(await client.inspect(token, sqlLoss.id), 'complete');
  const reloadBefore = driver.reload.bind(driver);
  let replayed = 0;
  driver.reload = async (...args) => {
    replayed++;
    return reloadBefore(...args);
  };
  await client.execute(token, sqlLoss.id, null);
  await finished(sqlLoss.id, 'verified');
  driver.reload = reloadBefore;
  assert.equal(replayed, 0);
  const sqlCleanup = await accept('recover', {
    targetId: baseline,
    expectedBaselineId: sqlLossRevision.id,
  });
  await client.execute(token, sqlCleanup.id, null);
  await finished(sqlCleanup.id, 'recovered');
  console.log(
    'PASS integrated database connection loss: actual scoped executor disconnect before result commit retains physical verified receipt; exact same intent reconciles canonical verification without repeated reload; fixture baseline restored',
  );
  const rejectedRevision = await capture();
  const rejectedMaterial = await accept('apply', {
    revisionId: rejectedRevision.id,
    expectedBaselineId: baseline,
  });
  await client.execute(token, rejectedMaterial.id, {
    failure: 'material_unavailable',
  });
  await finished(rejectedMaterial.id, 'validation_failed');
  assert.equal(
    (
      await store.pool.query(
        'SELECT count(*)::int AS n FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
        [rejectedRevision.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await store.pool.query(
        'SELECT verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
        [metadata.nodeId],
      )
    ).rows[0].verified_id,
    baseline,
  );
  console.log(
    'PASS integrated safe pin release: affirmative never-installed material rejection releases only its revision pins, preserving all retained artifact dependencies and the verified baseline',
  );
  for (const action of ['remove', 'edit']) {
    const created = await http.routing.write(
      principal,
      'reservations',
      metadata.nodeId,
      null,
      'create',
      {
        requestId: randomUUID(),
        name: `Acceptance ${action} protection`,
        purpose: 'Owned native race',
        pattern: {
          kind: 'exact',
          digits: action === 'remove' ? '68021' : '68022',
          minLength: 5,
          maxLength: 5,
        },
      },
      randomUUID(),
    );
    assert.equal(created.status, 201, JSON.stringify(created));
    const resource = created.value.resource;
    const reviewed = await capture();
    const applyRace = () =>
      http.live.accept(
        principal,
        metadata.nodeId,
        'apply',
        {
          requestId: randomUUID(),
          revisionId: reviewed.id,
          expectedBaselineId: baseline,
        },
        randomUUID(),
      );
    const mutationRace = () =>
      http.routing.write(
        principal,
        'reservations',
        metadata.nodeId,
        resource.id,
        action,
        action === 'remove'
          ? { expectedVersion: resource.version }
          : {
              expectedVersion: resource.version,
              name: resource.name,
              purpose: resource.purpose,
              pattern: {
                kind: 'exact',
                digits: '68032',
                minLength: 5,
                maxLength: 5,
              },
            },
        randomUUID(),
      );
    const [accepted, mutation] =
      action === 'remove'
        ? await Promise.all([applyRace(), mutationRace()])
        : (await Promise.all([mutationRace(), applyRace()])).reverse();
    if (accepted.status === 202) {
      assert.equal(mutation.status, 409);
      await client.execute(token, accepted.value.operation.id, {
        material: { endpoints: new Map(), trunks: new Map() },
      });
      await finished(accepted.value.operation.id, 'verified');
      assert.ok(
        (
          await store.pool.query(
            "SELECT 1 FROM public.pbx_live_pins WHERE revision_id=$1 AND kind='reservations' AND resource_id=$2 AND released_at IS NULL",
            [reviewed.id, resource.id],
          )
        ).rows.length,
      );
      const restore = await accept('recover', {
        targetId: baseline,
        expectedBaselineId: reviewed.id,
      });
      await client.execute(token, restore.id, null);
      await finished(restore.id, 'recovered');
    } else {
      assert.equal(accepted.status, 409);
      assert.equal(accepted.value.reason, 'stale_review');
      assert.equal(mutation.status, 200);
      assert.equal(
        (
          await store.pool.query(
            'SELECT count(*)::int AS n FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
            [reviewed.id],
          )
        ).rows[0].n,
        0,
      );
    }
    const retained = JSON.parse(
      readFileSync(`${root}/plans/${baseline}.json`, 'utf8'),
    );
    await driver.verify(
      retained.identity,
      retained.snapshot,
      retained.unmanaged,
    );
    console.log(
      'PASS acceptance resource race ' +
        JSON.stringify({
          phase: 'acceptance',
          action,
          revisionId: reviewed.id,
          resourceId: resource.id,
          operationId: accepted.value.operation?.id ?? null,
          epoch: token.epoch,
          expected:
            'one serialized result: accepted intent pins and blocks mutation, or prior mutation invalidates review without effects',
          observed:
            accepted.status === 202
              ? 'verified intent and blocked mutation; verified baseline restored'
              : 'mutation won, stale acceptance rejected, zero pins and unchanged verified baseline',
          acceptanceStatus: accepted.status,
          mutationStatus: mutation.status,
        }),
    );
  }
  const racingRevision = await capture();
  const competing = await Promise.all([
    http.live.accept(
      principal,
      metadata.nodeId,
      'recover',
      {
        requestId: randomUUID(),
        targetId: baseline,
        expectedBaselineId: baseline,
      },
      randomUUID(),
    ),
    http.live.accept(
      principal,
      metadata.nodeId,
      'apply',
      {
        requestId: randomUUID(),
        revisionId: racingRevision.id,
        expectedBaselineId: baseline,
      },
      randomUUID(),
    ),
  ]);
  assert.deepEqual(competing.map((result) => result.status).sort(), [202, 409]);
  const winner = competing.find((result) => result.status === 202).value
    .operation;
  await client.execute(
    token,
    winner.id,
    winner.kind === 'apply'
      ? { material: { endpoints: new Map(), trunks: new Map() } }
      : null,
  );
  await finished(winner.id, winner.kind === 'apply' ? 'verified' : 'recovered');
  if (winner.kind === 'apply') {
    const cleanup = await accept('recover', {
      targetId: baseline,
      expectedBaselineId: racingRevision.id,
    });
    await client.execute(token, cleanup.id, null);
    await finished(cleanup.id, 'recovered');
  }
  console.log(
    'PASS integrated competing recovery/apply: actual concurrent canonical intents admit exactly one ordered operation; the loser conflicts, native winner verifies, baseline restored',
  );
  const previous = { ...token };
  clearInterval(timer);
  await ownership.release(token);
  token = await ownership.acquire(metadata.nodeId, randomUUID());
  assert.ok(token);
  assert.ok(BigInt(token.epoch) > BigInt(previous.epoch));
  await client.connect(token);
  await assert.rejects(client.inspect(previous, apply.id));
  const state = await client.inspect(token, apply.id);
  assert.equal(state, 'complete');
  const phase = (
    await store.pool.query(
      'SELECT state,validation,installation,verification,recovery FROM public.pbx_live_progress WHERE operation_id=$1',
      [recovery.id],
    )
  ).rows[0];
  assert.equal(phase.verification, 'passed');
  assert.equal(phase.recovery, 'passed');
  console.log(
    'PASS integrated native: real scoped executor/SQL owner, immutable reviewed intent, actual ordinary-worker delivery, private socket execution, independently captured initial baseline, actual complete-set install/reload/verify, explicit verified recovery, duplicate suppression and real canonical takeover/stale-owner rejection',
  );
} finally {
  clearInterval(timer);
  await driver.drain();
  await server.close();
  await worker.stop().catch(() => {});
  await ownership.release(token).catch(() => {});
  await ownership.close();
  await http.onApplicationShutdown();
  await store.close();
}
