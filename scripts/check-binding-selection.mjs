import assert from 'node:assert/strict';
export async function checkBindingSelection({
  request,
  root,
  path,
  one,
  two,
  trunk,
  create,
  enabled,
  save,
}) {
  const rule = async (name, priority) =>
    enabled(
      root + '/routing/outbound',
      await create(root + '/routing/outbound', {
        name,
        trunkId: trunk.id,
        pattern: {
          kind: 'exact',
          digits: '555200',
          minLength: 6,
          maxLength: 6,
        },
        priority,
        stripCount: 1,
        addPrefix: '9',
      }),
    );
  const tenantRule = await rule('Tenant permitted priority ten', 10),
    foreignRule = await rule('Foreign priority one', 1),
    fallback = await rule('Tenant lower priority twenty', 20);
  await save(one, 'outbound', tenantRule.id);
  await save(two, 'outbound', foreignRule.id);
  await save(one, 'outbound', fallback.id);
  const ordinary = await request(root + '/routing/outbound/preview', 'POST', {
    dialled: '555200',
  });
  assert.equal(ordinary.status, 200, JSON.stringify(ordinary));
  assert.equal(ordinary.data.rule.id, foreignRule.id);
  const scoped = await request(path(one, 'outbound-preview'), 'POST', {
    dialled: '555200',
  });
  assert.equal(scoped.data.reason, 'matched', JSON.stringify(scoped));
  assert.equal(scoped.data.rule.id, tenantRule.id);
  assert.equal(scoped.data.transformed, '955200');
  const other = await request(path(two, 'outbound-preview'), 'POST', {
    dialled: '555200',
  });
  assert.equal(other.data.rule.id, foreignRule.id);
  assert.equal(other.data.reason, 'matched');
  const disabled = await request(
    `${root}/routing/outbound/${tenantRule.id}/status`,
    'PATCH',
    { expectedVersion: tenantRule.version, enabled: false },
  );
  assert.equal(disabled.status, 200, JSON.stringify(disabled));
  const denial = await request(path(one, 'outbound-preview'), 'POST', {
    dialled: '555200',
  });
  assert.equal(denial.data.reason, 'disabled_rule');
  assert.equal(denial.data.rule.id, tenantRule.id);
  assert.equal(denial.data.transformed, null);
  console.log(
    'PASS binding tenant filtering before priority, unchanged node-wide selection, transforms and disabled winner without fallback',
  );
}
