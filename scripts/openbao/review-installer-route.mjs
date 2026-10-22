// One attended, read-only route review. No provisioning or alternative credentials.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { request } from 'node:https';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import {
  verifyCustodian,
  expectedCapabilities,
} from './verify-custodian-capabilities.mjs';
import { readCustodianPassword } from './custodian-password.mjs';
const login = 'auth/platform-custodian/login/platform-owner-custodian';
const hash = (text) => createHash('sha256').update(text).digest('hex');
const equal = (a, b) =>
  JSON.stringify(Array.isArray(a) ? [...a].sort() : a) ===
  JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
export function installerReviewPaths(plan) {
  return [
    ...new Set([
      ...Object.keys(expectedCapabilities),
      'sys/policies/acl/platform-raft-snapshot-reader',
      'sys/auth/platform-backup',
      'auth/platform-backup/role/platform-raft-snapshot-reader',
      'auth/platform-backup/role/platform-raft-snapshot-reader/secret-id',
      'sys/policies/acl/platform-backup-rotation',
      'auth/platform-custodian/users/platform-backup-maintainer',
      'auth/platform-custodian/users/platform-owner-custodian',
      ...plan.completeRoleConfigurationsToVerify.map(
        (r) => `auth/token/roles/${r.name}`,
      ),
    ]),
  ];
}
export async function reviewInstallerRoute(call, password, plan) {
  const paths = installerReviewPaths(plan);
  const report = {
    capabilities: [],
    roles: [],
    policies: [],
    installerEstablished: false,
    mappingsEstablished: false,
    scope: 'Named custodian only; other installer routes remain unknown',
  };
  const result = await verifyCustodian(async (path, body, token) => {
    if (path !== 'sys/capabilities-self') return call(path, body, token);
    const response = await call(path, { paths }, token);
    if (response.status !== 200) return response;
    const data = response.value?.data ?? response.value;
    const validCaps = [
      'create',
      'read',
      'update',
      'delete',
      'list',
      'sudo',
      'deny',
      'patch',
      'subscribe',
      'root',
    ];
    if (
      !paths.every(
        (p) =>
          Array.isArray(data?.[p]) &&
          data[p].length &&
          data[p].every((c) => validCaps.includes(c)),
      )
    )
      throw new Error('Invalid capability response');
    report.capabilities = paths.map((p) => ({
      path: p,
      observed: [...data[p]].sort(),
    }));
    // Stop on unexpected base authority or any new installer/mapping authority.
    // This request is scoped to reviewing the unchanged restricted custodian.
    const known = new Set(Object.keys(expectedCapabilities));
    const rolePaths = new Set(
      plan.completeRoleConfigurationsToVerify.map(
        (r) => `auth/token/roles/${r.name}`,
      ),
    );
    if (
      !paths.every((p) =>
        equal(
          data[p],
          known.has(p)
            ? expectedCapabilities[p]
            : rolePaths.has(p)
              ? p.startsWith('auth/token/roles/platform-')
                ? ['read']
                : ['create', 'read', 'update']
              : ['deny'],
        ),
      )
    )
      throw new Error('Changed authority requires reconciliation');
    for (const role of plan.completeRoleConfigurationsToVerify) {
      const read = await call(
        `auth/token/roles/${role.name}`,
        undefined,
        token,
      );
      if (
        read.status !== 200 ||
        !read.value?.data ||
        typeof read.value.data !== 'object' ||
        Array.isArray(read.value.data)
      )
        throw new Error('Role unavailable');
      const value = read.value.data;
      const keys = Object.keys(value).sort();
      if (keys.length > 64 || !keys.every((k) => /^[a-z_]{1,80}$/.test(k)))
        throw new Error('Invalid role fields');
      report.roles.push({
        name: role.name,
        responseSha256: hash(JSON.stringify(value)),
        returnedFields: keys,
        differentConfiguredFields: Object.keys(role.configuration).filter(
          (k) => !equal(value[k], role.configuration[k]),
        ),
        additionalFields: keys.filter(
          (k) => !Object.hasOwn(role.configuration, k),
        ),
      });
    }
    for (const change of plan.privilegedPolicyRemediation.filter(
      (c) => !c.path.endsWith('/platform-deployment-maintainer'),
    )) {
      const read = await call(change.path, undefined, token);
      const policy = read.value?.data?.policy;
      if (read.status !== 200 || typeof policy !== 'string')
        throw new Error('Policy unavailable');
      report.policies.push({
        path: change.path,
        currentSha256: hash(policy),
        matchesHistorical: hash(policy) === change.historicalPreStateSha256,
        matchesProposed: hash(policy) === change.policyUtf8Sha256,
      });
    }
    return response;
  }, password);
  return { ...result, routeReview: report };
}
export function installerReviewTransport(ca, plan) {
  const started = performance.now();
  const allowed = new Set([
    `POST ${login}`,
    'GET auth/token/lookup-self',
    'POST sys/capabilities-self',
    'POST auth/token/revoke-self',
    ...plan.completeRoleConfigurationsToVerify.map(
      (r) => `GET auth/token/roles/${r.name}`,
    ),
    ...plan.privilegedPolicyRemediation
      .filter((c) => !c.path.endsWith('/platform-deployment-maintainer'))
      .map((c) => `GET ${c.path}`),
  ]);
  return (path, body, token) =>
    new Promise((resolve, reject) => {
      const method = body === undefined ? 'GET' : 'POST';
      const cleanup =
        path === 'auth/token/revoke-self' || path === 'auth/token/lookup-self';
      if (
        !allowed.has(`${method} ${path}`) ||
        performance.now() - started > (cleanup ? 120000 : 60000)
      ) {
        reject(new Error('Review outside scope'));
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
          let bytes = '';
          res.on('data', (b) => {
            bytes += b;
            if (Buffer.byteLength(bytes) > 262144) req.destroy();
          });
          res.on('error', () => reject(new Error('Review unavailable')));
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                value: bytes ? JSON.parse(bytes) : {},
              });
            } catch {
              reject(new Error('Review unavailable'));
            }
          });
        },
      );
      const timer = setTimeout(() => req.destroy(), 5000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', () => reject(new Error('Review unavailable')));
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.umask(0o077);
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'review-once')
      throw new Error();
    const directory = lstatSync('/session');
    if (
      !directory.isDirectory() ||
      directory.isSymbolicLink() ||
      directory.mode & 0o077 ||
      !readFileSync('/proc/self/mountinfo', 'utf8')
        .split('\n')
        .some((l) => l.split(' ')[4] === '/session' && l.includes(' - tmpfs '))
    )
      throw new Error();
    const plan = JSON.parse(readFileSync('/plan/review.json'));
    const result = await reviewInstallerRoute(
      installerReviewTransport(readFileSync('/trust/ca.crt'), plan),
      readCustodianPassword(),
      plan,
    );
    console.log(JSON.stringify(result));
    if (
      result.state !== 'verified' ||
      result.cleanup !== 'revoked_and_denial_confirmed'
    )
      process.exitCode = 1;
  } catch {
    console.log(
      JSON.stringify({ state: 'preflight_failed', loginAttempts: 0 }),
    );
    process.exitCode = 1;
  }
}
