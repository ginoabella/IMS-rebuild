import test from 'node:test';
import assert from 'node:assert/strict';
import { provisioningPlan } from './provisioning-plan.mjs';
import { provisioningPreflight } from './provisioning-preflight.mjs';
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
