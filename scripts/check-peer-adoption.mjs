// Application regression: outbound credential edits preserve existing gateway
// references, while the established connection/removal protections still apply.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Peers } = backend('./dist/modules/telephony/application/peers.js');
const operatorId = randomUUID(),
  nodeId = randomUUID(),
  installationId = randomUUID(),
  id = randomUUID();
const credential = { id: randomUUID(), version: 1 };
const settings = {
  host: 'provider.invalid',
  port: 5060,
  transport: 'udp',
  media: 'rtp',
  codecs: ['ulaw'],
  directMedia: false,
  rtpSymmetric: true,
  forceRport: true,
  authentication: 'outbound-digest',
  credential,
};
const old = {
  id,
  nodeId,
  installationId,
  name: 'Referenced trunk',
  direction: 'both',
  enabled: false,
  version: 1,
  settings,
  removedAt: null,
};
let edits = 0,
  checks = 0,
  audits = 0;
const app = new Peers(
  { run: async (_context, action) => action({}) },
  {},
  { validate: async () => true },
  {
    node: async () => ({ installationId }),
    detail: async () => old,
    validate: async () => {
      checks++;
    },
    blockers: async () => [{ id: randomUUID(), name: 'Existing gateway' }],
    edit: async (_tx, _kind, _old, values) => {
      edits++;
      return { ...old, ...values, version: 2 };
    },
  },
  {
    append: async () => {
      audits++;
    },
  },
);
const principal = {
  plane: 'platform',
  operatorId,
  grants: ['platform_operator'],
};
const write = (values) =>
  app.write(
    principal,
    'trunks',
    nodeId,
    id,
    'edit',
    { expectedVersion: 1, name: old.name, direction: 'both', settings: values },
    randomUUID(),
  );
const adoption = await write({
  ...settings,
  credential: { ...credential, version: 2 },
});
assert.equal(adoption.status, 200, JSON.stringify(adoption));
assert.equal(
  (
    await write({
      ...settings,
      registration: {
        registrar: 'registrar.invalid',
        realm: 'synthetic.invalid',
        expiration: 3600,
        retryInterval: 60,
        forbiddenRetryInterval: 10,
      },
    })
  ).status,
  200,
);
assert.equal(
  (
    await write({
      ...settings,
      authentication: 'ip-peer',
      credential: undefined,
    })
  ).status,
  200,
);
assert.equal(
  (await write({ ...settings, host: 'changed.invalid' })).value.reason,
  'referenced',
);
assert.equal(
  (
    await app.write(
      principal,
      'trunks',
      nodeId,
      id,
      'remove',
      { expectedVersion: 1 },
      randomUUID(),
    )
  ).value.reason,
  'referenced',
);
assert.equal(edits, 3);
assert.equal(audits, 3);
assert.equal(checks, 4);
console.log(
  'PASS peer application regression: credential version, registration and outbound authentication edits preserve gateway references; connection changes/removal still reject. SQL/API validation is checked separately.',
);
