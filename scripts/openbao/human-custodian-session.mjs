// Explicit human maintenance only. Never invoked by startup, issuers or workers.
import { request } from 'node:https';
import {
  readFileSync,
  lstatSync,
  existsSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { protectedFile, ProtectedBaoClient } from './protected-client.mjs';
process.umask(0o077);
const username = 'platform-owner-custodian';
let stage = 'session_custody',
  knownToken = false,
  revokedOnPersistenceFailure = false;
async function bao(ca, path, body, token) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Human login unavailable'));
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
        let responseBody = '';
        res.on('data', (bytes) => {
          responseBody += bytes;
          if (Buffer.byteLength(responseBody) > 32768) req.destroy();
        });
        res.on('error', fail);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              value: responseBody ? JSON.parse(responseBody) : {},
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
try {
  const [action] = process.argv.slice(2);
  if (process.argv.length !== 3 || !['open', 'close'].includes(action))
    throw new Error();
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
  const tokenFile = '/session/custodian.token',
    accessorFile = '/session/custodian.accessor';
  if (action === 'open') {
    if (existsSync(tokenFile) || existsSync(accessorFile)) throw new Error();
    stage = 'human_login';
    const password = protectedFile('/human/password', 128).toString('utf8');
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(password)) throw new Error();
    const ca = readFileSync('/trust/ca.crt');
    const response = await bao(
      ca,
      `auth/platform-custodian/login/${username}`,
      { password },
    );
    if (response.status !== 200) throw new Error();
    const login = response.value;
    if (
      typeof login.auth?.client_token !== 'string' ||
      typeof login.auth.accessor !== 'string'
    )
      throw new Error();
    knownToken = true;
    // Exclusive writes never replace another concurrent session's files.
    let wroteAccessor = false,
      wroteToken = false;
    try {
      writeFileSync(accessorFile, login.auth.accessor, {
        mode: 0o600,
        flag: 'wx',
      });
      wroteAccessor = true;
      writeFileSync(tokenFile, login.auth.client_token, {
        mode: 0o600,
        flag: 'wx',
      });
      wroteToken = true;
    } catch {
      const revoked = await bao(
        ca,
        'auth/token/revoke-self',
        {},
        login.auth.client_token,
      );
      if (
        ![200, 204].includes(revoked.status) ||
        (
          await bao(
            ca,
            'auth/token/lookup-self',
            undefined,
            login.auth.client_token,
          )
        ).status !== 403
      )
        throw new Error();
      revokedOnPersistenceFailure = true;
      if (wroteToken) unlinkSync(tokenFile);
      if (wroteAccessor) unlinkSync(accessorFile);
      throw new Error();
    }
    const provider = new ProtectedBaoClient(tokenFile, '/trust/ca.crt');
    stage = 'session_identity';
    const identity = await provider.required('auth/token/lookup-self');
    const d = identity.data;
    if (
      JSON.stringify(d?.policies) !==
        JSON.stringify(['platform-deployment-maintainer']) ||
      (d.identity_policies?.length ?? 0) !== 0 ||
      d.orphan !== true ||
      d.explicit_max_ttl !== 900 ||
      !Number.isInteger(d.ttl) ||
      d.ttl < 1 ||
      d.ttl > 900 ||
      d.period
    )
      throw new Error();
    console.log(
      JSON.stringify({
        entrypoint: 'deployment',
        state: 'human_session_open',
        maximumSeconds: 900,
      }),
    );
  } else {
    stage = 'session_close';
    const provider = new ProtectedBaoClient(tokenFile, '/trust/ca.crt');
    knownToken = true;
    const identity = await provider.required('auth/token/lookup-self');
    if (
      JSON.stringify(identity.data?.policies) !==
      JSON.stringify(['platform-deployment-maintainer'])
    )
      throw new Error();
    await provider.required('auth/token/revoke-self', {});
    if ((await provider.call('auth/token/lookup-self')).status !== 403)
      throw new Error();
    unlinkSync(tokenFile);
    unlinkSync(accessorFile);
    console.log(
      JSON.stringify({
        entrypoint: 'deployment',
        state: 'human_session_revoked',
      }),
    );
  }
} catch {
  // No blind login retry or token-file overwrite. A lost login response is
  // uncertain; known files remain for exact reconciliation/revocation by custody.
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      stage,
      knownToken,
      revokedOnPersistenceFailure,
      failureCode: 'human_session_incomplete_review_required',
    }),
  );
  process.exitCode = 1;
}
