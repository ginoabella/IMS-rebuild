// Disposable actual Asterisk acceptance only; no production fault controls.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { SyntheticSipPeer } from './sip-fixture.mjs';
import { verifyAmiGateway } from './gateway-fixture.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createSocket } from 'node:dgram';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/native-driver.js',
);
const { ProtectedArtifactStore } = load('./artifact-store.js');
const { NativeAdmissionBarrier } = load('./admission.js');
const { NativePbxDriver, nativeCli } = load('./native-driver.js');
const { materializeRevision } = load('./materialize.js');
const { PhysicalMutationBoundary } = load('./mutation-boundary.js');
const { VerifiedLiveExecution } = load('./verified-execution.js');
const { NativeDenyProbes } = load('./native-probes.js');
const { settings: profileSettings } = load('../../domain/inventory.js');
const { routeIdentity } = load('../../domain/route-identity.js');
const node = randomUUID(),
  installation = randomUUID(),
  baseline = randomUUID(),
  revision = randomUUID();
const root = '/var/lib/myims-pbx/control/fixture';
mkdirSync(root, { recursive: true, mode: 0o700 });
const staging = root + '/staging';
mkdirSync(staging, { mode: 0o700 });
const s = {
  node: { id: node, version: 1, installationId: installation },
  eligibility: {
    allocations: 'unavailable',
    bindings: 'unavailable',
    sharedTrunkPermissions: 'unavailable',
  },
  capability: null,
  profiles: [],
  extensions: [],
  trunks: [],
  gateways: [],
  dids: [],
  groups: [],
  reservations: [],
  inbound: [],
  outbound: [],
  credentials: [],
};
const identity = {
  nodeId: node,
  installationId: installation,
  revisionId: revision,
  sequence: 1,
  compilerVersion: 'review-2',
  policyVersion: 'deny-unbound-1',
  sourceDigest: 'a'.repeat(64),
};
const store = new ProtectedArtifactStore(staging, installation, node),
  barrier = new NativeAdmissionBarrier(),
  driver = new NativePbxDriver(
    root,
    '/var/lib/myims-pbx/managed',
    store,
    barrier,
  );
store.stage(
  identity,
  materializeRevision(s, revision, { endpoints: new Map(), trunks: new Map() }),
);
const fingerprint = driver.unmanaged();
const malformed = { ...identity, revisionId: randomUUID(), sequence: 2 };
const malformedFiles = materializeRevision(s, malformed.revisionId, {
  endpoints: new Map(),
  trunks: new Map(),
});
store.stage(malformed, {
  ...malformedFiles,
  pjsip: Buffer.concat([
    malformedFiles.pjsip,
    Buffer.from('\n[unterminated-native-fixture\n'),
  ]),
});
assert.equal(existsSync('/var/lib/myims-pbx/managed/current'), false);
await assert.rejects(
  driver.validate(malformed, s),
  (error) => error.code === 'validation_failed',
);
assert.equal(existsSync('/var/lib/myims-pbx/managed/current'), false);
assert.equal(driver.unmanaged(), fingerprint);
console.log(
  'PASS native validation failure: actual isolated Asterisk rejects a malformed complete candidate before selection; the live pointer and unmanaged configuration remain untouched',
);
await driver.validate(identity, s);
console.log(
  'PASS native: isolated pinned Asterisk validates a complete managed set with validator-UID egress denial',
);
const socket = createSocket('udp4');
await new Promise((resolve) => socket.bind(5061, '127.0.0.1', resolve));
const sender = createSocket('udp4');
let received = 0;
socket.on('message', () => received++);
const send = async () => {
  sender.send(Buffer.from('controlled-admission-probe'), 5061, '127.0.0.1');
  await new Promise((resolve) => setTimeout(resolve, 150));
};
try {
  await send();
  assert.equal(received, 1);
  // Two fixed Local-only calls in this network-less disposable namespace stay
  // within the approved synthetic budget (two total, sequential, <=2 seconds).
  await nativeCli(
    'channel originate Local/s@ims-fixture-hold application Wait 2',
  );
  const busyDeadline = Date.now() + 1000;
  let active = false;
  while (Date.now() < busyDeadline) {
    const count = await nativeCli('core show channels count');
    if (!count.startsWith('0 active channels')) {
      active = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(active, 'controlled Local call must really be active');
  const waiting = performance.now();
  await barrier.begin(
    Date.now() + 5000,
    new globalThis.AbortController().signal,
    async () => {},
  );
  assert.ok(
    performance.now() - waiting > 500,
    'installation must defer for the real existing call',
  );
  await barrier.open();
  const close = barrier.close.bind(barrier),
    open = barrier.open.bind(barrier);
  let raced = false,
    reopened = 0;
  barrier.close = async () => {
    if (!raced) {
      raced = true;
      await nativeCli(
        'channel originate Local/s@ims-fixture-hold application Wait 2',
      );
    }
    await close();
  };
  barrier.open = async () => {
    reopened++;
    await open();
  };
  await barrier.begin(
    Date.now() + 5000,
    new globalThis.AbortController().signal,
    async () => {},
  );
  assert.ok(
    raced && reopened === 1,
    'a call in the zero-check/close race must reopen the untouched set and drain naturally',
  );
  barrier.close = close;
  barrier.open = open;
  await send();
  assert.equal(received, 1, 'signaling must be denied after barrier closes');
  await barrier.quiet(
    Date.now() + 2000,
    new globalThis.AbortController().signal,
    async () => {},
  );
  const token = {
    nodeId: node,
    incarnation: randomUUID(),
    epoch: '1',
    desiredVersion: 1,
  };
  let current = { ...token };
  const boundary = new PhysicalMutationBoundary(root, node, installation, {
    drain: () => driver.drain(),
    current: async (t) =>
      t.epoch === current.epoch &&
      t.incarnation === current.incarnation &&
      t.nodeId === current.nodeId,
  });
  await boundary.initialize(async () => {
    await driver.captureBaseline();
    return baseline;
  });
  await boundary.takeover(token);
  const intent = {
    operationId: randomUUID(),
    revisionId: revision,
    sequence: 1,
    expectedBaselineId: baseline,
    fingerprint: 'b'.repeat(64),
  };
  let reloads = 0;
  const run = async (guard) => {
    await guard();
    await barrier.assertClosed();
    await barrier.quiet(
      Date.now() + 2000,
      new globalThis.AbortController().signal,
      guard,
    );
    driver.select(identity);
    await driver.reload(guard);
    reloads++;
    await driver.verify(identity, s, fingerprint);
    return { kind: 'verified', installedId: revision, verifiedId: revision };
  };
  const result = await boundary.execute(token, intent, run, async () => {
    throw new Error('unexpected reconcile');
  });
  assert.equal(result.kind, 'verified');
  await boundary.execute(token, intent, run, async () => {
    throw new Error('unsafe replay');
  });
  assert.equal(reloads, 1);
  current = { ...token, epoch: '2', incarnation: randomUUID() };
  await boundary.takeover(current);
  await assert.rejects(
    boundary.execute(token, intent, run, run),
    (e) => e.code === 'stale_owner',
  );
  assert.equal(reloads, 1);
  console.log(
    'PASS native: actual atomic selection, fixed PJSIP/dialplan reload, independent loaded provenance/default denial, duplicate suppression and stale epoch rejection',
  );
  const nextRevision = randomUUID();
  const nextIdentity = { ...identity, revisionId: nextRevision, sequence: 2 };
  store.stage(
    nextIdentity,
    materializeRevision(s, nextRevision, {
      endpoints: new Map(),
      trunks: new Map(),
    }),
  );
  const baselineArtifact = { identity, snapshot: s, unmanaged: fingerprint };
  const candidateArtifact = {
    identity: nextIdentity,
    snapshot: s,
    unmanaged: fingerprint,
  };
  const phases = [];
  let rejectCandidate = true;
  const proof = {
    authorized: async () => true,
    dependenciesCurrent: async () => true,
    phase: async (state) => {
      phases.push(state);
    },
    probes: async (artifact) => {
      // Independent negative ingress proof on the real loaded context. Positive
      // route/material probe coverage is intentionally not claimed by this fixture.
      const deny = `ims-deny-${node.replaceAll('-', '')}`;
      const runtime = await nativeCli(`dialplan show ${deny}`);
      assert.ok(runtime.includes('Hangup()'));
      if (artifact.identity.revisionId === nextRevision && rejectCandidate) {
        rejectCandidate = false;
        throw new Error('Injected verification failure in disposable fixture');
      }
    },
  };
  const execution = new VerifiedLiveExecution(boundary, driver, barrier);
  const recoveryIntent = {
    operationId: randomUUID(),
    revisionId: nextRevision,
    sequence: 2,
    expectedBaselineId: revision,
    fingerprint: 'c'.repeat(64),
  };
  await barrier.open();
  const recovered = await execution.run(
    {
      token: current,
      intent: recoveryIntent,
      candidate: candidateArtifact,
      baseline: baselineArtifact,
      recovery: false,
      signal: new globalThis.AbortController().signal,
    },
    proof,
  );
  assert.equal(recovered.kind, 'recovered');
  assert.equal(recovered.verifiedId, revision);
  assert.ok(phases.includes('recovering'));
  await driver.verify(identity, s, fingerprint);
  // An uncertain recovery must retain the physical pending intent and gate.
  const failing = new VerifiedLiveExecution(
    boundary,
    {
      validate: (...args) => driver.validate(...args),
      select: (...args) => driver.select(...args),
      reload: async () => {
        throw new Error('Injected reload/recovery failure');
      },
      verify: (...args) => driver.verify(...args),
      drain: () => driver.drain(),
    },
    barrier,
  );
  const uncertainIntent = {
    ...recoveryIntent,
    operationId: randomUUID(),
    sequence: 3,
    fingerprint: 'd'.repeat(64),
  };
  const uncertainRequest = {
    token: current,
    intent: uncertainIntent,
    candidate: candidateArtifact,
    baseline: baselineArtifact,
    recovery: false,
    signal: new globalThis.AbortController().signal,
  };
  const unknown = await failing.run(uncertainRequest, proof);
  assert.equal(unknown.kind, 'unknown');
  await barrier.assertClosed();
  assert.equal(
    (await boundary.inspect(current, uncertainIntent.operationId)).state,
    'pending',
  );
  // The selected baseline and independently read runtime do match here: retry
  // establishes that fact without replaying either interrupted reload.
  const reconciled = await execution.run(uncertainRequest, proof);
  assert.equal(reconciled.kind, 'recovered');
  assert.equal(reconciled.verifiedId, revision);
  assert.equal(reconciled.failure, 'verification_failed');
  console.log(
    'PASS native: verification failure restores and independently verifies prior complete set; uncertain recovery retains gate/pending intent and reconciles actual facts without reload replay',
  );
  await barrier.close();
  await nativeCli(
    'channel originate Local/s@ims-fixture-hold application Wait 2',
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await assert.rejects(
    barrier.quiet(
      Date.now() + 200,
      new globalThis.AbortController().signal,
      async () => {},
    ),
    (error) => error.code === 'activity_deadline',
  );
  await barrier.assertClosed();
  await barrier.quiet(
    Date.now() + 5000,
    new globalThis.AbortController().signal,
    async () => {},
  );
  console.log(
    'PASS native: real controlled Local calls defer installation until natural drain; bounded recovery quiet-window deadline retains signaling denial without hangup (three calls including the real zero-check/barrier race, sequential, <=2 seconds each)',
  );
  execFileSync('/usr/sbin/nft', [
    'add',
    'rule',
    'inet',
    'myims_apply',
    'input',
    'accept',
  ]);
  await assert.rejects(
    barrier.assertClosed(),
    (e) => e.code === 'activity_unknown',
  );
  await barrier.close();
  await barrier.open();
  await send();
  assert.equal(received, 2);
  console.log(
    'PASS native: actual signaling check-to-effect barrier, unknown/drift denial and explicit reopening; no external traffic',
  );
  const stockId = randomUUID(),
    profileId = randomUUID(),
    generationId = randomUUID();
  const source =
    installation.replaceAll('-', '') + '-' + stockId.replaceAll('-', '');
  const stockSnapshot = {
    ...s,
    capability: {
      id: installation,
      version: 1,
      kinds: ['sip'],
      signaling: ['udp'],
      codecs: ['ulaw', 'alaw'],
      media: ['none'],
    },
    profiles: [
      {
        id: profileId,
        version: 1,
        name: 'Private native fixture',
        kind: 'sip',
        settings: profileSettings('sip'),
        capabilityRevision: 1,
      },
    ],
    extensions: [
      {
        id: stockId,
        version: 1,
        number: '1000',
        kind: 'sip',
        profileId,
        profileVersion: 1,
        administrativeStatus: 'enabled',
        generationId,
        endpointKey: `ims-e-${source}`,
        authKey: `ims-a-${source}`,
        aorKey: `ims-r-${source}`,
      },
    ],
    credentials: [
      { id: generationId, version: 1, available: true, purpose: 'endpoint' },
    ],
  };
  const stockIdentity = { ...identity, revisionId: randomUUID(), sequence: 3 };
  const password =
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  store.stage(
    stockIdentity,
    materializeRevision(stockSnapshot, stockIdentity.revisionId, {
      endpoints: new Map([[generationId, { password }]]),
      trunks: new Map(),
    }),
  );
  const probeBarrier = new NativeAdmissionBarrier(['127.0.0.1']);
  const probeDriver = new NativePbxDriver(
    root,
    '/var/lib/myims-pbx/managed',
    store,
    probeBarrier,
  );
  await probeDriver.validate(stockIdentity, stockSnapshot);
  await probeBarrier.close();
  probeDriver.select(stockIdentity);
  await probeDriver.reload(async () => {});
  await probeDriver.verify(stockIdentity, stockSnapshot, fingerprint);
  await new NativeDenyProbes(store).verify(
    {
      identity: stockIdentity,
      snapshot: stockSnapshot,
      unmanaged: fingerprint,
    },
    new globalThis.AbortController().signal,
  );
  console.log(
    'PASS native: exact protected endpoint secret proves loaded digest authentication (wrong secret denied, exact secret accepted) via loopback OPTIONS; actual resource/profile/AOR facts verified, no REGISTER or call',
  );
  const secondId = randomUUID(),
    secondGeneration = randomUUID();
  const secondSource =
    installation.replaceAll('-', '') + '-' + secondId.replaceAll('-', '');
  const secondStock = {
    ...stockSnapshot.extensions[0],
    id: secondId,
    number: '1001',
    generationId: secondGeneration,
    endpointKey: `ims-e-${secondSource}`,
    authKey: `ims-a-${secondSource}`,
    aorKey: `ims-r-${secondSource}`,
  };
  const events = [];
  const firstPeer = await new SyntheticSipPeer(
    stockSnapshot.extensions[0].endpointKey,
    password,
    events,
    { delay: 100, aor: stockSnapshot.extensions[0].aorKey },
  ).start();
  const secondPeer = await new SyntheticSipPeer(
    secondStock.endpointKey,
    password,
    events,
    { delay: 100, aor: secondStock.aorKey },
  ).start();
  const trunkPeer = await new SyntheticSipPeer(
    'fixture-outbound',
    password,
    events,
    { digest: true },
  ).start();
  try {
    const trunkId = randomUUID(),
      credentialId = randomUUID(),
      gatewayId = randomUUID(),
      didId = randomUUID(),
      sequential = randomUUID(),
      simultaneous = randomUUID();
    const exactId = randomUUID(),
      catchId = randomUUID(),
      outboundId = randomUUID();
    const routeSnapshot = {
      ...stockSnapshot,
      extensions: [...stockSnapshot.extensions, secondStock],
      credentials: [
        ...stockSnapshot.credentials,
        {
          id: secondGeneration,
          version: 1,
          available: true,
          purpose: 'endpoint',
        },
        {
          id: credentialId,
          version: 1,
          available: true,
          purpose: 'outbound-digest',
        },
      ],
      trunks: [
        {
          id: trunkId,
          version: 1,
          name: 'Synthetic loopback trunk',
          direction: 'both',
          enabled: true,
          settings: {
            host: '127.0.0.1',
            port: trunkPeer.port,
            transport: 'udp',
            media: 'rtp',
            codecs: ['ulaw', 'alaw'],
            directMedia: false,
            rtpSymmetric: true,
            forceRport: true,
            authentication: 'outbound-digest',
            credential: { id: credentialId, version: 1 },
          },
        },
      ],
      gateways: [
        {
          id: gatewayId,
          version: 1,
          name: 'Synthetic loopback gateway',
          kind: 'provider',
          enabled: true,
          trunkId,
          sourceAddresses: ['127.0.0.1'],
        },
      ],
      dids: [
        {
          id: didId,
          version: 1,
          name: 'Synthetic exact DID',
          enabled: true,
          number: '+15550001001',
          gatewayId,
        },
      ],
      groups: [
        {
          id: sequential,
          version: 1,
          name: 'Synthetic sequential',
          number: '2000',
          enabled: true,
          memberIds: [stockId, secondId],
          strategy: 'sequential',
          timeout: 5,
          fallback: { kind: 'hangup' },
        },
        {
          id: simultaneous,
          version: 1,
          name: 'Synthetic simultaneous',
          number: '2001',
          enabled: true,
          memberIds: [stockId, secondId],
          strategy: 'simultaneous',
          timeout: 5,
          fallback: { kind: 'hangup' },
        },
      ],
      inbound: [
        {
          id: exactId,
          version: 1,
          name: 'Synthetic disabled exact winner',
          enabled: false,
          gatewayId,
          didId,
          destination: { kind: 'extension', id: stockId },
          identity: routeIdentity(installation, exactId),
        },
        {
          id: catchId,
          version: 1,
          name: 'Synthetic catchall',
          enabled: true,
          gatewayId,
          didId: null,
          destination: { kind: 'group', id: sequential },
          identity: routeIdentity(installation, catchId),
        },
      ],
      outbound: [
        {
          id: outboundId,
          version: 1,
          name: 'Synthetic outbound transform',
          enabled: true,
          priority: 10,
          pattern: { kind: 'prefix', digits: '91', minLength: 3, maxLength: 3 },
          trunkId,
          stripCount: 2,
          addPrefix: '7',
          identity: routeIdentity(installation, outboundId),
        },
      ],
      reservations: [
        {
          id: randomUUID(),
          version: 1,
          name: 'Synthetic reservation',
          purpose: 'Private denial probe',
          pattern: { kind: 'exact', digits: '999', minLength: 3, maxLength: 3 },
        },
      ],
    };
    const routeExact = { ...identity, revisionId: randomUUID(), sequence: 4 };
    store.stage(
      routeExact,
      materializeRevision(routeSnapshot, routeExact.revisionId, {
        endpoints: new Map([
          [generationId, { password }],
          [secondGeneration, { password }],
        ]),
        trunks: new Map([
          [
            `${credentialId}:1`,
            {
              username: 'fixture-outbound',
              password,
              realm: 'synthetic.invalid',
            },
          ],
        ]),
      }),
    );
    await probeDriver.validate(routeExact, routeSnapshot);
    probeDriver.select(routeExact);
    await probeDriver.reload(async () => {});
    await probeDriver.verify(routeExact, routeSnapshot, fingerprint);
    await firstPeer.register();
    await secondPeer.register();
    const nodeName = node.replaceAll('-', '');
    let calls = 3;
    async function call(number, context) {
      assert.ok(++calls <= 20);
      const before = events.length;
      await nativeCli(
        `channel originate Local/${number}@${context} application Wait 1`,
      );
      const deadline = Date.now() + 3000;
      await new Promise((resolve) => setTimeout(resolve, 150));
      while (Date.now() < deadline) {
        const count = await nativeCli('core show channels count');
        if (count.startsWith('0 active channels')) return events.slice(before);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(
        'Synthetic call exceeded its bounded natural completion deadline',
      );
    }
    assert.deepEqual(
      await call('+15550001001', `ims-in-${gatewayId.replaceAll('-', '')}`),
      [],
      'disabled exact DID must deny instead of falling through',
    );
    const ordered = await call(
      '+15550001002',
      `ims-in-${gatewayId.replaceAll('-', '')}`,
    );
    assert.deepEqual(
      ordered
        .filter((event) => event.kind === 'invite')
        .map((event) => event.peer),
      [firstPeer.username, secondPeer.username],
    );
    const parallel = await call(
      's',
      `ims-group-${simultaneous.replaceAll('-', '')}`,
    );
    assert.equal(parallel.filter((event) => event.kind === 'invite').length, 2);
    assert.ok(
      Math.abs(parallel[0].time - parallel[1].time) < 100,
      'simultaneous group must dispatch both peers before either rejection',
    );
    const outbound = await call('912', `ims-out-${nodeName}`);
    assert.ok(
      outbound.some(
        (event) =>
          event.kind === 'invite' &&
          event.authenticated &&
          event.number === '72',
      ),
    );
    assert.ok(!outbound.some((event) => event.kind === 'invalid_digest'));
    assert.deepEqual(await call('999', `ims-out-${nodeName}`), []);
    assert.deepEqual(
      await call('912', `ims-deny-${nodeName}`),
      [],
      'ordinary unbound endpoint context must remain denied despite synthetic route contexts',
    );
    await firstPeer.register(0);
    await secondPeer.register(0);
    console.log(
      'PASS native: synthetic exact-DID disabled-winner denial, catchall/sequential group order, simultaneous fork, actual outbound strip/add transform and exact digest challenge, reservation/default denial and ordinary unbound denial; nine total sequential bounded Local calls, at most two synthetic peer legs, no public destination',
    );
  } finally {
    firstPeer.close();
    secondPeer.close();
    trunkPeer.close();
  }
  probeDriver.select(identity);
  await probeDriver.reload(async () => {});
  await probeDriver.verify(identity, s, fingerprint);
  await probeBarrier.open();
  await verifyAmiGateway();
} finally {
  socket.close();
  sender.close();
}
