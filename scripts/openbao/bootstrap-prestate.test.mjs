import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewBootstrapPrestate } from './bootstrap-prestate.mjs';
const maintenance = JSON.parse(
  readFileSync(
    new URL(
      '../../docs/planning/p3-u3a-backup-maintenance-review.json',
      import.meta.url,
    ),
  ),
);
const hash = (v) => createHash('sha256').update(v).digest('hex');
function fixture(mutate = () => {}) {
  const candidate = {
    roles: maintenance.completeRoleConfigurationsToVerify,
    policyBaseline: { fixture: hash('policy') },
    writes: Array.from({ length: 9 }, (_, i) => ({ path: 'absent/' + i })),
  };
  const data = {
    'sys/auth': {
      'token/': { type: 'token' },
      'platform-custodian/': { type: 'userpass', accessor: 'fixture' },
    },
    'sys/policies/acl': { keys: ['fixture', 'root'] },
    'sys/policies/acl/fixture': { policy: 'policy' },
    'auth/token/roles': { keys: candidate.roles.map((r) => r.name) },
    'auth/platform-custodian/users': { keys: ['platform-owner-custodian'] },
    'auth/platform-custodian/users/platform-owner-custodian': {
      ...maintenance.rotation.userConfiguration,
      token_policies: ['platform-deployment-maintainer'],
    },
  };
  for (const role of candidate.roles)
    data['auth/token/roles/' + role.name] = {
      ...role.configuration,
      explicit_max_ttl: 0,
      name: role.name,
      path_suffix: '',
      period: 0,
      token_no_default_policy: false,
      allowed_entity_aliases: null,
    };
  mutate(data);
  const calls = [];
  return {
    candidate,
    calls,
    client: {
      call: async (path, _, method) => {
        calls.push({ path, method });
        return data[path]
          ? { status: 200, value: { data: data[path] } }
          : { status: 404, value: { errors: [] } };
      },
    },
  };
}
test('reviews full fields without exposing policy bodies, identities or credentials', async () => {
  const f = fixture();
  const result = await reviewBootstrapPrestate(f.client, f.candidate);
  assert.equal(result.entityCount, 0);
  assert.equal(result.policyCount, 1);
  assert.equal(result.prestateReviewApproved, true);
  assert.ok(f.calls.every((r) => ['GET', 'LIST'].includes(r.method)));
  assert.doesNotMatch(JSON.stringify(result), /"policy"|password|client_token/);
});
test('extra auth/user/group/policy, role aliases or policy drift stops read-only review', async () => {
  const mutations = [
    (d) => {
      d['sys/auth']['other/'] = { type: 'userpass' };
    },
    (d) => {
      d['sys/policies/acl/fixture'].policy += 'changed';
    },
    (d) => {
      d['auth/platform-custodian/users'].keys.push('extra');
    },
    (d) => {
      d['identity/group/id'] = { keys: ['group'] };
    },
    (d) => {
      d[
        'auth/token/roles/' +
          maintenance.completeRoleConfigurationsToVerify[0].name
      ].allowed_entity_aliases = ['*'];
    },
    (d) => {
      d[
        'auth/platform-custodian/users/platform-owner-custodian'
      ].token_policies.push('root');
    },
  ];
  for (const mutation of mutations) {
    const f = fixture(mutation);
    await assert.rejects(reviewBootstrapPrestate(f.client, f.candidate));
  }
});
test('entity/alias contribution must be empty and tied to the unchanged custodian', async () => {
  const id = '11111111-1111-4111-8111-111111111111',
    aliasId = '22222222-2222-4222-8222-222222222222';
  const f = fixture((d) => {
    d['identity/entity/id'] = { keys: [id] };
    d['identity/entity-alias/id'] = { keys: [aliasId] };
    d['identity/entity/id/' + id] = {
      id,
      disabled: false,
      policies: [],
      aliases: [
        {
          id: aliasId,
          name: 'platform-owner-custodian',
          mount_accessor: 'fixture',
          mount_type: 'userpass',
        },
      ],
    };
    d['identity/entity-alias/id/' + aliasId] = {
      id: aliasId,
      canonical_id: id,
      name: 'platform-owner-custodian',
      mount_accessor: 'fixture',
    };
  });
  assert.equal(
    (await reviewBootstrapPrestate(f.client, f.candidate)).entityCount,
    1,
  );
});
