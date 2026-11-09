// Explicit named-custodian replacement of an EXISTING installation worker role.
// No policy/role writes, endpoint rotation, cleanup access or root recovery.
import { request } from 'node:https';
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  chownSync,
  unlinkSync,
} from 'node:fs';
import { protectedFile } from './protected-client.mjs';
import { parseCustodianPassword } from './custodian-password.mjs';
import { provisioningPlan } from './provisioning-plan.mjs';
process.umask(0o077);
const installation = process.argv[2];
const plan = provisioningPlan({ version: 1, installations: [installation] });
const role = plan.roles.find(
  (r) => r.name === `endpoint-worker-${installation}`,
);
const ca = readFileSync('/trust/ca.crt');
async function call(path, body, token) {
  return new Promise((resolve, reject) => {
    const req = request(
      `https://endpoint-secrets:8200/v1/${path}`,
      {
        ca,
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Vault-Token': token } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (b) => {
          data += b;
          if (Buffer.byteLength(data) > 65536) req.destroy();
        });
        res.on('error', reject);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              value: JSON.parse(data || '{}'),
            });
          } catch {
            reject(new Error('Provider unavailable'));
          }
        });
      },
    );
    const timer = setTimeout(() => req.destroy(), 5000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', () => reject(new Error('Provider unavailable')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
let human, issuer, issuedToken;
try {
  if (process.argv.length !== 3) throw new Error();
  const file = `/output/worker-${installation}.token`,
    staged = file + '.new';
  for (const pending of [staged, file + '.previous']) {
    if (!existsSync(pending)) continue;
    const token = protectedFile(pending).toString('utf8').trim();
    const known = await call('auth/token/lookup-self', undefined, token);
    if (
      known.status === 200 &&
      JSON.stringify(known.value.data?.policies) !== JSON.stringify([role.name])
    )
      throw new Error();
    if (
      known.status !== 403 &&
      (known.status !== 200 ||
        ![200, 204].includes(
          (await call('auth/token/revoke-self', {}, token)).status,
        ))
    )
      throw new Error();
    unlinkSync(pending);
  }
  const login = await call(
    'auth/platform-custodian/login/platform-owner-custodian',
    { password: parseCustodianPassword(protectedFile('/human/password', 130)) },
  );
  if (login.status !== 200 || !login.value.auth?.client_token)
    throw new Error();
  human = login.value.auth.client_token;
  const who = await call('auth/token/lookup-self', undefined, human);
  if (
    who.status !== 200 ||
    JSON.stringify(who.value.data?.policies) !==
      JSON.stringify(['platform-deployment-maintainer'])
  )
    throw new Error();
  const expectedPolicy = plan.policies.find((p) => p.name === role.name);
  const installedPolicy = await call(
    'sys/policies/acl/' + role.name,
    undefined,
    human,
  );
  if (
    installedPolicy.status !== 200 ||
    installedPolicy.value.data?.policy !== expectedPolicy.policy
  )
    throw new Error();
  const existing = await call(
    'auth/token/roles/' + role.name,
    undefined,
    human,
  );
  if (
    existing.status !== 200 ||
    !Object.entries(role.configuration).every(
      ([k, v]) =>
        JSON.stringify(existing.value.data?.[k]) === JSON.stringify(v),
    )
  )
    throw new Error();
  const grant = await call(
    'auth/token/create/platform-endpoint-issuer',
    {
      policies: ['endpoint-restricted-issuer'],
      no_default_policy: true,
      ttl: '24h',
      explicit_max_ttl: '24h',
      renewable: false,
    },
    human,
  );
  if (grant.status !== 200 || !grant.value.auth?.client_token)
    throw new Error();
  issuer = grant.value.auth.client_token;
  const issued = await call(
    'auth/token/create/' + role.name,
    role.request,
    issuer,
  );
  if (issued.status !== 200 || !issued.value.auth?.client_token)
    throw new Error();
  issuedToken = issued.value.auth.client_token;
  const checked = await call('auth/token/lookup-self', undefined, issuedToken),
    v = checked.value.data;
  if (
    checked.status !== 200 ||
    JSON.stringify(v?.policies) !== JSON.stringify([role.name]) ||
    !Number.isSafeInteger(v.ttl) ||
    v.ttl < 60 ||
    v.ttl > 3600 ||
    v.explicit_max_ttl !== 86400 ||
    v.renewable !== true
  )
    throw new Error();
  const previous = existsSync(file)
    ? protectedFile(file).toString('utf8').trim()
    : null;
  writeFileSync(staged, issuedToken, { mode: 0o600, flag: 'wx' });
  chownSync(staged, 1003, 1003);
  if (previous) {
    writeFileSync(file + '.previous', previous, { mode: 0o600, flag: 'wx' });
    chownSync(file + '.previous', 1003, 1003);
  }
  renameSync(staged, file);
  issuedToken = null;
  if (
    previous &&
    ![200, 204, 403].includes(
      (await call('auth/token/revoke-self', {}, previous)).status,
    )
  )
    throw new Error();
  if (previous) unlinkSync(file + '.previous');
  console.log(
    JSON.stringify({
      state: 'worker_access_available',
      installationId: installation,
      configurationUpdates: 0,
      actualTtlSeconds: v.ttl,
    }),
  );
} catch {
  console.error(
    'Scoped worker access unavailable; inspect exact role, named custody and staged token before retry.',
  );
  process.exitCode = 2;
} finally {
  for (const token of [issuedToken, issuer, human].filter(Boolean)) {
    let revoked = false;
    try {
      revoked = [200, 204, 403].includes(
        (await call('auth/token/revoke-self', {}, token)).status,
      );
    } catch {
      /* Keep cleanup uncertainty visible without replacing the main failure. */
    }
    if (!revoked) {
      console.error(
        'Temporary scoped access revocation unresolved; inspect named custody before further issuance.',
      );
      process.exitCode = 2;
    }
  }
}
