import { randomBytes } from 'node:crypto';
// Trusted deployment only. Run in the isolated provider network with /custody mounted.
import { request } from 'node:https';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  renameSync,
} from 'node:fs';
process.umask(0o077);
const directory = '/custody';
const [command, installation] = process.argv.slice(2);
let stage = 0;
let lastStatus = 0;
const ca = readFileSync(`${directory}/ca.crt`);
async function call(path, body, token, method = body ? 'POST' : 'GET') {
  stage++;
  return new Promise((resolve, reject) => {
    const bytes = body ? JSON.stringify(body) : undefined;
    const req = request(
      `https://endpoint-secrets:8200/v1/${path}`,
      {
        method,
        ca,
        timeout: path === 'sys/init' ? 60000 : 5000,
        headers: {
          ...(token ? { 'X-Vault-Token': token } : {}),
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (b) => {
          data += b;
          if (data.length > 65536) req.destroy();
        });
        res.on('end', () => {
          lastStatus = res.statusCode;
          if (
            res.statusCode !== 404 &&
            (res.statusCode < 200 || res.statusCode > 299)
          )
            return reject(new Error('Provider provisioning rejected'));
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch {
            reject(new Error('Invalid provider response'));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () =>
      reject(new Error('Provider provisioning unavailable')),
    );
    req.end(bytes);
  });
}
try {
  if (command === 'recover-bootstrap') {
    const status = await call('sys/generate-root/attempt');
    const otp = randomBytes(64).toString('base64').slice(0, status.otp_length);
    const started = await call('sys/generate-root/attempt', { otp });
    const completed = await call('sys/generate-root/update', {
      nonce: started.nonce,
      key: JSON.parse(readFileSync(`${directory}/seal.json`)).key,
    });
    const bytes = Buffer.from(completed.encoded_token, 'base64');
    const key = Buffer.from(otp);
    const root = Buffer.from(bytes.map((b, i) => b ^ key[i])).toString('utf8');
    writeFileSync(
      `${directory}/bootstrap.json`,
      JSON.stringify({ root_token: root }),
      { mode: 0o600, flag: 'wx' },
    );
  }
  if (command === 'init') {
    if (existsSync(`${directory}/seal.json`))
      throw new Error('Already initialized');
    const initialized = await call('sys/init', {
      secret_shares: 1,
      secret_threshold: 1,
    });
    // Persist recovery custody before subsequent effects. Root removed after scoped bootstrap.
    writeFileSync(`${directory}/bootstrap.json`, JSON.stringify(initialized), {
      mode: 0o600,
      flag: 'wx',
    });
    writeFileSync(
      `${directory}/seal.json`,
      JSON.stringify({ key: initialized.keys_base64[0] }),
      { mode: 0o600, flag: 'wx' },
    );
  }
  if (command === 'init' || command === 'unseal') {
    await call('sys/unseal', {
      key: JSON.parse(readFileSync(`${directory}/seal.json`)).key,
    });
  }
  if (command === 'init' || command === 'bootstrap') {
    const token = JSON.parse(
      readFileSync(`${directory}/bootstrap.json`),
    ).root_token;
    await call(
      'sys/policies/acl/endpoint-development-admin',
      {
        policy: `
path "sys/mounts/myims-endpoint" { capabilities = ["create", "read", "update"] }
path "sys/policies/acl/endpoint-*" { capabilities = ["create", "read", "update"] }
path "auth/token/create" { capabilities = ["create", "update", "sudo"] }
path "auth/token/lookup-self" { capabilities = ["read"] }
path "auth/token/renew-self" { capabilities = ["update"] }
path "auth/token/revoke-self" { capabilities = ["update"] }
path "sys/audit/endpoint" { capabilities = ["create", "read", "update", "sudo"] }
`,
      },
      token,
    );
    const admin = await call(
      'auth/token/create',
      {
        policies: ['endpoint-development-admin'],
        no_parent: true,
        no_default_policy: true,
        ttl: '24h',
        explicit_max_ttl: '24h',
        renewable: false,
      },
      token,
    );
    writeFileSync(`${directory}/admin.token`, admin.auth.client_token, {
      mode: 0o600,
    });
    const mounts = await call('sys/mounts', undefined, token);
    if (!mounts.data?.['myims-endpoint/'])
      await call(
        'sys/mounts/myims-endpoint',
        { type: 'kv', options: { version: '2' } },
        token,
      );
    const audits = await call('sys/audit', undefined, token);
    if (!audits.data?.['endpoint/'])
      await call(
        'sys/audit/endpoint',
        {
          type: 'file',
          options: { file_path: '/bao/audit/endpoint.json', log_raw: 'false' },
        },
        token,
      );
    await call('auth/token/revoke-self', {}, token);
    unlinkSync(`${directory}/bootstrap.json`);
  }
  if (command === 'rotate-admin') {
    const prior = readFileSync(`${directory}/admin.token`, 'utf8');
    const next = await call(
      'auth/token/create',
      {
        policies: ['endpoint-development-admin'],
        no_parent: true,
        no_default_policy: true,
        ttl: '24h',
        explicit_max_ttl: '24h',
        renewable: false,
      },
      prior,
    );
    writeFileSync(`${directory}/admin.token.next`, next.auth.client_token, {
      mode: 0o600,
    });
    renameSync(`${directory}/admin.token.next`, `${directory}/admin.token`);
    await call('auth/token/revoke-self', {}, prior);
  }
  if (command === 'provision-expiring') {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installation ?? ''))
      throw new Error('Exact installation required');
    const admin = readFileSync(`${directory}/admin.token`, 'utf8');
    const result = await call(
      'auth/token/create',
      {
        policies: [`endpoint-worker-${installation}`],
        no_parent: true,
        no_default_policy: true,
        ttl: '1s',
        explicit_max_ttl: '1s',
        renewable: false,
      },
      admin,
    );
    writeFileSync(
      `${directory}/worker-expiring-${installation}.token`,
      result.auth.client_token,
      { mode: 0o600 },
    );
  }
  if (command === 'provision') {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installation ?? ''))
      throw new Error('Exact installation required');
    const admin = readFileSync(`${directory}/admin.token`, 'utf8');
    const prefix = `myims-endpoint/data/installations/${installation}/extensions/+/operations/+`;
    const common = `path "auth/token/lookup-self" { capabilities = ["read"] }\npath "auth/token/renew-self" { capabilities = ["update"] }\npath "auth/token/revoke-self" { capabilities = ["update"] }`;
    for (const role of ['worker', 'cleanup']) {
      const policy = `endpoint-${role}-${installation}`;
      const permissions =
        role === 'worker'
          ? `path "${prefix}" { capabilities = ["create", "read"] }`
          : `path "${prefix}" { capabilities = ["read"] }\npath "${prefix.replace('/data/', '/metadata/')}" { capabilities = ["read"] }\npath "${prefix.replace('/data/', '/destroy/')}" { capabilities = ["update"] }`;
      await call(
        `sys/policies/acl/${policy}`,
        { policy: `${permissions}\n${common}` },
        admin,
      );
      const result = await call(
        'auth/token/create',
        {
          policies: [policy],
          no_parent: true,
          no_default_policy: true,
          ttl: '1h',
          explicit_max_ttl: '24h',
          renewable: true,
        },
        admin,
      );
      writeFileSync(
        `${directory}/${role}-${installation}.token`,
        result.auth.client_token,
        { mode: 0o600 },
      );
    }
  }
  if (
    ![
      'init',
      'bootstrap',
      'unseal',
      'provision',
      'rotate-admin',
      'recover-bootstrap',
      'provision-expiring',
    ].includes(command)
  )
    throw new Error('Unknown deployment action');
  console.log(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'complete',
      action: command,
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      failureCode: 'provider_provisioning_failed',
      stage,
      status: lastStatus,
    }),
  );
  process.exitCode = 1;
}
