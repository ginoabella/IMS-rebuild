// Actual disposable Asterisk, PostgreSQL and ordinary durable worker. No simulated calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { checkTenantRoutingTransfer } from './transfer-fixture.mjs';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/native-application.js',
);
const { ProtectedArtifactStore } = load('./artifact-store.js');
const { NativeAdmissionBarrier } = load('./admission.js');
const { NativePbxDriver } = load('./native-driver.js');
const { NativeLiveApplication } = load('./native-application.js');
const { NativeDenyProbes } = load('./native-probes.js');
const { NativeOwnerServer, NativeOwnerClient } = load('./native-transport.js');
const { TenantAdmissionServer, TenantCallAdmission } = load(
  './tenant-admission.js',
);
const { ControlledSipCall } = load('./controlled-sip.js');
let callDelay = 0,
  suppressOutcome = false,
  lastCall = null,
  admissionFacts = null,
  callCount = 0;
const controlledRun = ControlledSipCall.prototype.run;
ControlledSipCall.prototype.run = async function (input) {
  callCount++;
  if (callDelay) await delay(callDelay);
  const result = await controlledRun.call(this, input);
  lastCall = result;
  return suppressOutcome ? { ...result, outcome: 'unknown' } : result;
};
const { TenantRuntimeMonitor } = load('./tenant-runtime.js');
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
const { DeliveryWorker } = load(
  '../../../../infrastructure/worker/delivery.js',
);
const { parseWorkerConfig } = load('@myims/config');
const metadata = JSON.parse(readFileSync('/input/integration.json', 'utf8'));
assert.equal(metadata.materialMode, 'synthetic-fixture-endpoints');
const connection = (user, file) => {
  const u = new URL(`postgresql://${user}@postgres:5432/${metadata.database}`);
  u.password = readFileSync(file, 'utf8').trim();
  return u.href;
};
const runtimeUrl = connection('myims_runtime', '/input/runtime.password'),
  executorUrl = connection('myims_pbx_executor', '/input/executor.password');
const store = new LiveExecutionStore(executorUrl),
  ownership = new ObservationRepository(runtimeUrl, observationSettings());
const authority = new TransactionAuthority(
  { lockedById: async () => ({ kind: 'denied' }) },
  new PlatformAuthorityRepository(store.database),
);
const http = new InventoryRuntime(runtimeUrl, authority),
  p = {
    plane: 'platform',
    operatorId: metadata.operatorId,
    authenticationVersion: 1,
    grants: ['platform_operator'],
  };
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
let validationRejection = null;
const validate = driver.validate.bind(driver);
driver.validate = async (...args) => {
  try {
    return await validate(...args);
  } catch (e) {
    const names = new Set(),
      configs = new Set();
    for (const directory of readdirSync('/var/lib/myims-pbx/validators').filter(
      (n) => n.startsWith('validate-'),
    )) {
      try {
        const log = readFileSync(
          '/var/lib/myims-pbx/validators/' + directory + '/validator.log',
          'utf8',
        );
        for (const m of log.matchAll(/\b((?:res|app|func)_[a-z0-9_]+\.so)\b/g))
          names.add(m[1]);
        for (const m of log.matchAll(/\b([a-z_]+\.conf)\b/g)) configs.add(m[1]);
      } catch {
        /* No protocol or material diagnostics. */
      }
    }
    validationRejection = {
      code: e.code,
      reason: e.reason,
      modules: [...names].slice(0, 16),
      configurations: [...configs].slice(0, 16),
    };
    throw e;
  }
};
const native = new NativeLiveApplication(
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
    '/var/lib/myims-pbx/native-test.sock',
    native,
  ),
  client = new NativeOwnerClient('/var/lib/myims-pbx/native-test.sock');
const gid = Number(
  readFileSync('/etc/group', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('asterisk:'))
    ?.split(':')[2],
);
const admissionService = new TenantCallAdmission(store, metadata.nodeId);
const admit = admissionService.admit.bind(admissionService);
admissionService.admit = async (input) => {
  const result = await admit(input);
  admissionFacts = {
    permitted: result,
    endpointPresent:
      typeof input.endpoint === 'string' && input.endpoint.length > 0,
    numberPresent: typeof input.number === 'string' && input.number.length > 0,
    noncePresent: typeof input.nonce === 'string' && input.nonce.length === 64,
  };
  return result;
};
const admission = new TenantAdmissionServer(admissionService, gid);
const monitor = new TenantRuntimeMonitor(
  root,
  metadata.nodeId,
  metadata.installationId,
  store,
  driver,
  barrier,
  artifacts,
  (id, action) => native.maintain(id, action),
);
let token = await ownership.acquire(metadata.nodeId, randomUUID());
assert.ok(token);
let renewing = false,
  renewalPaused = false;
const timer = setInterval(async () => {
  if (renewing || renewalPaused) return;
  renewing = true;
  try {
    const next = await ownership.renew(token);
    if (next) {
      token = next;
      await store.heartbeat(token);
    }
  } finally {
    renewing = false;
  }
}, 1000);
const expect = (r, status) => {
  assert.equal(r.status, status, JSON.stringify(r));
  return r.value;
};
async function addCase(values) {
  const requestId = randomUUID();
  writeFileSync(
    '/tmp/myims-routing-case-request.pending',
    JSON.stringify({
      requestId,
      nodeId: metadata.nodeId,
      readinessRequired: false,
      expectedDestinationId: null,
      expectedOutcome: 'denied',
      ...values,
    }),
    { mode: 0o600 },
  );
  renameSync(
    '/tmp/myims-routing-case-request.pending',
    '/tmp/myims-routing-case-request.json',
  );
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    try {
      const result = JSON.parse(
        readFileSync('/tmp/myims-routing-case-response.json', 'utf8'),
      );
      if (result.requestId === requestId) return result.caseId;
    } catch {
      /* Coordinator has not replied yet. */
    }
    await delay(100);
  }
  throw new Error('Owned case coordinator deadline');
}
async function finished(operationId, expected) {
  const deadline = Date.now() + 45000;
  let last;
  while (Date.now() < deadline) {
    last = await store.intent(metadata.nodeId, operationId);
    if (last?.state === expected) return last;
    if (
      ['failed', 'unknown', 'revoked', 'validation_failed'].includes(
        last?.state,
      )
    )
      throw new Error(
        'Native terminal result ' +
          JSON.stringify({
            state: last.state,
            failure: last.failure,
            validationRejection,
          }),
      );
    await delay(100);
  }
  throw new Error(
    'Native completion deadline ' +
      JSON.stringify({ state: last?.state, failure: last?.failure }),
  );
}
const material = {
  endpoints: new Map(
    metadata.extensions.map((e) => [
      e.generationId,
      { password: randomBytes(32).toString('hex') },
    ]),
  ),
  trunks: new Map(),
};
let baseline, applied;
try {
  await server.start();
  await admission.start();
  await client.connect(token);
  await worker.start();
  baseline = (
    await store.pool.query(
      'SELECT known_good_id FROM public.pbx_live_runtime WHERE node_id=$1',
      [metadata.nodeId],
    )
  ).rows[0].known_good_id;
  const revision = expect(
    await http.revisions.write(
      p,
      metadata.nodeId,
      null,
      { requestId: randomUUID() },
      randomUUID(),
    ),
    201,
  ).revision;
  const validation = expect(
    await http.revisions.write(
      p,
      metadata.nodeId,
      revision.id,
      {},
      randomUUID(),
    ),
    201,
  ).validation;
  assert.equal(validation.local, 'passed');
  assert.equal(validation.applicable, true);
  const apply = expect(
    await http.live.accept(
      p,
      metadata.nodeId,
      'apply',
      {
        requestId: randomUUID(),
        revisionId: revision.id,
        expectedBaselineId: baseline,
      },
      randomUUID(),
    ),
    202,
  ).operation;
  await client.execute(token, apply.id, { material });
  const applyRow = await finished(apply.id, 'verified');
  assert.equal(
    applyRow.state,
    'verified',
    JSON.stringify({ state: applyRow.state, failure: applyRow.failure }),
  );
  applied = revision.id;
  await monitor.tick();
  console.log(
    'PASS tenant-routing manifest ' +
      JSON.stringify({
        mode: 'actual-private-sip-rtp',
        nodeId: metadata.nodeId,
        installationId: metadata.installationId,
        artifactId: revision.id,
        revisionId: revision.id,
        tenants: metadata.tenants.map((t) => t.id),
        tenantStates: metadata.tenants.map((t) => ({
          id: t.id,
          status: t.status,
          fixtureSeed: t.status === 'active',
        })),
        cases: metadata.cases,
        materialMode: metadata.materialMode,
        sourceExtensionIds: metadata.extensions.map((e) => e.id),
        ingressGatewayId: metadata.gateway.id,
        destinationTrunkId: metadata.trunk.id,
        destinationOwner: 'run-owned-local-sip-fixtures',
        externalCalls: false,
      }),
  );
  const grants = new Map();
  for (const t of metadata.tenants) {
    if (t.status === 'active') {
      grants.set(t.id, null);
      continue;
    }
    const cases = metadata.cases
      .filter((c) => c.tenantId === t.id)
      .map((c) => c.id);
    const body = {
      requestId: randomUUID(),
      artifactId: applied,
      caseIds: cases,
    };
    const first = expect(
      await http.verification.write(
        p,
        t.id,
        metadata.nodeId,
        'grant',
        body,
        randomUUID(),
      ),
      201,
    );
    const replay = expect(
      await http.verification.write(
        p,
        t.id,
        metadata.nodeId,
        'grant',
        body,
        randomUUID(),
      ),
      200,
    );
    assert.equal(replay.id, first.id);
    grants.set(t.id, first.id);
  }
  for (const c of metadata.cases) {
    await monitor.tick();
    const body = {
      requestId: randomUUID(),
      artifactId: applied,
      caseId: c.id,
      grantId: grants.get(c.tenantId),
    };
    const accepted = expect(
      await http.verification.write(
        p,
        c.tenantId,
        metadata.nodeId,
        'test',
        body,
        randomUUID(),
      ),
      202,
    );
    await monitor.tick();
    const result = (
      await store.pool.query(
        'SELECT p.state,r.outcome,r.destination_id FROM public.tenant_route_test_progress p LEFT JOIN public.tenant_route_test_results r ON r.intent_id=p.intent_id WHERE p.intent_id=$1',
        [accepted.id],
      )
    ).rows[0];
    assert.equal(
      result.outcome,
      c.expected,
      JSON.stringify({ case: c, result, lastCall, admissionFacts }),
    );
    assert.equal(
      result.state,
      c.expected === 'permitted' ? 'passed' : 'denied',
    );
    const replay = expect(
      await http.verification.write(
        p,
        c.tenantId,
        metadata.nodeId,
        'test',
        body,
        randomUUID(),
      ),
      200,
    );
    assert.equal(replay.id, accepted.id);
    console.log(
      'PASS tenant-routing actual SIP/RTP case ' +
        JSON.stringify({
          caseId: c.id,
          tenantId: c.tenantId,
          direction: c.direction,
          kind: c.kind ?? 'positive',
          intentId: accepted.id,
          artifactId: applied,
          revisionId: revision.id,
          outcome: result.outcome,
          destinationId: result.destination_id ?? null,
          epoch: token.epoch,
        }),
    );
  }
  for (const t of metadata.tenants) {
    await monitor.tick();
    const view = expect(
      await http.verification.read(p, t.id, metadata.nodeId, {}),
      200,
    );
    assert.equal(view.readiness.state, 'ready', JSON.stringify(view.readiness));
    assert.ok(view.tests.every((test) => test.current));
    const evidence = await http.evidence.snapshot(t.id, metadata.nodeId);
    assert.equal(evidence.provenance.artifactId, applied);
    assert.deepEqual(
      evidence.verifiedExtensions.map((e) => e.extensionId),
      [metadata.extensions[metadata.tenants.indexOf(t)].id],
    );
    assert.equal(evidence.verifiedExtensions[0].permissions.length, 1);
  }
  const own = metadata.tenants[0];
  for (const kind of ['ordinary-draft', 'ambiguous-source', 'expiry']) {
    const caseId = await addCase({
      tenantId: own.id,
      direction: 'outbound',
      routeId: metadata.outbound[0].id,
      sourceId: metadata.extensions[0].id,
      dialled: '5551000',
      kind,
    });
    await monitor.tick();
    const grant = expect(
      await http.verification.write(
        p,
        own.id,
        metadata.nodeId,
        'grant',
        {
          requestId: randomUUID(),
          artifactId: applied,
          caseIds: [caseId],
          lifetimeSeconds: kind === 'expiry' ? 10 : 1800,
        },
        randomUUID(),
      ),
      201,
    );
    const test = expect(
      await http.verification.write(
        p,
        own.id,
        metadata.nodeId,
        'test',
        {
          requestId: randomUUID(),
          artifactId: applied,
          caseId,
          grantId: grant.id,
        },
        randomUUID(),
      ),
      202,
    );
    callDelay = kind === 'expiry' ? 11000 : 0;
    try {
      await monitor.tick();
    } finally {
      callDelay = 0;
    }
    const result = (
      await store.pool.query(
        'SELECT p.state,r.outcome FROM public.tenant_route_test_progress p LEFT JOIN public.tenant_route_test_results r ON r.intent_id=p.intent_id WHERE p.intent_id=$1',
        [test.id],
      )
    ).rows[0];
    assert.equal(
      result.outcome,
      'denied',
      JSON.stringify({ kind, result, lastCall, admissionFacts }),
    );
    assert.equal(result.state, 'denied');
    console.log(
      'PASS tenant-routing actual SIP denial ' +
        JSON.stringify({
          kind,
          caseId,
          intentId: test.id,
          artifactId: applied,
        }),
    );
  }
  await monitor.tick();
  const foreignIngress = await addCase({
    tenantId: own.id,
    direction: 'inbound',
    routeId: metadata.inbound[1].id,
    sourceId: metadata.gateway.id,
    dialled: '5550001',
    kind: 'routing',
  });
  const ingressGrant = expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'grant',
      {
        requestId: randomUUID(),
        artifactId: applied,
        caseIds: [foreignIngress],
      },
      randomUUID(),
    ),
    201,
  );
  const ingressTest = expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'test',
      {
        requestId: randomUUID(),
        artifactId: applied,
        caseId: foreignIngress,
        grantId: ingressGrant.id,
      },
      randomUUID(),
    ),
    202,
  );
  await monitor.tick();
  assert.equal(
    (
      await store.pool.query(
        'SELECT outcome FROM public.tenant_route_test_results WHERE intent_id=$1',
        [ingressTest.id],
      )
    ).rows[0].outcome,
    'denied',
  );
  console.log(
    'PASS tenant-routing actual cross-tenant ingress denied ' +
      JSON.stringify({
        caseId: foreignIngress,
        intentId: ingressTest.id,
        artifactId: applied,
      }),
  );
  // Deliberately mismatched manifest expectation, within the same approved local
  // source/destination subset: an observed isolation failure must persist even
  // when that grant is revoked or its row leaves the recent-results display.
  const mismatchCase = await addCase({
    tenantId: own.id,
    direction: 'outbound',
    routeId: metadata.outbound[0].id,
    sourceId: metadata.extensions[0].id,
    dialled: '5551000',
    kind: 'routing',
  });
  const mismatchGrant = expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'grant',
      {
        requestId: randomUUID(),
        artifactId: applied,
        caseIds: [mismatchCase],
      },
      randomUUID(),
    ),
    201,
  );
  const mismatch = expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'test',
      {
        requestId: randomUUID(),
        artifactId: applied,
        caseId: mismatchCase,
        grantId: mismatchGrant.id,
      },
      randomUUID(),
    ),
    202,
  );
  await monitor.tick();
  const unexpected = (
    await store.pool.query(
      'SELECT p.state,r.outcome,r.destination_id FROM public.tenant_route_test_progress p JOIN public.tenant_route_test_results r ON r.intent_id=p.intent_id WHERE p.intent_id=$1',
      [mismatch.id],
    )
  ).rows[0];
  assert.equal(unexpected.outcome, 'permitted');
  assert.equal(unexpected.state, 'failed');
  assert.equal(unexpected.destination_id, metadata.trunk.id);
  expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'revoke',
      { requestId: randomUUID(), grantId: mismatchGrant.id },
      randomUUID(),
    ),
    201,
  );
  const mismatchView = expect(
    await http.verification.read(p, own.id, metadata.nodeId, {}),
    200,
  );
  assert.equal(mismatchView.readiness.state, 'incomplete');
  assert.ok(
    mismatchView.readiness.blockers.includes('isolation_verification_failed'),
  );
  const affectedPeer = expect(
    await http.verification.read(
      p,
      metadata.tenants[1].id,
      metadata.nodeId,
      {},
    ),
    200,
  );
  assert.equal(affectedPeer.readiness.state, 'incomplete');
  assert.ok(
    affectedPeer.readiness.blockers.includes('isolation_verification_failed'),
  );
  console.log(
    'PASS tenant-routing real permitted SIP/RTP with deliberately mismatched negative expectation records failure and actual destination; grant revocation cannot clear the same-runtime isolation blocker ' +
      JSON.stringify({
        caseId: mismatchCase,
        intentId: mismatch.id,
        artifactId: applied,
      }),
  );
  const uncertainBody = {
    requestId: randomUUID(),
    artifactId: applied,
    caseId: metadata.cases[0].id,
    grantId: grants.get(own.id),
  };
  const uncertain = expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'test',
      uncertainBody,
      randomUUID(),
    ),
    202,
  );
  suppressOutcome = true;
  try {
    await monitor.tick();
  } finally {
    suppressOutcome = false;
  }
  assert.equal(lastCall.outcome, 'permitted');
  assert.equal(
    (
      await store.pool.query(
        'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
        [uncertain.id],
      )
    ).rows[0].state,
    'unknown',
  );
  const dispatched = callCount;
  expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'test',
      uncertainBody,
      randomUUID(),
    ),
    200,
  );
  await monitor.tick();
  assert.equal(callCount, dispatched);
  expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'test',
      { ...uncertainBody, requestId: randomUUID() },
      randomUUID(),
    ),
    409,
  );
  const uncertainView = expect(
    await http.verification.read(p, own.id, metadata.nodeId, {}),
    200,
  );
  assert.notEqual(uncertainView.readiness.state, 'ready');
  const reconcileBody = { requestId: randomUUID(), testId: uncertain.id };
  const reconciliation = expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'reconcile',
      reconcileBody,
      randomUUID(),
    ),
    202,
  );
  await monitor.tick();
  assert.equal(
    (
      await store.pool.query(
        'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
        [uncertain.id],
      )
    ).rows[0].state,
    'failed',
  );
  assert.equal(await barrier.idle(), true);
  expect(
    await http.verification.write(
      p,
      own.id,
      metadata.nodeId,
      'reconcile',
      reconcileBody,
      randomUUID(),
    ),
    200,
  );
  assert.equal(callCount, dispatched);
  console.log(
    'PASS tenant-routing injected outcome-loss after actual successful SIP/RTP: unknown blocks readiness and new calls, exact replay never redials, explicit native idle reconciliation records failure ' +
      JSON.stringify({
        intentId: uncertain.id,
        reconciliationId: reconciliation.id,
        artifactId: applied,
      }),
  );
  const one = metadata.tenants[0];
  expect(
    await http.verification.write(
      p,
      one.id,
      metadata.nodeId,
      'revoke',
      { requestId: randomUUID(), grantId: grants.get(one.id) },
      randomUUID(),
    ),
    201,
  );
  const revoked = expect(
    await http.verification.read(p, one.id, metadata.nodeId, {}),
    200,
  );
  assert.equal(revoked.readiness.state, 'incomplete');
  assert.equal(
    (
      await http.verification.write(
        p,
        one.id,
        metadata.nodeId,
        'test',
        {
          requestId: randomUUID(),
          artifactId: applied,
          caseId: metadata.cases[0].id,
          grantId: grants.get(one.id),
        },
        randomUUID(),
      )
    ).status,
    409,
  );
  console.log(
    'PASS tenant-routing actual grants: exact replay, completed test receipts do not redial, revocation invalidates readiness and blocks new draft test intent',
  );
  applied = await checkTenantRoutingTransfer({
    metadata,
    http,
    p,
    store,
    monitor,
    client,
    token,
    material,
    finished,
    expect,
    addCase,
    root,
    baseline,
    initialArtifact: applied,
    maintain: (id, action) => native.maintain(id, action),
  });
  const ownerCase = metadata.cases.find(
    (c) => c.tenantId === metadata.tenants[1].id && c.direction === 'outbound',
  );
  const ownerGrant =
    metadata.tenants[1].status === 'active'
      ? null
      : expect(
          await http.verification.write(
            p,
            metadata.tenants[1].id,
            metadata.nodeId,
            'grant',
            {
              requestId: randomUUID(),
              artifactId: applied,
              caseIds: [ownerCase.id],
            },
            randomUUID(),
          ),
          201,
        );
  const ownerTest = expect(
    await http.verification.write(
      p,
      metadata.tenants[1].id,
      metadata.nodeId,
      'test',
      {
        requestId: randomUUID(),
        artifactId: applied,
        caseId: ownerCase.id,
        grantId: ownerGrant?.id ?? null,
      },
      randomUUID(),
    ),
    202,
  );
  const schedule = globalThis.setTimeout;
  globalThis.setTimeout = (callback, milliseconds, ...args) =>
    schedule(
      callback,
      milliseconds === 1200
        ? 5000
        : milliseconds === 4000
          ? 8000
          : milliseconds,
      ...args,
    );
  const interruptedCall = monitor.tick();
  // Attach immediately: the old owner's completion must fail after lease loss.
  const fencedCompletion = interruptedCall.then(
    () => false,
    () => true,
  );
  const admissionDeadline = Date.now() + 15000;
  let ownerCallAdmitted = false;
  while (Date.now() < admissionDeadline) {
    const state = (
      await store.pool.query(
        'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
        [ownerTest.id],
      )
    ).rows[0].state;
    if (state === 'admitted' && !(await barrier.idle())) {
      ownerCallAdmitted = true;
      break;
    }
    await delay(10);
  }
  assert.ok(ownerCallAdmitted);
  renewalPaused = true;
  while (renewing) await delay(10);
  assert.equal(await ownership.release(token), true);
  try {
    assert.equal(await fencedCompletion, true);
  } finally {
    globalThis.setTimeout = schedule;
  }
  assert.equal(lastCall.outcome, 'permitted');
  const dispatchedAtLoss = callCount;
  const loss = expect(
    await http.verification.read(
      p,
      metadata.tenants[1].id,
      metadata.nodeId,
      {},
    ),
    200,
  );
  assert.equal(loss.readiness.state, 'incomplete');
  await monitor.tick();
  await assert.rejects(() =>
    native.maintain(applied, async (guard) => guard()),
  );
  const oldEpoch = token.epoch;
  token = await ownership.acquire(metadata.nodeId, randomUUID());
  assert.ok(token && token.epoch !== oldEpoch);
  await client.connect(token);
  await store.heartbeat(token);
  await monitor.tick();
  renewalPaused = false;
  assert.equal(
    (
      await store.pool.query(
        'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
        [ownerTest.id],
      )
    ).rows[0].state,
    'unknown',
  );
  assert.equal(callCount, dispatchedAtLoss);
  expect(
    await http.verification.write(
      p,
      metadata.tenants[1].id,
      metadata.nodeId,
      'reconcile',
      { requestId: randomUUID(), testId: ownerTest.id },
      randomUUID(),
    ),
    202,
  );
  await monitor.tick();
  assert.equal(
    (
      await store.pool.query(
        'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
        [ownerTest.id],
      )
    ).rows[0].state,
    'failed',
  );
  assert.equal(callCount, dispatchedAtLoss);
  const restoredOwner = await http.evidence.snapshot(
    metadata.tenants[1].id,
    metadata.nodeId,
  );
  assert.equal(restoredOwner.readiness.state, 'incomplete');
  assert.deepEqual(restoredOwner.verifiedExtensions, []);
  console.log(
    'PASS tenant-routing actual lease loss during successful SIP/RTP fences old completion and denies readiness; fresh owner converts retained old-epoch receipt to unknown without redial; explicit idle reconciliation and fresh generation invalidate prior grants/evidence ' +
      JSON.stringify({
        artifactId: applied,
        oldEpoch,
        newEpoch: token.epoch,
        intentId: ownerTest.id,
      }),
  );
  const recover = expect(
    await http.live.accept(
      p,
      metadata.nodeId,
      'recover',
      {
        requestId: randomUUID(),
        targetId: baseline,
        expectedBaselineId: applied,
      },
      randomUUID(),
    ),
    202,
  ).operation;
  await client.execute(token, recover.id, null);
  await finished(recover.id, 'recovered');
  assert.equal(await barrier.idle(), true);
  console.log(
    'PASS tenant-routing native fixture: exact reviewed tenant-aware apply, actual positive/forbidden SIP paths, bidirectional RTP, immutable provenance and required baseline recovery; synthetic endpoint material is explicitly distinguished from real-provider regression',
  );
} finally {
  clearInterval(timer);
  await monitor.close();
  await driver.drain();
  await admission.close().catch(() => {});
  await server.close().catch(() => {});
  await worker.stop().catch(() => {});
  await ownership.release(token).catch(() => {});
  await ownership.close();
  await http.onApplicationShutdown();
  await store.close();
}
