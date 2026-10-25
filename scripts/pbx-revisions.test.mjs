/* global structuredClone */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { compileRevision, semanticDiff } = backend(
  './dist/modules/telephony/domain/revision-compiler.js',
);
const { routeIdentity } = backend(
  './dist/modules/telephony/domain/route-identity.js',
);
const { settings } = backend('./dist/modules/telephony/domain/inventory.js');
const snapshot = () => ({
  eligibility: {
    allocations: 'unavailable',
    bindings: 'unavailable',
    sharedTrunkPermissions: 'unavailable',
  },
  node: { id: randomUUID(), version: 1, installationId: randomUUID() },
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
});
const exact = (digits) => ({
  kind: 'exact',
  digits,
  minLength: digits.length,
  maxLength: digits.length,
});
test('deterministic typed plan preserves identities, profiles, exact credentials, order, transforms and deny defaults', () => {
  const s = snapshot(),
    ext = randomUUID(),
    profile = randomUUID(),
    generation = randomUUID(),
    trunk = randomUUID(),
    credential = randomUUID(),
    gateway = randomUUID(),
    did = randomUUID(),
    group = randomUUID();
  s.capability = {
    id: s.node.installationId,
    version: 1,
    kinds: ['sip', 'webrtc'],
    signaling: ['udp', 'wss'],
    codecs: ['ulaw', 'alaw', 'opus'],
    media: ['none', 'dtls-srtp'],
  };
  s.profiles.push({
    id: profile,
    version: 1,
    name: 'SIP',
    kind: 'sip',
    settings: settings('sip'),
    capabilityRevision: 1,
  });
  const prefix =
    s.node.installationId.replaceAll('-', '') + '-' + ext.replaceAll('-', '');
  s.extensions.push({
    id: ext,
    version: 1,
    number: '1000',
    kind: 'sip',
    profileId: profile,
    profileVersion: 1,
    administrativeStatus: 'enabled',
    generationId: generation,
    endpointKey: `ims-e-${prefix}`,
    authKey: `ims-a-${prefix}`,
    aorKey: `ims-r-${prefix}`,
  });
  s.credentials.push(
    { id: generation, version: 1, available: true, purpose: 'endpoint' },
    { id: credential, version: 7, available: true, purpose: 'outbound-digest' },
  );
  s.trunks.push({
    id: trunk,
    version: 1,
    name: 'Trunk',
    enabled: true,
    direction: 'both',
    settings: {
      host: 'provider.invalid',
      port: 5060,
      transport: 'udp',
      media: 'rtp',
      codecs: ['ulaw'],
      directMedia: false,
      rtpSymmetric: true,
      forceRport: true,
      authentication: 'outbound-digest',
      credential: { id: credential, version: 7 },
    },
  });
  s.gateways.push({
    id: gateway,
    version: 1,
    name: 'Gateway',
    enabled: true,
    kind: 'sip-provider',
    trunkId: trunk,
    sourceAddresses: ['192.0.2.1'],
  });
  s.dids.push({
    id: did,
    version: 1,
    name: 'DID',
    enabled: true,
    number: '+00123',
    gatewayId: gateway,
  });
  s.groups.push({
    id: group,
    version: 1,
    name: 'Group',
    number: '2000',
    enabled: true,
    strategy: 'sequential',
    memberIds: [ext],
    timeout: 15,
    fallback: { kind: 'hangup' },
  });
  const inbound = (didId, enabled) => {
    const id = randomUUID();
    return {
      id,
      version: 1,
      name: 'Inbound',
      enabled,
      gatewayId: gateway,
      didId,
      destination: { kind: 'group', id: group },
      identity: routeIdentity(s.node.installationId, id),
    };
  };
  s.inbound.push(inbound(null, true), inbound(did, false));
  const outbound = (priority, enabled) => {
    const id = randomUUID();
    return {
      id,
      version: 1,
      name: 'Outbound',
      enabled,
      pattern: { kind: 'prefix', digits: '9', minLength: 3, maxLength: 5 },
      priority,
      trunkId: trunk,
      stripCount: 1,
      addPrefix: '63',
      identity: routeIdentity(s.node.installationId, id),
    };
  };
  s.outbound.push(outbound(200, true), outbound(100, false));
  const result = compileRevision(s);
  assert.equal(result.local, 'passed');
  assert.deepEqual(result, compileRevision(structuredClone(s)));
  assert.equal(result.plan.inbound[0].didId, did);
  assert.equal(result.plan.outbound[0].enabled, false);
  assert.equal(result.plan.defaults.disabledWinner, 'deny');
  assert.equal(result.plan.defaults.reservationOutput, 'deny');
  assert.equal(result.plan.endpoints[0].callingEligible, false);
  assert.deepEqual(result.plan.groups[0], s.groups[0]);
  assert.equal(result.plan.trunks[0].settings.credential.version, 7);
  assert.equal(result.plan.endpoints[0].generationId, generation);
  const changed = structuredClone(s);
  changed.trunks[0].settings.credential.version = 8;
  const diff = semanticDiff(changed, s, null);
  assert.equal(diff.changes[0].credentialReferenceChanged, true);
  assert.equal(diff.runtime.drift, 'unknown');
  assert.ok(!JSON.stringify(diff).includes('ims-e-'));
  changed.reservations.push({
    id: randomUUID(),
    version: 1,
    name: 'Reserved',
    purpose: 'Protection',
    pattern: exact('6300'),
  });
  assert.ok(
    compileRevision(changed).diagnostics.some(
      (d) => d.code === 'reserved_number',
    ),
  );
  changed.inbound[0].identity.contextHash = 'bad';
  assert.equal(compileRevision(changed).local, 'failed');
});
test('injection, unsupported capability, missing destinations, cycle and work bounds fail explicitly', () => {
  const s = snapshot();
  const g = {
    id: randomUUID(),
    version: 1,
    name: 'Group\n#include bad',
    enabled: true,
    number: null,
    memberIds: [randomUUID()],
    strategy: 'simultaneous',
    timeout: 20,
    fallback: { kind: 'hangup' },
  };
  s.groups.push(g);
  g.fallback = { kind: 'group', id: g.id };
  const r = compileRevision(s);
  assert.equal(r.local, 'failed');
  for (const code of [
    'configuration_injection',
    'missing_destination',
    'invalid_fallback_graph',
  ])
    assert.ok(r.diagnostics.some((d) => d.code === code));
  s.groups = Array.from({ length: 513 }, () => ({ ...g, id: randomUUID() }));
  assert.ok(
    compileRevision(s).diagnostics.some((d) => d.code === 'compiler_limit'),
  );
  assert.ok(compileRevision(s).diagnostics.length <= 512);
});
test('redacted diff distinguishes removal/edit/addition and opaque provenance stays internal', () => {
  const a = snapshot(),
    b = structuredClone(a);
  a.reservations.push({
    id: randomUUID(),
    version: 1,
    name: 'Reserved',
    purpose: 'Safety',
    pattern: exact('911'),
  });
  let d = semanticDiff(a, b, null);
  assert.equal(d.changes[0].change, 'added');
  d = semanticDiff(b, a, null);
  assert.equal(d.changes[0].change, 'removed');
  const c = structuredClone(a);
  c.reservations[0].name = 'Changed';
  d = semanticDiff(c, a, null);
  assert.deepEqual(d.changes[0].fields, ['name']);
});

test('WebRTC settings and unsupported capability are explicit', () => {
  const s = snapshot(),
    id = randomUUID();
  s.capability = {
    id: s.node.installationId,
    version: 1,
    kinds: ['webrtc'],
    signaling: ['wss'],
    codecs: ['opus', 'ulaw', 'alaw'],
    media: ['dtls-srtp'],
  };
  s.profiles.push({
    id,
    version: 1,
    name: 'WebRTC',
    kind: 'webrtc',
    settings: settings('webrtc'),
    capabilityRevision: 1,
  });
  const result = compileRevision(s);
  assert.equal(result.local, 'passed');
  assert.deepEqual(result.plan.profiles[0].settings, settings('webrtc'));
  s.capability.signaling = ['udp'];
  assert.ok(
    compileRevision(s).diagnostics.some(
      (d) => d.code === 'unsupported_profile',
    ),
  );
  s.profiles[0].settings.command = 'reload';
  assert.equal(compileRevision(s).local, 'failed');
});

test('diagnostic truncation never masks a later structural failure', () => {
  const s = snapshot(),
    profile = randomUUID();
  s.capability = {
    id: s.node.installationId,
    version: 1,
    kinds: ['sip'],
    signaling: ['udp'],
    codecs: ['ulaw', 'alaw'],
    media: ['none'],
  };
  s.profiles.push({
    id: profile,
    version: 1,
    name: 'SIP',
    kind: 'sip',
    settings: settings('sip'),
    capabilityRevision: 1,
  });
  for (let n = 0; n < 600; n++) {
    const id = randomUUID(),
      key =
        s.node.installationId.replaceAll('-', '') +
        '-' +
        id.replaceAll('-', '');
    s.extensions.push({
      id,
      version: 1,
      number: String(1000 + n),
      kind: 'sip',
      profileId: profile,
      profileVersion: 1,
      administrativeStatus: 'disabled',
      generationId: null,
      endpointKey: 'ims-e-' + key,
      authKey: 'ims-a-' + key,
      aorKey: 'ims-r-' + key,
    });
  }
  const id = randomUUID();
  s.inbound.push({
    id,
    version: 1,
    name: 'Late invalid reference',
    enabled: true,
    gatewayId: randomUUID(),
    didId: null,
    destination: { kind: 'hangup' },
    identity: routeIdentity(s.node.installationId, id),
  });
  const result = compileRevision(s);
  assert.equal(result.local, 'failed');
  assert.equal(result.diagnostics.length, 512);
  assert.equal(
    result.diagnostics.some((d) => d.severity === 'error'),
    false,
  );
  assert.equal(result.diagnostics.at(-1).code, 'diagnostics_truncated');
});
