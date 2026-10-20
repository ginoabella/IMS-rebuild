// Reviewable non-secret native human-auth plan; importing this never contacts OpenBao.
import { restrictedIssuanceRule } from './restricted-issuance-rule.mjs';
export function custodianSuccessionPlan(username) {
  if (
    typeof username !== 'string' ||
    !/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username) ||
    username.endsWith('.')
  )
    throw new Error('Invalid named custodian');
  const policyName = 'platform-deployment-maintainer';
  const rule = (path, capabilities) =>
    `path "${path}" { capabilities = [${capabilities.map((c) => JSON.stringify(c)).join(', ')}] }`;
  const issuerRoles = ['endpoint', 'trunk'].map((lifecycle) => ({
    name: `platform-${lifecycle}-issuer`,
    configuration: {
      allowed_policies: [`${lifecycle}-restricted-issuer`],
      disallowed_policies: ['default', 'root'],
      allowed_policies_glob: [],
      disallowed_policies_glob: [],
      orphan: true,
      renewable: false,
      token_explicit_max_ttl: 86400,
      token_period: 0,
      token_type: 'service',
    },
    request: {
      policies: [`${lifecycle}-restricted-issuer`],
      no_default_policy: true,
      ttl: '24h',
      explicit_max_ttl: '24h',
      renewable: false,
    },
  }));
  const policy = [
    rule('auth/token/lookup-self', ['read']),
    rule('sys/capabilities-self', ['update']),
    rule('auth/token/revoke-self', ['update']),
    rule('sys/mounts', ['read']),
    rule('sys/auth', ['read']),
    rule('sys/policies/acl', ['list']),
    rule('auth/token/roles', ['list']),
    rule('auth/token/accessors', ['list', 'sudo']),
    rule('auth/token/lookup-accessor', ['update']),
    rule('auth/token/revoke-accessor', ['update']),
    ...['endpoint', 'trunk'].flatMap((lifecycle) => [
      rule(`sys/policies/acl/${lifecycle}-*`, ['create', 'read', 'update']),
      rule(`auth/token/roles/${lifecycle}-*`, ['create', 'read', 'update']),
      restrictedIssuanceRule(
        issuerRoles.find(
          (role) => role.name === `platform-${lifecycle}-issuer`,
        ),
      ),
      rule(`auth/token/roles/platform-${lifecycle}-issuer`, ['read']),
    ]),
    rule(`auth/platform-custodian/users/${username}/password`, ['update']),
    rule(`sys/policies/acl/${policyName}`, ['deny']),
    rule('auth/token/create', ['deny']),
    rule('auth/token/create-orphan', ['deny']),
    rule('sys/generate-root/*', ['deny']),
  ].join('\n');
  return {
    version: 1,
    username,
    authMount: 'platform-custodian',
    authType: 'userpass',
    policyName,
    policy,
    issuerRoles,
    userConfiguration: {
      token_policies: [policyName],
      token_ttl: 900,
      token_max_ttl: 900,
      token_explicit_max_ttl: 900,
      token_no_default_policy: true,
      token_period: 0,
      token_type: 'service',
      token_num_uses: 0,
    },
  };
}
