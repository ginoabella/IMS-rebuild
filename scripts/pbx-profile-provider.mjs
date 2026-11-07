// Minimal GET-only consumer probe. No SQL, PBX, material output or token issuance.
import { readFileSync, lstatSync } from 'node:fs';
import { request } from 'node:https';
export function accessAvailable(data, installation) {
  return (
    !!data &&
    Array.isArray(data.policies) &&
    data.policies.length === 1 &&
    data.policies[0] === 'endpoint-live-read-' + installation &&
    Number.isSafeInteger(data.ttl) &&
    data.ttl > 0 &&
    data.ttl <= 86400 &&
    data.explicit_max_ttl === 86400 &&
    data.renewable === false
  );
}
if (process.argv[2] === '--consumer') {
  let state = 'unavailable';
  try {
    const installation = process.argv[3];
    if (
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installation ?? '')
    )
      throw new Error();
    const path = '/consumer/live-' + installation + '.token',
      stat = lstatSync(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.nlink !== 1 ||
      stat.uid !== process.getuid() ||
      stat.mode & 0o077 ||
      stat.size > 8192
    )
      throw new Error();
    const token = readFileSync(path, 'utf8').trim(),
      ca = readFileSync('/consumer/ca.crt');
    const response = await new Promise((resolve, reject) => {
      const req = request(
        'https://endpoint-secrets:8200/v1/auth/token/lookup-self',
        { method: 'GET', ca, headers: { 'X-Vault-Token': token } },
        (res) => {
          let bytes = '';
          res.on('data', (chunk) => {
            bytes += chunk;
            if (Buffer.byteLength(bytes) > 32768) req.destroy();
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(bytes).data });
            } catch {
              reject(new Error());
            }
          });
        },
      );
      const timer = setTimeout(() => req.destroy(), 3000);
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end();
    });
    state =
      response.status === 200 && accessAvailable(response.data, installation)
        ? 'available'
        : response.status === 403
          ? 'denied'
          : 'unavailable';
  } catch {
    /* Finite facts only. Never print provider bodies, URLs or tokens. */
  }
  console.log(
    JSON.stringify({
      state,
      scope: 'installation_get_only',
      materialRead: false,
    }),
  );
}
