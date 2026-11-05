/* global structuredClone */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { tenantRouting } = load(
  './dist/modules/telephony/domain/tenant-routing.js',
);
const { tenantReadiness } = load(
  './dist/modules/telephony/domain/tenant-readiness.js',
);
const { compileRevision } = load(
  './dist/modules/telephony/domain/revision-compiler.js',
);
const { revisionVersions, supportedRevision } = load(
  './dist/modules/telephony/domain/revision-snapshot.js',
);
function fixture() {
  const tenantId = randomUUID(),
    otherId = randomUUID(),
    node = { id: randomUUID(), installationId: randomUUID(), version: 1 };
  const s = {
    node,
    schemaVersion: 'tenant-routing-1',
    eligibility: {
      allocations: 'captured',
      bindings: 'captured',
      sharedTrunkPermissions: 'captured',
    },
    tenantRouting: {
      tenants: [
        {
          id: tenantId,
          version: 1,
          authorityVersion: 1,
          status: 'draft',
          voicePreference: 'enabled',
        },
        {
          id: otherId,
          version: 1,
          authorityVersion: 1,
          status: 'draft',
          voicePreference: 'enabled',
        },
      ],
      allocations: [],
      authorizations: [],
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
  const e = { id: randomUUID(), version: 1, administrativeStatus: 'enabled' };
  s.extensions.push(e);
  const claim = {
    id: randomUUID(),
    version: 1,
    tenantId,
    nodeId: node.id,
    installationId: node.installationId,
    extensionId: e.id,
    state: 'allocated',
  };
  s.tenantRouting.allocations.push(claim);
  const trunk = {
      id: randomUUID(),
      version: 1,
      enabled: true,
      direction: 'outbound',
    },
    route = {
      id: randomUUID(),
      version: 1,
      enabled: true,
      trunkId: trunk.id,
      pattern: { kind: 'exact', digits: '555100', minLength: 6, maxLength: 6 },
      priority: 1,
      stripCount: 1,
      addPrefix: '9',
    };
  s.trunks.push(trunk);
  s.outbound.push(route);
  const bind = (kind, r, owner = tenantId, scope = 'owned') => {
    const a = {
      id: randomUUID(),
      version: 1,
      tenantId: owner,
      nodeId: node.id,
      installationId: node.installationId,
      kind,
      resourceId: r.id,
      scope,
      evaluated: [
        {
          kind: kind === 'permission' ? 'trunks' : kind,
          id: r.id,
          version: r.version,
        },
      ],
    };
    s.tenantRouting.authorizations.push(a);
    return a;
  };
  bind('trunks', trunk, null, 'shared');
  bind('permission', trunk);
  const binding = bind('outbound', route);
  return { s, tenantId, otherId, e, claim, trunk, route, binding, bind };
}
test('canonical endpoint ownership rejects reserved, foreign, duplicate, unknown and wrong-installation sources', () => {
  const { s, tenantId, otherId, e, claim } = fixture();
  assert.equal(tenantRouting(s).extension(tenantId, e.id), true);
  assert.equal(tenantRouting(s).extension(otherId, e.id), false);
  assert.equal(tenantRouting(s).extension(tenantId, randomUUID()), false);
  for (const patch of [
    { state: 'reserved' },
    { installationId: randomUUID() },
    { nodeId: randomUUID() },
  ]) {
    const changed = structuredClone(s);
    Object.assign(changed.tenantRouting.allocations[0], patch);
    assert.equal(tenantRouting(changed).extension(tenantId, e.id), false);
  }
  s.tenantRouting.allocations.push({ ...claim, id: randomUUID() });
  assert.equal(tenantRouting(s).extension(tenantId, e.id), false);
});
test('tenant route filtering precedes priority and disabled winners never fall through; foreign permission and stale evaluations deny', () => {
  const { s, tenantId, otherId, route, binding, trunk, bind } = fixture();
  assert.equal(tenantRouting(s).outboundRule(tenantId, '555100').id, route.id);
  const foreign = { ...route, id: randomUUID(), priority: 0 };
  s.outbound.push(foreign);
  bind('outbound', foreign, otherId);
  assert.equal(tenantRouting(s).outboundRule(tenantId, '555100').id, route.id);
  const disabled = { ...route, id: randomUUID(), priority: 0, enabled: false };
  s.outbound.push(disabled);
  bind('outbound', disabled);
  assert.equal(tenantRouting(s).outboundRule(tenantId, '555100'), null);
  s.outbound.pop();
  s.tenantRouting.authorizations.pop();
  binding.evaluated[0].version++;
  assert.equal(tenantRouting(s).outboundRule(tenantId, '555100'), null);
  binding.evaluated[0].version--;
  s.tenantRouting.authorizations.find((a) => a.kind === 'trunks').tenantId =
    otherId;
  assert.equal(tenantRouting(s).outbound(tenantId, route.id), false);
  assert.equal(trunk.enabled, true);
});
test('readiness requires current positive provenance, rejects stale/future/failed evidence and stays separate from voice intent and lifecycle', () => {
  const { s, tenantId } = fixture(),
    now = new Date('2026-11-04T00:00:00.000Z');
  const evidence = ['inbound', 'outbound'].map((direction) => ({
    direction,
    permitted: true,
    expected: true,
    current: true,
    createdAt: new Date(now.getTime() - 1000),
  }));
  const ready = (current = true, pending = false, proof = evidence) =>
    tenantReadiness(s, tenantId, current, pending, proof, now);
  assert.equal(ready().state, 'ready');
  assert.equal(ready(false).state, 'incomplete');
  assert.equal(ready(true, true).state, 'incomplete');
  for (const patch of [
    { permitted: false },
    { current: false },
    { createdAt: new Date(now.getTime() - 86400000) },
    { createdAt: new Date(now.getTime() + 1) },
  ]) {
    const changed = evidence.map((e) => ({ ...e, ...patch }));
    assert.equal(ready(true, false, changed).state, 'incomplete');
  }
  s.tenantRouting.tenants[0].voicePreference = 'not_configured';
  assert.equal(ready().state, 'incomplete');
  s.tenantRouting.tenants[0].voicePreference = 'disabled';
  assert.equal(ready(false, true, []).state, 'not_required');
  assert.equal(s.tenantRouting.tenants[0].status, 'draft');
});
test('historical deny policy remains distinct and unknown snapshot versions cannot compile', () => {
  const { s } = fixture();
  assert.equal(revisionVersions(s).policyVersion, 'tenant-routing-1');
  assert.equal(supportedRevision(s, 'review-2', 'deny-unbound-1'), false);
  const legacy = { ...s };
  delete legacy.schemaVersion;
  delete legacy.tenantRouting;
  legacy.eligibility = {
    allocations: 'unavailable',
    bindings: 'unavailable',
    sharedTrunkPermissions: 'unavailable',
  };
  assert.deepEqual(revisionVersions(legacy), {
    compilerVersion: 'review-2',
    policyVersion: 'deny-unbound-1',
  });
  const empty = {
    ...legacy,
    extensions: [],
    trunks: [],
    outbound: [],
    schemaVersion: 'unknown',
  };
  assert.equal(compileRevision(empty).local, 'failed');
});
