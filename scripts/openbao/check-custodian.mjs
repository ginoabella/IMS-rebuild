// Non-listening read-only deployment diagnostic. Never print credentials or provider bodies.
import { readFileSync, lstatSync, existsSync } from 'node:fs';
import { request } from 'node:https';
import { protectedFile } from './protected-client.mjs';
process.umask(0o077);
const root = '/custody';
const candidate = process.argv[2];
if (!['custodian.token', 'bootstrap.json', 'metadata'].includes(candidate)) {
  console.error('Invalid custodian check');
  process.exit(1);
}
function regular(name) {
  try {
    const s = lstatSync(`${root}/${name}`);
    return s.isFile() && !s.isSymbolicLink() && !(s.mode & 0o077);
  } catch {
    return false;
  }
}
async function main() {
  if (candidate === 'metadata') {
    console.log(
      JSON.stringify({
        custodyAccessible: existsSync(root),
        sealCustodyPresent: regular('seal.json'),
        caPresent: existsSync(`${root}/ca.crt`),
        bootstrapPresent: regular('bootstrap.json'),
        custodianPresent: regular('custodian.token'),
        endpointAdministratorPresent: regular('admin.token'),
        restrictedIssuerPresent: regular('issuer.token'),
        endpointAdministratorExcluded: true,
      }),
    );
  } else if (!regular(candidate)) {
    console.log(
      JSON.stringify({ candidate, available: false, authorized: false }),
    );
  } else {
    const ca = readFileSync(`${root}/ca.crt`);
    const file = protectedFile(`${root}/${candidate}`, 65536).toString('utf8');
    const token =
      candidate === 'bootstrap.json'
        ? JSON.parse(file).root_token
        : file.trim();
    async function call(path, data) {
      return new Promise((resolve, reject) => {
        const req = request(
          `https://endpoint-secrets:8200/v1/${path}`,
          {
            method: data ? 'POST' : 'GET',
            ca,
            headers: {
              'X-Vault-Token': token,
              'Content-Type': 'application/json',
            },
          },
          (res) => {
            let bytes = '';
            res.on('data', (b) => {
              bytes += b;
              if (bytes.length > 65536) req.destroy();
            });
            res.on('end', () => {
              if (res.statusCode !== 200) return resolve(null);
              try {
                resolve(JSON.parse(bytes));
              } catch {
                reject(new Error('Invalid response'));
              }
            });
          },
        );
        const timer = setTimeout(() => req.destroy(), 5000);
        req.on('close', () => clearTimeout(timer));
        req.on('error', () => reject(new Error('Custodian check unavailable')));
        req.end(data ? JSON.stringify(data) : undefined);
      });
    }
    try {
      const identity = await call('auth/token/lookup-self');
      // Exact representative administration paths. Real provisioning repeats authorization
      // for its immutable per-installation manifest; this check does not grant authority.
      const paths = [
        'sys/mounts/myims-trunk',
        'sys/policies/acl/trunk-issuer',
        'auth/token/roles/trunk-verifier-preflight',
        'sys/policies/acl/endpoint-development-admin',
      ];
      const access = identity
        ? await call('sys/capabilities-self', { paths })
        : null;
      const authorized =
        !!access &&
        paths.every((p) => {
          const caps = access[p] ?? access.data?.[p] ?? [];
          return (
            caps.includes('root') ||
            (caps.includes('create') && caps.includes('update'))
          );
        });
      console.log(
        JSON.stringify({
          candidate,
          available: true,
          valid: !!identity,
          authorized,
        }),
      );
    } catch {
      console.log(
        JSON.stringify({
          candidate,
          available: true,
          authorized: false,
          unavailable: true,
        }),
      );
      process.exitCode = 1;
    }
  }
}
main().catch(() => {
  console.error(JSON.stringify({ authorized: false, unavailable: true }));
  process.exitCode = 1;
});
