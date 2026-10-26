// Approved P3-U5b read-only live consumer setup/replacement. Native named-custodian
// login only; no root recovery, material mutation, or phone delivery.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  lstatSync,
  unlinkSync,
} from 'node:fs';
import { request } from 'node:https';
import { protectedFile } from './protected-client.mjs';
import { restrictedIssuanceRule } from './restricted-issuance-rule.mjs';
import { parseCustodianPassword } from './custodian-password.mjs';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
process.umask(0o077);
const ca = readFileSync('/trust/ca.crt');
function call(path, body, token) {
  return new Promise((resolve, reject) => {
    const fail = () =>
      reject(new Error('OpenBao unavailable. Correct access and retry.'));
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
          if (Buffer.byteLength(data) > 32768) req.destroy();
        });
        res.on('error', fail);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              value: JSON.parse(data || '{}'),
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
let human;
let configurationUpdates = 0;
try {
  const [installation] = process.argv.slice(2);
  if (process.argv.length !== 3 || !uuid.test(installation ?? ''))
    throw new Error('Provide one installation UUID.');
  const output = lstatSync('/output');
  if (!output.isDirectory() || output.isSymbolicLink() || output.mode & 0o077)
    throw new Error('Use an owner-only setup custody directory.');
  const stagedFile = `/output/live-${installation}.token.new`;
  if (existsSync(stagedFile)) {
    const staged = protectedFile(stagedFile).toString('utf8').trim();
    const known = await call('auth/token/lookup-self', undefined, staged);
    if (known.status === 200) {
      if (
        JSON.stringify(known.value.data?.policies) !==
        JSON.stringify([`endpoint-live-read-${installation}`])
      )
        throw new Error(
          'Unexpected staged token identity; inspect protected custody.',
        );
      const revoked = await call('auth/token/revoke-self', {}, staged);
      if (![200, 204].includes(revoked.status))
        throw new Error(
          'Staged token revocation uncertain; retry exact reconciliation.',
        );
    } else if (known.status !== 403)
      throw new Error('Cannot reconcile staged token; provider unavailable.');
    unlinkSync(stagedFile);
  }
  const login = await call(
    'auth/platform-custodian/login/platform-owner-custodian',
    { password: parseCustodianPassword(protectedFile('/human/password', 130)) },
  );
  if (login.status !== 200 || !login.value.auth?.client_token)
    throw new Error(
      'Named custodian login denied. Check the protected password and provider availability.',
    );
  human = login.value.auth.client_token;
  const who = await call('auth/token/lookup-self', undefined, human);
  if (
    who.status !== 200 ||
    JSON.stringify(who.value.data?.policies) !==
      JSON.stringify(['platform-deployment-maintainer'])
  )
    throw new Error('Unexpected custodian authority.');
  const name = `endpoint-live-read-${installation}`;
  const prefix = `myims-trunk/data/installations/${installation}/bindings/+/generations/+`;
  const policy = [
    `path "${prefix}" { capabilities = ["read"] }`,
    `path "myims-endpoint/data/installations/${installation}/extensions/+/operations/+" { capabilities = ["read"] }`,
    'path "auth/token/lookup-self" { capabilities = ["read"] }',
    'path "auth/token/revoke-self" { capabilities = ["update"] }',
  ].join('\n');
  for (const [path, body] of [
    [`sys/policies/acl/${name}`, { policy }],
    [
      `auth/token/roles/${name}`,
      {
        allowed_policies: [name],
        disallowed_policies: ['default', 'root'],
        orphan: true,
        renewable: false,
        token_explicit_max_ttl: 86400,
        token_period: 0,
        token_type: 'service',
      },
    ],
  ]) {
    const existing = await call(path, undefined, human);
    const current = existing.value.data;
    const same =
      existing.status === 200 &&
      current &&
      Object.entries(body).every(
        ([key, value]) =>
          JSON.stringify(current[key]) === JSON.stringify(value),
      );
    if (same) continue;
    const r = await call(path, body, human);
    if (![200, 204].includes(r.status))
      throw new Error(
        'Custodian cannot install the live read-only policy/role. Existing credentials remain unchanged.',
      );
    configurationUpdates++;
  }
  const requestBody = {
    policies: [name],
    no_default_policy: true,
    ttl: '24h',
    explicit_max_ttl: '24h',
    renewable: false,
  };
  // Extend the existing restricted endpoint issuer with this single exact role.
  // Preserve its existing policy and never alter preexisting access.
  const priorPolicy = await call(
    'sys/policies/acl/endpoint-restricted-issuer',
    undefined,
    human,
  );
  if (
    priorPolicy.status !== 200 ||
    typeof priorPolicy.value.data?.policy !== 'string'
  )
    throw new Error('Cannot read existing endpoint issuer policy.');
  const addition = restrictedIssuanceRule({ name, request: requestBody });
  const oldPolicy = priorPolicy.value.data.policy;
  const beforeFile = `/output/live-issuer-policy-before-${installation}.json`;
  if (!existsSync(beforeFile))
    writeFileSync(beforeFile, JSON.stringify({ policy: oldPolicy }), {
      mode: 0o600,
      flag: 'wx',
    });
  if (!oldPolicy.includes(addition)) {
    const changed = await call(
      'sys/policies/acl/endpoint-restricted-issuer',
      { policy: `${oldPolicy}\n${addition}` },
      human,
    );
    if (![200, 204].includes(changed.status))
      throw new Error('Cannot extend restricted endpoint issuer.');
    configurationUpdates++;
  }
  const issuedIssuer = await call(
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
  if (issuedIssuer.status !== 200 || !issuedIssuer.value.auth?.client_token)
    throw new Error(
      'Named custodian cannot issue the existing fixed endpoint issuer role.',
    );
  const issuer = issuedIssuer.value.auth.client_token;
  let r;
  try {
    r = await call(`auth/token/create/${name}`, requestBody, issuer);
  } finally {
    await call('auth/token/revoke-self', {}, issuer);
  }
  if (r.status !== 200 || !r.value.auth?.client_token)
    throw new Error(
      'Setup token issuance denied; retry replacement after correcting policy/configuration.',
    );
  const token = r.value.auth.client_token;
  const issued = await call('auth/token/lookup-self', undefined, token);
  if (
    issued.status !== 200 ||
    issued.value.data.ttl < 3600 ||
    issued.value.data.ttl > 86400 ||
    issued.value.data.explicit_max_ttl !== 86400 ||
    issued.value.data.renewable !== false ||
    JSON.stringify(issued.value.data.policies) !== JSON.stringify([name])
  ) {
    await call('auth/token/revoke-self', {}, token);
    throw new Error(
      'Actual setup token authority, nonrenewable state or lifetime differs. Review role/mount limits; old service access preserved.',
    );
  }
  const file = `/output/live-${installation}.token`;
  const previous = existsSync(file)
    ? protectedFile(file).toString('utf8').trim()
    : null;
  try {
    writeFileSync(`${file}.new`, token, { mode: 0o600, flag: 'wx' });
    renameSync(`${file}.new`, file);
  } catch {
    await call('auth/token/revoke-self', {}, token);
    throw new Error(
      'Setup token persistence failed. Prior access preserved; rerun to reconcile staged custody.',
    );
  }
  if (previous) {
    const revoked = await call('auth/token/revoke-self', {}, previous);
    if (![200, 204, 403].includes(revoked.status))
      throw new Error(
        'Replacement installed; prior token revocation uncertain. Reconcile prior custody.',
      );
  }
  console.log(
    JSON.stringify({
      state: 'live_read_access_installed',
      installationId: installation,
      actualTtlSeconds: issued.value.data.ttl,
      explicitMaxTtlSeconds: issued.value.data.explicit_max_ttl,
      configurationUpdates,
    }),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (human) await call('auth/token/revoke-self', {}, human).catch(() => {});
}
