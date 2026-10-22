// Read-only semantic review for the exact bootstrap. No policy/auth/material writes.
import { createHash } from 'node:crypto';
const hash = (v) => createHash('sha256').update(v).digest('hex');
const same = (a, b) =>
  JSON.stringify(Array.isArray(a) ? [...a].sort() : a) ===
  JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
const empty = (v) =>
  v === undefined || v === null || (Array.isArray(v) && v.length === 0);
export async function reviewBootstrapPrestate(client, candidate) {
  if (
    !candidate.policyBaseline ||
    Object.keys(candidate.policyBaseline).length > 128 ||
    candidate.roles?.length !== 14
  )
    throw new Error('Baseline refused');
  const reads = [];
  const read = async (path, method = 'GET', absent = false) => {
    if (reads.length >= 128 || !/^[a-zA-Z0-9/_-]+$/.test(path))
      throw new Error('Review bound exceeded');
    const r = await client.call(path, undefined, method);
    if (absent ? r.status !== 404 : r.status !== 200)
      throw new Error('Review status mismatch');
    const data = r.value?.data ?? null;
    reads.push({
      path,
      method,
      status: r.status,
      responseSha256: hash(JSON.stringify(data)),
    });
    return data;
  };
  const list = async (path, expected) => {
    const r = await client.call(path, undefined, 'LIST');
    if (
      ![200, 404].includes(r.status) ||
      (r.status === 404 &&
        (!Array.isArray(r.value?.errors) || r.value.errors.length))
    )
      throw new Error('List unavailable');
    const keys = r.status === 404 ? [] : r.value?.data?.keys;
    if (
      !Array.isArray(keys) ||
      keys.length > 128 ||
      !keys.every(
        (k) => typeof k === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(k),
      )
    )
      throw new Error('List malformed');
    if (expected && !same(keys, expected))
      throw new Error('Unexpected principal or resource');
    reads.push({
      path,
      method: 'LIST',
      status: r.status,
      responseSha256: hash(JSON.stringify(r.value?.data ?? null)),
    });
    return keys;
  };
  const auth = await read('sys/auth');
  if (
    !same(Object.keys(auth), ['token/', 'platform-custodian/']) ||
    auth['token/'].type !== 'token' ||
    auth['platform-custodian/'].type !== 'userpass'
  )
    throw new Error('Auth composition changed');
  await list('sys/policies/acl', [
    ...Object.keys(candidate.policyBaseline),
    'root',
  ]);
  for (const [name, expected] of Object.entries(candidate.policyBaseline)) {
    const data = await read('sys/policies/acl/' + name);
    if (typeof data?.policy !== 'string' || hash(data.policy) !== expected)
      throw new Error('Policy baseline changed');
  }
  await list(
    'auth/token/roles',
    candidate.roles.map((r) => r.name),
  );
  for (const role of candidate.roles) {
    const data = await read('auth/token/roles/' + role.name);
    const aliases = {
      explicit_max_ttl: 0,
      name: role.name,
      path_suffix: '',
      period: 0,
      token_no_default_policy: false,
    };
    const known = [
      ...Object.keys(role.configuration),
      ...Object.keys(aliases),
      'allowed_entity_aliases',
    ];
    if (
      !same(Object.keys(data), known) ||
      !empty(data.allowed_entity_aliases) ||
      Object.entries({ ...role.configuration, ...aliases }).some(
        ([k, v]) => !same(data[k], v),
      )
    )
      throw new Error('Role or alias changed');
  }
  await list('auth/platform-custodian/users', ['platform-owner-custodian']);
  const user = await read(
    'auth/platform-custodian/users/platform-owner-custodian',
  );
  const expectedUser = {
    token_policies: ['platform-deployment-maintainer'],
    token_ttl: 900,
    token_max_ttl: 900,
    token_explicit_max_ttl: 900,
    token_no_default_policy: true,
    token_period: 0,
    token_type: 'service',
    token_num_uses: 0,
  };
  if (
    Object.entries(expectedUser).some(([k, v]) => !same(user[k], v)) ||
    (user.policies !== undefined &&
      !same(user.policies, expectedUser.token_policies)) ||
    !empty(user.token_bound_cidrs)
  )
    throw new Error('Custodian mapping changed');
  await list('identity/group/id', []);
  await list('identity/group-alias/id', []);
  const entities = await list('identity/entity/id');
  if (entities.length > 1) throw new Error('Unexpected entity');
  const aliasIds = [];
  for (const id of entities) {
    const e = await read('identity/entity/id/' + id);
    if (
      e.id !== id ||
      e.disabled !== false ||
      !empty(e.policies) ||
      !empty(e.direct_group_ids) ||
      !empty(e.inherited_group_ids) ||
      !empty(e.group_ids) ||
      !Array.isArray(e.aliases) ||
      e.aliases.length !== 1
    )
      throw new Error('Entity authority changed');
    const alias = e.aliases[0];
    if (
      alias.name !== 'platform-owner-custodian' ||
      alias.mount_accessor !== auth['platform-custodian/'].accessor ||
      alias.mount_type !== 'userpass' ||
      !/^[a-f0-9-]{36}$/.test(alias.id)
    )
      throw new Error('Entity alias changed');
    aliasIds.push(alias.id);
    const a = await read('identity/entity-alias/id/' + alias.id);
    if (
      a.id !== alias.id ||
      a.canonical_id !== id ||
      a.name !== alias.name ||
      a.mount_accessor !== alias.mount_accessor
    )
      throw new Error('Alias mapping changed');
  }
  await list('identity/entity-alias/id', aliasIds);
  for (const i of [3, 5, 7, 8])
    await read(candidate.writes[i].path, 'GET', true);
  return {
    prestateReads: reads,
    prestateReviewApproved: true,
    reviewDigest: hash(JSON.stringify(reads)),
    entityCount: entities.length,
    policyCount: Object.keys(candidate.policyBaseline).length,
  };
}
