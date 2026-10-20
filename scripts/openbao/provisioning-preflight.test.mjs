import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { provisioningPlan } from './provisioning-plan.mjs';
import { provisioningPreflight } from './provisioning-preflight.mjs';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';
const plan = provisioningPlan({
  version: 1,
  installations: ['00000000-0000-4000-8000-000000000001'],
});
function provider({ policy, role, mount } = {}) {
  return {
    required: async (path) => {
      assert.equal(path, 'sys/mounts');
      return { data: mount ? { 'myims-trunk/': mount } : {} };
    },
    call: async (path, body) => {
      assert.equal(body, undefined, 'Preflight must never write');
      const p = plan.policies.find(
        (p) => path === `sys/policies/acl/${p.name}`,
      );
      if (p)
        return {
          status: 200,
          value: { data: { policy: policy === undefined ? p.policy : policy } },
        };
      const r = plan.roles.find((r) => path === `auth/token/roles/${r.name}`);
      assert.ok(r);
      return { status: 200, value: { data: { ...r.configuration, ...role } } };
    },
  };
}
test('privileged preflight preserves matching policies/roles and performs only reads', async () => {
  const checked = await provisioningPreflight(provider(), plan);
  assert.deepEqual(checked, {
    createMount: true,
    missingPolicies: [],
    missingRoles: [],
  });
});
test('unexpected policy, role privilege, unknown field or mount stops before writes', async () => {
  for (const change of [
    { policy: 'unexpected ACL' },
    { role: { allowed_policies: ['root'] } },
    { role: { token_explicit_max_ttl: 0 } },
    { role: { unexpected_privilege: true } },
    { role: { token_policies: ['default'] } },
    { role: { allowed_entity_aliases: ['*'] } },
    { mount: { type: 'kv', options: { version: '1' } } },
  ])
    await assert.rejects(
      provisioningPreflight(provider(change), plan),
      /review required/,
    );
});
test('OpenBao null and empty unset entity-alias lists preserve the same reviewed scope', async () => {
  for (const allowed_entity_aliases of [null, []]) {
    const result = await provisioningPreflight(
      provider({ role: { allowed_entity_aliases } }),
      plan,
    );
    assert.equal(result.missingPolicies.length, 0);
    assert.equal(result.missingRoles.length, 0);
  }
});
test('absent objects are returned for explicit provisioning, unavailable reads stop', async () => {
  const p = provider();
  p.call = async () => ({ status: 404 });
  const checked = await provisioningPreflight(p, plan);
  assert.equal(checked.missingPolicies.length, plan.policies.length);
  assert.equal(checked.missingRoles.length, plan.roles.length);
  p.call = async () => ({ status: 403 });
  await assert.rejects(provisioningPreflight(p, plan), /review required/);
});

test('generated complete-array policies match reviewed candidate and fixed-issuer preflight accepts exact readback', async () => {
  const reviewed = JSON.parse(
    readFileSync(
      'docs/planning/p3-u3a-token-lifetime-hardening-array-manifest.json',
      'utf8',
    ),
  );
  const generated = provisioningPlan({
    version: 1,
    installations: reviewed.installations,
  });
  const human = custodianSuccessionPlan('platform-owner-custodian');
  const policies = [
    ...generated.policies,
    { name: human.policyName, policy: human.policy },
  ];
  const roles = [...generated.roles, ...human.issuerRoles];
  for (const candidate of reviewed.policies)
    assert.equal(
      policies.find((policy) => policy.name === candidate.name).policy,
      candidate.proposedPolicy,
      candidate.name,
    );
  let mutate = (policy) => policy;
  const reads = [];
  const exactProvider = {
    required: async (path, body) => {
      assert.equal(path, 'sys/mounts');
      assert.equal(body, undefined);
      return {
        data: { 'myims-trunk/': { type: 'kv', options: { version: '2' } } },
      };
    },
    call: async (path, body) => {
      assert.equal(body, undefined, 'Preflight must never write');
      reads.push(path);
      const policy = policies.find(
        (p) => path === `sys/policies/acl/${p.name}`,
      );
      if (policy)
        return {
          status: 200,
          value: { data: { policy: mutate(policy.policy) } },
        };
      const role = roles.find((r) => path === `auth/token/roles/${r.name}`);
      assert.ok(role);
      return { status: 200, value: { data: role.configuration } };
    },
  };
  const expected = { mount: generated.mount, policies, roles };
  assert.deepEqual(await provisioningPreflight(exactProvider, expected), {
    createMount: false,
    missingPolicies: [],
    missingRoles: [],
  });
  assert.equal(reads.length, policies.length + roles.length);
  for (mutate of [
    (policy) => policy.replace(/\[\["([^"\n]+)"\]\]/g, '["$1"]'),
    (policy) => policy.replace('"24h"', '"48h"'),
    (policy) => policy + '\n',
  ])
    await assert.rejects(
      provisioningPreflight(exactProvider, expected),
      /review required/,
    );
});
