// Offline fail-closed review. It cannot alter or remediate provider configuration.
import { provisioningPlan } from './provisioning-plan.mjs';

export function reviewRecoveryInventory(inventory, expected) {
  const fail = () => {
    throw new Error(
      'Unexpected privileged inventory; separate review required',
    );
  };
  if (
    JSON.stringify(Object.keys(inventory.auth ?? {}).sort()) !==
      JSON.stringify(['token/']) ||
    inventory.auth['token/'].type !== 'token' ||
    JSON.stringify(Object.keys(inventory.mounts ?? {}).sort()) !==
      JSON.stringify(['cubbyhole/', 'identity/', 'myims-endpoint/', 'sys/']) ||
    inventory.mounts['myims-endpoint/'].type !== 'kv' ||
    inventory.mounts['myims-endpoint/'].options?.version !== '2' ||
    inventory.mounts['cubbyhole/'].type !== 'cubbyhole' ||
    inventory.mounts['identity/'].type !== 'identity' ||
    inventory.mounts['sys/'].type !== 'system' ||
    Object.keys(inventory.roles ?? {}).length ||
    inventory.policies?.default?.policy !== expected.defaultPolicy ||
    inventory.policies?.['endpoint-development-admin']?.policy !==
      expected.legacyAdministratorPolicy
  )
    fail();
  const known = new Set(['default', 'endpoint-development-admin']);
  for (const [name, value] of Object.entries(inventory.policies)) {
    if (known.has(name)) continue;
    const match =
      /^endpoint-(worker|cleanup)-([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?:-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})?$/.exec(
        name,
      );
    if (!match) fail();
    const policy = provisioningPlan({
      version: 1,
      installations: [match[2]],
    }).policies.find((p) => p.name === `endpoint-${match[1]}-${match[2]}`);
    if (value.policy !== policy.policy) fail();
    known.add(name);
  }
  const administrators = [];
  let roots = 0;
  if (!Array.isArray(inventory.tokens) || !Array.isArray(inventory.leases))
    fail();
  for (const token of inventory.tokens) {
    if ((token.identity_policies?.length ?? 0) !== 0) fail();
    if (JSON.stringify(token.policies) === JSON.stringify(['root'])) {
      roots++;
      if (token.accessor !== inventory.self.accessor) fail();
      continue;
    }
    if (
      token.policies?.length !== 1 ||
      !known.has(token.policies[0]) ||
      token.policies[0] === 'default' ||
      token.orphan !== true ||
      token.explicit_max_ttl !== 86400 ||
      token.period ||
      token.type !== 'service'
    )
      fail();
    if (token.policies[0] === 'endpoint-development-admin') {
      if (token.renewable !== false) fail();
      administrators.push(token.accessor);
    } else if (token.renewable !== true) fail();
  }
  if (
    roots !== 1 ||
    inventory.leases.some(
      (lease) => !lease.id?.startsWith('auth/token/create/'),
    ) ||
    inventory.leases.length > inventory.tokens.length - 1
  )
    fail();
  return {
    operationId: inventory.operationId,
    legacyAdministratorAccessors: administrators,
    policyCount: Object.keys(inventory.policies).length,
    tokenCount: inventory.tokens.length,
    leaseCount: inventory.leases.length,
    unexpectedPrincipalsRemediated: false,
  };
}
