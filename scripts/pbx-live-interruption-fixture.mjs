// Trusted acceptance child only: abrupt process loss around real native effects.
// Run under the same lifetime flock as production; no HTTP fault controls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
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
const metadata = JSON.parse(readFileSync('/input/integration.json', 'utf8'));
const [mode, kind, point] = process.argv.slice(2);
assert.ok(['interrupt', 'resume'].includes(mode));
assert.ok(['apply', 'recover'].includes(kind));
const connection = (user, file) => {
  const url = new URL(
    `postgresql://${user}@postgres:5432/${metadata.database}`,
  );
  url.password = readFileSync(file, 'utf8').trim();
  return url.href;
};
const runtimeUrl = connection('myims_runtime', '/input/runtime.password');
const store = new LiveExecutionStore(
  connection('myims_pbx_executor', '/input/executor.password'),
);
const ownership = new ObservationRepository(runtimeUrl, observationSettings());
const http = new InventoryRuntime(
  runtimeUrl,
  new TransactionAuthority(
    { lockedById: async () => ({ kind: 'denied' }) },
    new PlatformAuthorityRepository(store.database),
  ),
);
const principal = {
  plane: 'platform',
  operatorId: metadata.operatorId,
  authenticationVersion: (
    await store.pool.query(
      'SELECT authentication_version FROM public.platform_operators WHERE id=$1',
      [metadata.operatorId],
    )
  ).rows[0].authentication_version,
  grants: ['platform_operator'],
};
const root = `/var/lib/myims-pbx/control/${metadata.nodeId}`;
const artifacts = new ProtectedArtifactStore(
  root + '/staging',
  metadata.installationId,
  metadata.nodeId,
);
const barrier = new NativeAdmissionBarrier(['127.0.0.1']);
const driver = new NativePbxDriver(
  root,
  '/var/lib/myims-pbx/managed',
  artifacts,
  barrier,
);
const probes = new NativeDenyProbes(artifacts);
const native = new NativeLiveApplication(
  root,
  metadata.nodeId,
  metadata.installationId,
  store,
  artifacts,
  driver,
  barrier,
  probes,
);
let token;
const deadline = Date.now() + 25000;
while (!token && Date.now() < deadline) {
  token = await ownership.acquire(metadata.nodeId, randomUUID());
  if (!token) await delay(100);
}
assert.ok(token, 'successor must acquire the actual expired lease');
let renewing = false;
const timer = setInterval(async () => {
  if (renewing) return;
  renewing = true;
  try {
    token = (await ownership.renew(token)) ?? token;
  } finally {
    renewing = false;
  }
}, 1000);
const material = { material: { endpoints: new Map(), trunks: new Map() } };
const factsPath = '/interruption.json';
const effectsPath = '/interruption-effects.jsonl';
const runtime = async () =>
  (
    await store.pool.query(
      'SELECT * FROM public.pbx_live_runtime WHERE node_id=$1',
      [metadata.nodeId],
    )
  ).rows[0];
async function capture() {
  const response = await http.revisions.write(
    principal,
    metadata.nodeId,
    null,
    { requestId: randomUUID() },
    randomUUID(),
  );
  assert.equal(response.status, 201);
  const revision = response.value.revision;
  const validation = await http.revisions.write(
    principal,
    metadata.nodeId,
    revision.id,
    {},
    randomUUID(),
  );
  assert.equal(validation.value.validation.local, 'passed');
  return revision.id;
}
async function accept(action, target, baseline) {
  const body = {
    requestId: randomUUID(),
    expectedBaselineId: baseline,
    ...(action === 'apply' ? { revisionId: target } : { targetId: target }),
  };
  const result = await http.live.accept(
    principal,
    metadata.nodeId,
    action,
    body,
    randomUUID(),
  );
  assert.equal(result.status, 202, JSON.stringify(result));
  return result.value.operation.id;
}
function countEffect(name) {
  appendFileSync(effectsPath, JSON.stringify({ name }) + '\n', { mode: 0o600 });
}
try {
  await native.connect(token);
  if (mode === 'interrupt') {
    const initial = (
      await store.pool.query(
        'SELECT id FROM public.pbx_live_artifacts WHERE node_id=$1 AND initial_baseline',
        [metadata.nodeId],
      )
    ).rows[0].id;
    if (kind === 'recover') {
      const candidate = await capture();
      const setup = await accept(
        'apply',
        candidate,
        (await runtime()).verified_id,
      );
      await native.execute(token, setup, material);
      assert.equal((await runtime()).verified_id, candidate);
    }
    const before = await runtime();
    const target = kind === 'apply' ? await capture() : initial;
    const operationId = await accept(kind, target, before.verified_id);
    const facts = {
      kind,
      point,
      operationId,
      target,
      baseline: before.verified_id,
      initial,
      epoch: token.epoch,
    };
    writeFileSync(factsPath, JSON.stringify(facts), { mode: 0o600 });
    writeFileSync(effectsPath, '', { mode: 0o600 });
    const crash = (name) => {
      if (name !== point) return;
      // Exit bypasses every catch/finally and leaves the real SQL lease to expire.
      console.log(
        'INTERRUPTED ' + JSON.stringify({ ...facts, boundary: name }),
      );
      process.exit(73);
    };
    const wrapAsync = (object, method, name) => {
      const original = object[method].bind(object);
      object[method] = async (...args) => {
        crash(name + '-before');
        if (['reload', 'verify'].includes(name)) countEffect(name);
        const pending = original(...args);
        if (name === 'verify') crash('verify-during');
        const result = await pending;
        crash(name + '-after');
        return result;
      };
    };
    const wrapSync = (object, method, name) => {
      const original = object[method].bind(object);
      object[method] = (...args) => {
        crash(name + '-before');
        if (name === 'select') countEffect(name);
        const result = original(...args);
        crash(name + '-after');
        return result;
      };
    };
    wrapSync(artifacts, 'stage', 'stage');
    wrapSync(driver, 'select', 'select');
    wrapAsync(driver, 'validate', 'validate');
    wrapAsync(driver, 'reload', 'reload');
    wrapAsync(probes, 'verify', 'verify');
    wrapAsync(store, 'finish', 'commit');
    await native.execute(
      token,
      operationId,
      kind === 'apply' ? material : null,
    );
    throw new Error('Required interruption boundary was not reached');
  }
  const facts = JSON.parse(readFileSync(factsPath, 'utf8'));
  assert.equal(facts.kind, kind);
  assert.equal(facts.point, point);
  assert.ok(BigInt(token.epoch) > BigInt(facts.epoch));
  const events = () =>
    readFileSync(effectsPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line).name);
  let selections = 0,
    reloads = 0;
  const select = driver.select.bind(driver),
    reload = driver.reload.bind(driver);
  driver.select = (...args) => {
    selections++;
    return select(...args);
  };
  driver.reload = async (...args) => {
    reloads++;
    return reload(...args);
  };
  const inspection = await native.inspect(token, facts.operationId);
  await native.execute(
    token,
    facts.operationId,
    inspection === 'not_started' && kind === 'apply' ? material : null,
  );
  let row = await store.intent(metadata.nodeId, facts.operationId);
  if (inspection !== 'not_started') {
    assert.equal(
      selections,
      0,
      'interrupted admitted selection must never replay',
    );
    assert.equal(reloads, 0, 'interrupted admitted reload must never replay');
  }
  assert.ok(
    ['verified', 'recovered', 'unknown'].includes(row.state),
    row.state,
  );
  let reconciliationOperationId = null;
  if (row.state === 'unknown') {
    await barrier.assertClosed();
    assert.equal((await runtime()).active_operation_id, facts.operationId);
    assert.ok(
      (
        await store.pool.query(
          'SELECT 1 FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
          [kind === 'apply' ? facts.target : facts.baseline],
        )
      ).rows.length,
    );
    const conflict = await http.live.accept(
      principal,
      metadata.nodeId,
      'apply',
      {
        requestId: randomUUID(),
        revisionId: await capture(),
        expectedBaselineId: facts.baseline,
      },
      randomUUID(),
    );
    assert.equal(conflict.status, 409);
    const reconcile = await accept('reconcile', facts.baseline, facts.baseline);
    reconciliationOperationId = reconcile;
    await native.execute(token, reconcile, null);
    row = await store.intent(metadata.nodeId, reconcile);
    assert.equal(row.state, 'recovered');
  }
  const after = await runtime();
  assert.equal(after.runtime_state, 'verified');
  assert.equal(after.active_operation_id, null);
  assert.equal(after.installed_id, after.verified_id);
  assert.equal(after.known_good_id, after.verified_id);
  assert.ok([facts.target, facts.baseline].includes(after.verified_id));
  // A duplicate after completion is effect-free, even on the successor process.
  const counts = [selections, reloads];
  await native.execute(token, facts.operationId, null);
  assert.deepEqual([selections, reloads], counts);
  console.log(
    'PASS interruption ' +
      JSON.stringify({
        ...facts,
        successorEpoch: token.epoch,
        expected:
          inspection === 'not_started'
            ? 'safe preparation then exact verification'
            : 'exact read-only reconciliation without candidate replay',
        reconciliationOperationId,
        inspection,
        outcome: row.state,
        verifiedId: after.verified_id,
        effectsBeforeLoss: events(),
        successorSelections: selections,
        successorReloads: reloads,
      }),
  );
  if (after.verified_id !== facts.initial) {
    const cleanup = await accept('recover', facts.initial, after.verified_id);
    await native.execute(token, cleanup, null);
  }
  assert.equal((await runtime()).verified_id, facts.initial);
} finally {
  clearInterval(timer);
  await driver.drain();
  await ownership.release(token).catch(() => {});
  await ownership.close();
  await http.onApplicationShutdown();
  await store.close();
}
