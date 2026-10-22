import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeRepository } from './repository-initialize.mjs';
const op = '00000000-0000-4000-8000-000000000001';
function fixture(fault) {
  const events = [],
    saved = [];
  let initialized = false;
  return {
    events,
    saved,
    ports: {
      prior: () => fault === 'prior',
      get: async (path, auth) => {
        events.push(['get', path, auth]);
        if (fault === 'network') throw new Error();
        if (path === '/other/config' || !auth)
          return fault === 'acl' ? 200 : 401;
        return initialized || fault === 'existing' ? 200 : 404;
      },
      save: (suffix, value) => {
        events.push(['save', suffix]);
        if (fault === 'intent' && suffix === 'started') throw new Error();
        if (fault === 'receipt' && suffix === 'complete') throw new Error();
        saved.push(value);
      },
      restic: (args) => {
        events.push(['restic', ...args]);
        if (args[0] === 'init') {
          initialized = true;
          if (fault === 'lost-init') throw new Error();
          return '';
        }
        if (args[0] === 'cat')
          return JSON.stringify({
            version: 2,
            id: fault === 'config' ? 'bad' : 'a'.repeat(64),
          });
        return fault === 'nonempty' ? '[{}]' : '[]';
      },
    },
  };
}
test('one exact init follows persisted intent and verifies config and empty snapshots', async () => {
  const f = fixture();
  const result = await initializeRepository(op, f.ports);
  assert.equal(result.status, 'repository_initialized');
  const intent = f.events.findIndex(
    ([a, b]) => a === 'save' && b === 'started',
  );
  const mutation = f.events.findIndex(
    ([a, b]) => a === 'restic' && b === 'init',
  );
  assert.ok(intent < mutation);
  assert.equal(
    f.events.filter(([a, b]) => a === 'restic' && b === 'init').length,
    1,
  );
  assert.equal(f.saved.length, 2);
});
test('existing repository, prior attempt, missing ACL, network and intent failure deny initialization', async () => {
  for (const fault of ['existing', 'prior', 'acl', 'network', 'intent']) {
    const f = fixture(fault);
    await assert.rejects(initializeRepository(op, f.ports));
    assert.equal(
      f.events.some(([a]) => a === 'restic'),
      false,
    );
    if (fault === 'prior') assert.equal(f.events.length, 0);
  }
});
test('lost mutation response, invalid config, nonempty repo and receipt failure never retry or claim completion', async () => {
  for (const fault of ['lost-init', 'config', 'nonempty', 'receipt']) {
    const f = fixture(fault);
    await assert.rejects(initializeRepository(op, f.ports));
    assert.equal(
      f.events.filter(([a, b]) => a === 'restic' && b === 'init').length,
      1,
    );
    assert.equal(f.saved.length, 1);
  }
});
