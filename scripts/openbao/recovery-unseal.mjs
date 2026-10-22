// Attended one-shot unseal only. Seal material never leaves this process except
// for the verified TLS request body; no token, argv, env or output transport.
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { protectedFile } from './protected-client.mjs';

export function sealKey(value) {
  if (
    !value ||
    typeof value.key !== 'string' ||
    !/^[A-Za-z0-9+/]{43}=$/.test(value.key) ||
    Buffer.from(value.key, 'base64').length !== 32
  )
    throw new Error('Invalid seal input');
  return value.key;
}

export async function recoveryUnseal(action, call, readKey) {
  if (!['unseal', 'verify-protected'].includes(action)) throw new Error();
  const before = await call('sys/seal-status');
  if (
    before.status !== 200 ||
    before.value.initialized !== true ||
    before.value.t !== 1
  )
    throw new Error();
  if (action === 'unseal' && before.value.sealed === true) {
    const result = await call('sys/unseal', { key: sealKey(readKey()) });
    if (result.status !== 200 || result.value.sealed !== false)
      throw new Error();
  }
  let health;
  for (let attempt = 0; attempt < 20; attempt++) {
    health = await call('sys/health');
    if (health.status === 200) break;
    if (action !== 'unseal' || ![429, 472, 473, 503].includes(health.status))
      break;
    await delay(250);
  }
  if (
    health.status !== 200 ||
    health.value.sealed !== false ||
    health.value.initialized !== true ||
    health.value.standby !== false
  )
    throw new Error();
  if (action === 'verify-protected') {
    if ((await call('sys/generate-root/attempt')).status !== 405)
      throw new Error();
  }
  return {
    state:
      action === 'unseal'
        ? 'unsealed_active'
        : 'protected_active_generation_denied',
  };
}

async function main() {
  if (process.argv.length !== 3) throw new Error();
  const ca = readFileSync('/seal/ca.crt');
  const call = (path, body) =>
    new Promise((resolve, reject) => {
      const req = request(
        `https://endpoint-secrets:8200/v1/${path}`,
        {
          ca,
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > 32768) req.destroy();
            else chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                value: JSON.parse(Buffer.concat(chunks).toString()),
              });
            } catch {
              reject(new Error());
            }
          });
        },
      );
      const timer = setTimeout(() => req.destroy(new Error()), 5000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  console.log(
    JSON.stringify(
      await recoveryUnseal(process.argv[2], call, () =>
        JSON.parse(protectedFile('/seal/seal.json', 16384)),
      ),
    ),
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      JSON.stringify({
        state: 'unseal_or_readiness_unconfirmed',
        automaticRetry: false,
      }),
    );
    process.exitCode = 1;
  });
