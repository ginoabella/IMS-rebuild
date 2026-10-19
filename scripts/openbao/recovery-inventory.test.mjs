import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRecoveryInventory } from './recovery-inventory.mjs';

test('privilege review rejects extra authorities, changed baseline ACLs and unknown leases', () => {
  const expected = {
    defaultPolicy: 'pristine pinned-image default policy',
    legacyAdministratorPolicy: 'reviewed legacy administrator policy',
  };
  const inventory = {
    operationId: 'fixture-operation',
    self: { accessor: 'fixture-root-accessor' },
    auth: { 'token/': { type: 'token' } },
    mounts: {
      'myims-endpoint/': { type: 'kv', options: { version: '2' } },
      'cubbyhole/': { type: 'cubbyhole' },
      'identity/': { type: 'identity' },
      'sys/': { type: 'system' },
    },
    roles: {},
    policies: {
      default: { policy: expected.defaultPolicy },
      'endpoint-development-admin': {
        policy: expected.legacyAdministratorPolicy,
      },
    },
    tokens: [{ accessor: 'fixture-root-accessor', policies: ['root'] }],
    leases: [],
  };
  assert.equal(
    reviewRecoveryInventory(inventory, expected).unexpectedPrincipalsRemediated,
    false,
  );
  for (const mutate of [
    (v) => (v.auth['unknown/'] = { type: 'userpass' }),
    (v) => (v.mounts['unexpected/'] = { type: 'kv' }),
    (v) => (v.roles.unreviewed = {}),
    (v) => (v.policies.default.policy = 'changed'),
    (v) => (v.policies['endpoint-development-admin'].policy = 'changed'),
    (v) => (v.policies['unreviewed-admin'] = { policy: 'extra' }),
    (v) => v.tokens.push({ accessor: 'another-root', policies: ['root'] }),
    (v) => v.tokens.push({ policies: ['default'], orphan: true }),
    (v) => (v.tokens[0].identity_policies = ['unreviewed']),
    (v) => v.leases.push({ id: 'unreviewed/database/lease' }),
  ]) {
    const value = JSON.parse(JSON.stringify(inventory));
    mutate(value);
    assert.throws(
      () => reviewRecoveryInventory(value, expected),
      /separate review required/,
    );
  }
});
