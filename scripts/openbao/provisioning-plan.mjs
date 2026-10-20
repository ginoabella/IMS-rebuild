// Pure deployment plan. No token, material, network call or root-recovery operation.
import { restrictedIssuanceRule } from './restricted-issuance-rule.mjs';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const self = `path "auth/token/lookup-self" { capabilities = ["read"] }
path "auth/token/renew-self" { capabilities = ["update"] }
path "auth/token/revoke-self" { capabilities = ["update"] }`;
export function provisioningPlan(input) {
  if (
    !input ||
    Object.keys(input).sort().join(',') !== 'installations,version' ||
    input.version !== 1 ||
    !Array.isArray(input.installations) ||
    !input.installations.length ||
    input.installations.length > 64 ||
    input.installations.some((x) => typeof x !== 'string' || !uuid.test(x)) ||
    new Set(input.installations).size !== input.installations.length
  )
    throw new Error('Invalid exact provisioning manifest');
  const policies = [],
    roles = [];
  for (const installation of [...input.installations].sort()) {
    for (const lifecycle of ['endpoint', 'trunk']) {
      const data =
        lifecycle === 'endpoint'
          ? `myims-endpoint/data/installations/${installation}/extensions/+/operations/+`
          : `myims-trunk/data/installations/${installation}/bindings/+/generations/+`;
      for (const principal of lifecycle === 'endpoint'
        ? ['worker', 'cleanup']
        : ['importer', 'verifier', 'cleanup']) {
        const name = `${lifecycle}-${principal}-${installation}`;
        const rule =
          principal === 'cleanup'
            ? `path "${data}" { capabilities = ["read"] }\npath "${data.replace('/data/', '/metadata/')}" { capabilities = ["read"] }\npath "${data.replace('/data/', '/destroy/')}" { capabilities = ["update"] }`
            : `path "${data}" { capabilities = [${principal === 'worker' || principal === 'importer' ? '"create", ' : ''}"read"] }`;
        policies.push({ name, policy: `${rule}\n${self}` });
        roles.push({
          name,
          configuration: {
            allowed_policies: [name],
            disallowed_policies: ['default', 'root'],
            allowed_policies_glob: [],
            disallowed_policies_glob: [],
            orphan: true,
            renewable: true,
            token_explicit_max_ttl: 86400,
            token_period: 0,
            token_type: 'service',
          },
          request: {
            policies: [name],
            no_default_policy: true,
            ttl: '1h',
            explicit_max_ttl: '24h',
            renewable: true,
          },
        });
      }
    }
  }
  // Acceptance-only one-second lease uses the SAME endpoint worker material policy.
  for (const installation of [...input.installations].sort())
    roles.push({
      name: `endpoint-worker-expiring-${installation}`,
      configuration: {
        allowed_policies: [`endpoint-worker-${installation}`],
        disallowed_policies: ['default', 'root'],
        allowed_policies_glob: [],
        disallowed_policies_glob: [],
        orphan: true,
        renewable: false,
        token_explicit_max_ttl: 1,
        token_period: 0,
        token_type: 'service',
      },
      request: {
        policies: [`endpoint-worker-${installation}`],
        no_default_policy: true,
        ttl: '1s',
        explicit_max_ttl: '1s',
        renewable: false,
      },
    });
  for (const lifecycle of ['endpoint', 'trunk']) {
    policies.push({
      name: `${lifecycle}-restricted-issuer`,
      policy: roles
        .filter((x) => x.name.startsWith(`${lifecycle}-`))
        .map(restrictedIssuanceRule)
        .concat(self)
        .join('\n'),
    });
  }
  return {
    version: 1,
    installations: [...input.installations].sort(),
    mount: 'myims-trunk',
    policies,
    roles,
    issuerRequest: (lifecycle) => ({
      policies: [`${lifecycle}-restricted-issuer`],
      no_parent: true,
      no_default_policy: true,
      ttl: '24h',
      explicit_max_ttl: '24h',
      renewable: false,
    }),
  };
}
