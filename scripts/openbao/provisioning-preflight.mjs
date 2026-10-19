// Read-only comparison before any provisioning write. A mismatch needs review.
import { isDeepStrictEqual } from 'node:util';
export async function provisioningPreflight(provider, plan) {
  const mounts = await provider.required('sys/mounts');
  const mount = mounts.data?.[`${plan.mount}/`];
  if (mount && (mount.type !== 'kv' || mount.options?.version !== '2'))
    throw new Error('Privileged configuration review required');
  const missingPolicies = [],
    missingRoles = [];
  for (const p of plan.policies) {
    const old = await provider.call(`sys/policies/acl/${p.name}`);
    if (old.status === 404) missingPolicies.push(p);
    else if (old.status !== 200 || old.value.data?.policy !== p.policy)
      throw new Error('Privileged configuration review required');
  }
  for (const r of plan.roles) {
    const old = await provider.call(`auth/token/roles/${r.name}`);
    if (old.status === 404) {
      missingRoles.push(r);
      continue;
    }
    if (old.status !== 200 || !old.value.data)
      throw new Error('Privileged configuration review required');
    // Known API defaults add no rights. Unknown or changed fields stop rather
    // than being overwritten, even if a caller considers the difference benign.
    const defaults = {
      name: r.name,
      allowed_entity_aliases: [],
      path_suffix: '',
      token_bound_cidrs: [],
      token_num_uses: 0,
      token_no_default_policy: false,
      token_policies: [],
      token_ttl: 0,
      token_max_ttl: 0,
      token_strictly_bind_ip: false,
      explicit_max_ttl: 0,
      period: 0,
    };
    for (const [key, value] of Object.entries(old.value.data)) {
      const expected = Object.hasOwn(r.configuration, key)
        ? r.configuration[key]
        : defaults[key];
      // OpenBao 2.7.1 serializes an unset alias allow-list as null. Only this
      // known empty default is equivalent to []; nonempty/unknown rights stop.
      const actual =
        key === 'allowed_entity_aliases' && value === null ? [] : value;
      const sorted = (v) => (Array.isArray(v) ? [...v].sort() : v);
      if (
        expected === undefined ||
        !isDeepStrictEqual(sorted(actual), sorted(expected))
      )
        throw new Error('Privileged configuration review required');
    }
    for (const [key, value] of Object.entries(r.configuration))
      if (
        !isDeepStrictEqual(
          Array.isArray(value) ? [...value].sort() : value,
          Array.isArray(old.value.data[key])
            ? [...old.value.data[key]].sort()
            : old.value.data[key],
        )
      )
        throw new Error('Privileged configuration review required');
  }
  return { createMount: !mount, missingPolicies, missingRoles };
}
