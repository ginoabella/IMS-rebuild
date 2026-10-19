// MANUAL RECOVERY ONLY. Never invoked by startup, checks, workers or provisioning.
// Requires separate user confirmation staged by the trusted deployment owner.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { request } from 'node:https';
import { protectedFile } from './protected-client.mjs';
process.umask(0o077);
let token,
  ca,
  attemptRequested = false,
  stage = 'confirmation';
async function call(
  path,
  body,
  secret,
  method = body === undefined ? 'GET' : 'POST',
) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Recovery operation unavailable'));
    const req = request(
      `https://endpoint-secrets:8200/v1/${path}`,
      {
        method,
        ca,
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-Vault-Token': secret } : {}),
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
          if (res.statusCode < 200 || res.statusCode > 299) return fail();
          try {
            resolve(data ? JSON.parse(data) : {});
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
  const [operationId] = process.argv.slice(2);
  if (
    process.argv.length !== 3 ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId ?? '')
  )
    throw new Error();
  const confirmation = JSON.parse(
    protectedFile('/recovery/confirmed.json').toString('utf8'),
  );
  const age = Date.now() - Date.parse(confirmation.confirmedAt);
  if (
    Object.keys(confirmation).sort().join(',') !==
      'confirmedAt,executeRecovery,operationId' ||
    confirmation.operationId !== operationId ||
    confirmation.executeRecovery !== true ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 300000
  )
    throw new Error();
  if (
    existsSync('/recovery/custodian.token') ||
    existsSync('/recovery/recovery-started.json')
  )
    throw new Error();
  // The caller must mount /recovery on owner-only container tmpfs. Verify it is tmpfs.
  stage = 'tmpfs';
  const mounts = readFileSync('/proc/self/mountinfo', 'utf8').split('\n');
  if (
    !mounts.some(
      (line) =>
        line.split(' ')[4] === '/recovery' && line.includes(' - tmpfs '),
    )
  )
    throw new Error();
  writeFileSync(
    '/recovery/recovery-started.json',
    JSON.stringify({ operationId, startedAt: new Date().toISOString() }),
    { mode: 0o600, flag: 'wx' },
  );
  ca = readFileSync('/seal/ca.crt');
  stage = 'provider_status';
  const status = await call('sys/generate-root/attempt');
  if (
    status.started === true ||
    !Number.isInteger(status.otp_length) ||
    status.otp_length < 16 ||
    status.otp_length > 128
  )
    throw new Error();
  const otp = randomBytes(128).toString('base64').slice(0, status.otp_length);
  stage = 'begin_attempt';
  attemptRequested = true;
  const started = await call('sys/generate-root/attempt', { otp });
  const key = JSON.parse(
    protectedFile('/seal/seal.json', 16384).toString('utf8'),
  ).key;
  stage = 'quorum_update';
  const completed = await call('sys/generate-root/update', {
    nonce: started.nonce,
    key,
  });
  if (
    completed.complete !== true ||
    typeof completed.encoded_token !== 'string'
  )
    throw new Error();
  const bytes = Buffer.from(completed.encoded_token, 'base64'),
    mask = Buffer.from(otp);
  if (bytes.length > mask.length) throw new Error();
  token = Buffer.from(bytes.map((b, i) => b ^ mask[i])).toString('utf8');
  if (!/^[a-zA-Z0-9._-]{16,4096}$/.test(token)) throw new Error();
  stage = 'root_identity';
  const identity = await call('auth/token/lookup-self', undefined, token);
  if (
    identity.data?.policies?.length !== 1 ||
    identity.data.policies[0] !== 'root'
  )
    throw new Error();
  stage = 'persist_root';
  writeFileSync('/recovery/custodian.token', token, {
    mode: 0o600,
    flag: 'wx',
  });
  // Consumed approval cannot trigger another recovery attempt.
  unlinkSync('/recovery/confirmed.json');
  console.log(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'recovered_in_tmpfs',
      operationId,
      rootRevocation: 'required_before_restoration',
    }),
  );
} catch {
  if (attemptRequested) {
    try {
      await call('sys/generate-root/attempt', undefined, undefined, 'DELETE');
    } catch {
      /* Retain isolated recovery state; do not retry generation. */
    }
  }
  if (token) {
    try {
      await call('auth/token/revoke-self', {}, token);
    } catch {
      /* Retain protected recovery state for exact resolution. */
    }
  }
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      stage,
      failureCode: 'recovery_incomplete_do_not_resume',
    }),
  );
  process.exitCode = 1;
}
