// Explicit attended verification only; never called by startup or workers.
import { request } from 'node:https';
import { readFileSync, lstatSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readCustodianPassword } from './custodian-password.mjs';

const username = 'platform-owner-custodian';
const loginPath = `auth/platform-custodian/login/${username}`;
const policy = 'platform-deployment-maintainer';
export const expectedCapabilities = Object.freeze({
  'sys/storage/raft/snapshot': ['deny'],
  'sys/policies/acl/platform-deployment-maintainer': ['deny'],
  'sys/policies/acl/endpoint-restricted-issuer': ['create', 'read', 'update'],
  'sys/policies/acl/trunk-restricted-issuer': ['create', 'read', 'update'],
  'sys/policies/acl': ['list'],
  'auth/token/roles': ['list'],
  'sys/auth': ['read'],
  'identity/entity/id': ['deny'],
  'identity/group/id': ['deny'],
  'auth/token/accessors': ['list', 'sudo'],
});
const sameSet = (value, expected) =>
  Array.isArray(value) &&
  JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort());

// All errors and provider data are reduced to allowlisted facts here. No retry.
export async function verifyCustodian(call, password) {
  const result = {
    principal: username,
    mechanism: 'platform-custodian/userpass',
    startedAt: new Date().toISOString(),
    state: 'stopped',
    stage: 'login',
    loginAttempts: 1,
    capabilityBatches: 0,
    identityChecks: {},
    capabilities: [],
    differences: [],
    cleanup: 'login_result_uncertain',
    backupAuthorityAvailability: 'unknown',
  };
  let token;
  try {
    const login = await call(loginPath, { password });
    token = login.value?.auth?.client_token;
    if (typeof token !== 'string' || !token) {
      token = undefined;
      result.differences.push('login_rejected_or_missing_session');
      return result;
    }
    result.cleanup = 'pending';
    const auth = login.value.auth;
    if (
      login.status !== 200 ||
      !sameSet(auth.policies, [policy]) ||
      !sameSet(auth.token_policies, [policy]) ||
      !sameSet(auth.identity_policies ?? [], []) ||
      auth.metadata?.username !== username ||
      !Number.isInteger(auth.lease_duration) ||
      auth.lease_duration < 1 ||
      auth.lease_duration > 900
    ) {
      result.differences.push('unexpected_login_attributes');
      return result;
    }
    result.stage = 'self_lookup';
    const self = await call('auth/token/lookup-self', undefined, token);
    const d = self.value?.data;
    const checks = {
      lookupSucceeded: self.status === 200,
      expectedUsername: d?.meta?.username === username,
      expectedLoginPath: d?.path === loginPath,
      expectedDisplayName: d?.display_name === `platform-custodian-${username}`,
      expectedPolicies: sameSet(d?.policies, [policy]),
      noIdentityPolicies: sameSet(d?.identity_policies ?? [], []),
      noPeriod: d?.period === undefined || d.period === 0,
      orphan: d?.orphan === true,
      serviceToken: d?.type === 'service',
      unlimitedUses: d?.num_uses === 0,
      boundedTTL: Number.isInteger(d?.ttl) && d.ttl >= 1 && d.ttl <= 900,
      boundedCreationTTL: d?.creation_ttl === 900,
      explicitMaximum900: d?.explicit_max_ttl === 900,
    };
    result.identityChecks = checks;
    for (const [name, passed] of Object.entries(checks))
      if (!passed) result.differences.push(name);
    if (result.differences.length) return result;
    result.session = {
      policies: [policy],
      identityPolicies: [],
      period: 0,
      ttlSeconds: d.ttl,
      creationTTLSeconds: d.creation_ttl,
      explicitMaximumSeconds: d.explicit_max_ttl,
      renewable: d.renewable === true,
    };
    result.stage = 'capability_batch';
    result.capabilityBatches = 1;
    const response = await call(
      'sys/capabilities-self',
      {
        paths: Object.keys(expectedCapabilities),
      },
      token,
    );
    if (response.status !== 200) {
      result.differences.push('capability_query_rejected');
      return result;
    }
    const allowed = new Set([
      'deny',
      'create',
      'read',
      'update',
      'delete',
      'list',
      'sudo',
      'patch',
      'subscribe',
      'root',
    ]);
    for (const [path, expected] of Object.entries(expectedCapabilities)) {
      const observed = response.value?.data?.[path] ?? response.value?.[path];
      const valid =
        Array.isArray(observed) &&
        observed.length > 0 &&
        observed.every((c) => allowed.has(c));
      const matches = valid && sameSet(observed, expected);
      result.capabilities.push({
        path,
        expected,
        observed: valid ? observed : 'invalid_response',
        matches,
      });
      if (!matches) result.differences.push(`capability_mismatch:${path}`);
    }
    result.state = result.differences.length ? 'stopped' : 'verified';
  } catch {
    result.differences.push('request_failed_or_uncertain');
  } finally {
    if (token) {
      // Attempt cleanup even when identity/privilege validation failed. Exactly
      // one revoke and one confirmation; denial without acknowledgement is uncertain.
      let acknowledged = false;
      let denied = false;
      try {
        const revoked = await call('auth/token/revoke-self', {}, token);
        acknowledged = [200, 204].includes(revoked.status);
      } catch {
        /* Still perform the single denial check. */
      }
      try {
        denied =
          (await call('auth/token/lookup-self', undefined, token)).status ===
          403;
      } catch {
        /* Preserve uncertainty. */
      }
      result.cleanup =
        acknowledged && denied ? 'revoked_and_denial_confirmed' : 'uncertain';
      if (result.cleanup === 'uncertain') result.state = 'stopped';
    }
    result.finishedAt = new Date().toISOString();
  }
  return result;
}

function transport(ca) {
  return (path, body, token) =>
    new Promise((resolve, reject) => {
      const fail = () => reject(new Error('Protected request unavailable'));
      const req = request(
        `https://endpoint-secrets:8200/v1/${path}`,
        {
          method: body === undefined ? 'GET' : 'POST',
          ca,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Vault-Token': token } : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (bytes) => {
            data += bytes;
            if (Buffer.byteLength(data) > 32768) req.destroy();
          });
          res.on('error', fail);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                value: data ? JSON.parse(data) : {},
              });
            } catch {
              fail();
            }
          });
        },
      );
      const timer = setTimeout(() => req.destroy(), 5000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', fail);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.umask(0o077);
  let stage = 'arguments';
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'verify-once')
      throw new Error();
    stage = 'isolated_session_mount';
    const directory = lstatSync('/session');
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      directory.mode & 0o077 ||
      !readFileSync('/proc/self/mountinfo', 'utf8')
        .split('\n')
        .some(
          (line) =>
            line.split(' ')[4] === '/session' && line.includes(' - tmpfs '),
        )
    )
      throw new Error();
    stage = 'exact_protected_inputs';
    const ca = readFileSync('/trust/ca.crt');
    stage = 'documented_password_format';
    const password = readCustodianPassword();
    const result = await verifyCustodian(transport(ca), password);
    console.log(JSON.stringify(result));
    if (
      result.state !== 'verified' ||
      result.cleanup !== 'revoked_and_denial_confirmed'
    )
      process.exitCode = 1;
  } catch {
    console.log(
      JSON.stringify({
        state: 'preflight_failed',
        stage,
        loginAttempts: 0,
        cleanup: 'no_session_requested',
      }),
    );
    process.exitCode = 1;
  }
}
