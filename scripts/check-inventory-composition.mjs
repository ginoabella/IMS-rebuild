import {
  ensureNoGeneratedCollision,
  ensureKeysAbsent,
} from './inventory-pbx-acceptance.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const {
  composeExtensionObservation: compose,
} = require('./dist/modules/telephony/domain/inventory-observation.js');
const node = { id: randomUUID(), installationId: randomUUID(), version: 2 };
const extension = randomUUID(),
  suffix = `${node.installationId.replaceAll('-', '')}-${extension.replaceAll('-', '')}`;
const row = {
  id: extension,
  node_id: node.id,
  installation_id: node.installationId,
  endpoint_key: `ims-e-${suffix}`,
  auth_key: `ims-a-${suffix}`,
  aor_key: `ims-r-${suffix}`,
};
const snapshot = {
  kind: 'observed',
  desiredVersion: 2,
  epoch: '12',
  sequence: 3,
  lastSuccessAt: new Date().toISOString(),
  ageMs: 0,
  freshness: 'current',
  connection: 'reachable',
  reconciliation: 'complete',
  ownership: 'current',
  failure: null,
  coverage: 'pjsip-dynamic-contacts',
  registeredEndpoints: 1,
  registrations: [
    {
      endpoint: row.endpoint_key,
      registered: true,
      contacts: 1,
      reachableContacts: 0,
    },
  ],
};
assert.equal(compose(node, row, snapshot).registration, 'registered');
assert.equal(
  compose(node, row, {
    ...snapshot,
    registrations: [
      { ...snapshot.registrations[0], registered: false, contacts: 0 },
    ],
  }).registration,
  'unregistered',
);
assert.equal(
  compose(node, row, { ...snapshot, registrations: [] }).registration,
  'endpoint_absent',
);
for (const change of [
  { freshness: 'historical' },
  { freshness: 'stale' },
  { coverage: 'unknown' },
  { reconciliation: 'reconciling' },
  { ownership: 'absent' },
  { connection: 'disconnected' },
  { desiredVersion: 1 },
])
  assert.equal(
    compose(node, row, { ...snapshot, ...change }).registration,
    'unknown',
  );
for (const change of [
  { node_id: randomUUID() },
  { installation_id: randomUUID() },
  { endpoint_key: '6101' },
  { auth_key: 'ims-a-foreign' },
  { aor_key: 'ims-r-foreign' },
])
  assert.equal(
    compose(node, { ...row, ...change }, snapshot).registration,
    'unknown',
  );
assert.equal(
  compose(node, row, {
    ...snapshot,
    registrations: [
      { endpoint: '6101', registered: true, contacts: 1, reachableContacts: 1 },
    ],
  }).registration,
  'endpoint_absent',
);
const safe = JSON.stringify(compose(node, row, snapshot));
assert.ok(!safe.includes('ims-'));
assert.ok(!safe.includes('registrations'));
assert.ok(!safe.includes('registeredEndpoints'));
console.log(
  'PASS injected composition contracts: exact qualified persisted keys; number/unmanaged/foreign mapping rejected; covered presence/absence; stale/version/ownership/coverage/disconnect unknown; safe metadata retained without generated keys.',
);

const namespace = { endpoints: [row.endpoint_key], auths: [], aors: [] };
const original = JSON.stringify(namespace);
assert.throws(() => ensureNoGeneratedCollision(namespace, node.installationId));
assert.throws(() => ensureKeysAbsent(namespace, [row.endpoint_key]));
assert.equal(
  JSON.stringify(namespace),
  original,
  'Collision rejection preserves pre-existing objects',
);
ensureNoGeneratedCollision(namespace, randomUUID());
console.log(
  'PASS injected trusted preflight: own-installation namespace/exact-key collision rejects without adoption/removal; foreign installation remains unmapped.',
);
