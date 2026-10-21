// Explicit owner-approved names-only authority review only; never called by startup or workers.
import { request } from 'node:https';
import { performance } from 'node:perf_hooks';
import { readFileSync, lstatSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readCustodianPassword } from './custodian-password.mjs';

const username = 'platform-owner-custodian';
const loginPath = `auth/platform-custodian/login/${username}`;
const policy = 'platform-deployment-maintainer';
const sameSet = (value, expected) =>
  Array.isArray(value) &&
  JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort());

// All errors and provider data are reduced to allowlisted facts here. No retry.
export async function reviewAuthority(call, password) {
  const result = {
    principal: username,
    mechanism: 'platform-custodian/userpass',
    startedAt: new Date().toISOString(),
    state: 'stopped',
    stage: 'login',
    loginAttempts: 1,
    metadataRequests: 0,
    metadata: {},
    identityChecks: {},
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
    const operations = [
      ['authMounts', 'sys/auth', 'GET'],
      ['policyNames', 'sys/policies/acl', 'LIST'],
      ['tokenRoleNames', 'auth/token/roles', 'LIST'],
    ];
    const safeName = (value) =>
      typeof value === 'string' &&
      /^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,255}$/.test(value) &&
      !value.includes('..');
    for (const [kind, path, method] of operations) {
      result.stage = kind;
      result.metadataRequests++;
      const response = await call(path, undefined, token, method);
      // Native OpenBao returns 404/errors=[] for an empty token-role list.
      if (
        kind === 'tokenRoleNames' &&
        response.status === 404 &&
        Array.isArray(response.value?.errors) &&
        response.value.errors.length === 0 &&
        Object.keys(response.value).every((key) => key === 'errors')
      ) {
        result.metadata[kind] = [];
        continue;
      }
      if (response.status !== 200) throw new Error('Metadata unavailable');
      const data = response.value?.data;
      if (kind === 'authMounts') {
        if (!data || Array.isArray(data) || typeof data !== 'object')
          throw new Error();
        const entries = Object.entries(data);
        if (
          entries.length > 128 ||
          !entries.every(
            ([name, value]) => safeName(name) && safeName(value?.type),
          )
        )
          throw new Error();
        result.metadata[kind] = entries
          .map(([name, value]) => ({ name, type: value.type }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } else {
        if (
          !Array.isArray(data?.keys) ||
          data.keys.length > 128 ||
          !data.keys.every(safeName)
        )
          throw new Error();
        result.metadata[kind] = [...new Set(data.keys)].sort();
      }
    }
    result.state = 'reviewed';
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
  const started = performance.now();
  const allowed = new Set([
    `POST ${loginPath}`,
    'GET auth/token/lookup-self',
    'GET sys/auth',
    'LIST sys/policies/acl',
    'LIST auth/token/roles',
    'POST auth/token/revoke-self',
  ]);
  return (path, body, token, method = body === undefined ? 'GET' : 'POST') =>
    new Promise((resolve, reject) => {
      const fail = () => reject(new Error('Protected request unavailable'));
      const cleanup =
        path === 'auth/token/revoke-self' ||
        (path === 'auth/token/lookup-self' && token);
      if (
        !allowed.has(`${method} ${path}`) ||
        performance.now() - started > (cleanup ? 120000 : 60000)
      ) {
        fail();
        return;
      }
      const req = request(
        `https://endpoint-secrets:8200/v1/${path}`,
        {
          method,
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
    if (process.argv.length !== 3 || process.argv[2] !== 'review-once')
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
    const result = await reviewAuthority(transport(ca), password);
    console.log(JSON.stringify(result));
    if (
      result.state !== 'reviewed' ||
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
