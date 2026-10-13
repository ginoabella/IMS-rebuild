// Test-only production HTTP graph. Clock control is private IPC and fixture-scoped.
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../../services/backend/package.json', import.meta.url),
);
const { loadBackendConfig } = backend('./dist/infrastructure/configuration.js');
const config = loadBackendConfig();
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(new URL(config.database.url).hostname, 'postgres');
assert.equal(new URL(config.database.url).pathname, '/myims');
assert.ok(process.send);
const { SharedSessionLifecycle } = backend(
  './dist/modules/identity/application/session-lifecycle.js',
);
const { PostgresSessionFences } = backend(
  './dist/modules/identity/adapters/db/session-fences.js',
);
const scope = new AsyncLocalStorage();
const tracked = new Map();
let tenantId, identities;
const issue = SharedSessionLifecycle.prototype.issue;
SharedSessionLifecycle.prototype.issue = async function (authority, consumer) {
  if (
    authority.plane !== 'tenant' ||
    authority.tenantId !== tenantId ||
    !identities?.includes(authority.identityId)
  )
    return { kind: 'invalid' };
  return scope.run(true, async () => {
    const result = await issue.call(this, authority, consumer);
    if (result.kind !== 'issued')
      process.send({ event: 'issuance-outcome', kind: result.kind });
    if (result.kind === 'issued') {
      tracked.set(result.record.lifecycleId, 0);
      process.send({
        event: 'tracked',
        lifecycleId: result.record.lifecycleId,
        token: result.token, // Private parent IPC only; never output or persist.
        generation: result.record.generation,
      });
    }
    return result;
  });
};
const lock = PostgresSessionFences.prototype.lock;
PostgresSessionFences.prototype.lock = function (id, action) {
  return lock.call(this, id, (fence) =>
    action({
      ...fence,
      now: async () =>
        (await fence.now()) + (scope.getStore() ? 0 : (tracked.get(id) ?? 0)),
    }),
  );
};
process.on('message', (message) => {
  if (message.operation === 'init') {
    tenantId = message.fixtureTenant;
    identities = message.fixtureIdentities;
  }
  if (message.operation === 'native-clock') {
    assert.ok(
      Number.isSafeInteger(message.offset) &&
        message.offset >= 0 &&
        message.offset <= 30 * 86400000,
    );
    assert.ok(message.tracked.length <= 1000);
    for (const id of message.tracked) {
      assert.match(id, /^[a-f0-9-]{36}$/);
      assert.ok(message.offset >= (tracked.get(id) ?? 0));
      tracked.set(id, message.offset);
    }
    process.send({ id: message.id, result: { clockSet: true } });
  }
});
// Reuse the production HTTP fixture graph and real adapters, without HTTP controls.
await import('../session-fixture.mjs');
