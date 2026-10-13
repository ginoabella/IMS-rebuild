// Private companion to platform-https; uses existing stores and the retained development CA.
import { spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { readMaterial } from './platform-https-material.mjs';
import { createStaffIngress } from './staff-access-ingress.mjs';
import { staffCertificate } from './staff-development-certificate.mjs';

export const staffDevelopmentOrigin = 'https://localhost:3444';
const recipientOrigin = 'https://127.0.0.1:3444';
const directory = resolve('.local/staff-development-https');
const controlPath = `${directory}/control.sock`;
const action = process.argv[2];
const children = new Set();
let control,
  ingress,
  stopping = false,
  ownsControl = false,
  phase = action;

function privateEntry(path, isDirectory = false) {
  const s = lstatSync(path);
  if (
    s.isSymbolicLink() ||
    s.uid !== process.getuid() ||
    (s.mode & 0o077) !== 0 ||
    (isDirectory ? !s.isDirectory() : !s.isFile())
  )
    throw new Error('Private owner-owned material required');
}
function material() {
  process.umask(0o077);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  privateEntry(directory, true);
  const tls = readMaterial();
  const file = `${directory}/auth.json`;
  if (!existsSync(file))
    writeFileSync(
      file,
      JSON.stringify({
        staffProxy: randomBytes(32).toString('hex'),
        staffCsrf: randomBytes(32).toString('hex'),
        exchangeProxy: randomBytes(32).toString('hex'),
        exchangeCsrf: randomBytes(32).toString('hex'),
        ingress: randomBytes(32).toString('hex'),
      }),
      { flag: 'wx', mode: 0o600 },
    );
  privateEntry(file);
  const secrets = JSON.parse(readFileSync(file, 'utf8'));
  const values = [
    'staffProxy',
    'staffCsrf',
    'exchangeProxy',
    'exchangeCsrf',
    'ingress',
  ].map((name) => secrets[name]);
  if (
    values.some((v) => typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) ||
    new Set([...values, ...Object.values(tls.secrets)]).size !== 8
  )
    throw new Error('Distinct private authentication material required');
  return { tls: { ...tls, ...staffCertificate(directory, tls) }, secrets };
}
function terminate(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    /* Already exited owned child. */
  }
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  ingress?.close();
  ingress?.closeAllConnections();
  control?.close();
  for (const child of children) terminate(child, 'SIGTERM');
  const deadline = Date.now() + 8000;
  while (
    [...children].some((c) => c.exitCode === null && c.signalCode === null) &&
    Date.now() < deadline
  )
    await delay(100);
  for (const child of children) terminate(child, 'SIGKILL');
  if (ownsControl) rmSync(controlPath, { force: true });
}
async function fail() {
  if (stopping) return;
  console.error(
    `Staff HTTPS failed during ${phase}; check private ports/material and dependencies. No credentials logged.`,
  );
  process.exitCode = 1;
  await shutdown();
}
function launch(command, args, env, cwd = process.cwd(), server = false) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'ignore',
    detached: true,
  });
  children.add(child);
  child.on('error', () => {
    void fail();
  });
  if (server)
    child.on('exit', () => {
      if (!stopping) void fail();
    });
  return child;
}
async function build(args, env) {
  const child = launch('pnpm', args, env);
  const timer = setTimeout(() => terminate(child, 'SIGKILL'), 240000);
  try {
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error('Build failed');
  } finally {
    clearTimeout(timer);
  }
}
async function waitFor(url) {
  const deadline = Date.now() + 45000;
  while (!stopping && Date.now() < deadline) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        redirect: 'manual',
      });
      await r.body?.cancel();
      if (r.status === 200) return;
    } catch {
      /* Bounded readiness only; no authentication retries. */
    }
    await delay(250);
  }
  throw new Error('Readiness unavailable');
}
async function controlRequest(command) {
  privateEntry(directory, true);
  const entry = lstatSync(controlPath);
  if (
    !entry.isSocket() ||
    entry.uid !== process.getuid() ||
    (entry.mode & 0o077) !== 0
  )
    throw new Error('Private control socket required');
  const socket = createConnection(controlPath);
  socket.setTimeout(3000, () => socket.destroy(new Error('Control timeout')));
  let output = '';
  socket.on('data', (bytes) => {
    output += bytes.toString();
    if (output.length > 32) socket.destroy();
  });
  await once(socket, 'connect');
  socket.end(command);
  await once(socket, 'close');
  if (!['ready\n', 'starting\n', 'stopping\n'].includes(output))
    throw new Error('Invalid control response');
  console.log(`Staff HTTPS: ${output.trim()}`);
}
async function start() {
  const { tls, secrets } = material();
  if (existsSync(controlPath)) {
    try {
      await controlRequest('status');
      return;
    } catch (error) {
      if (error.code !== 'ECONNREFUSED') throw error;
      rmSync(controlPath);
    }
  }
  control = createServer({ allowHalfOpen: true }, (socket) => {
    socket.on('error', () => {});
    socket.setTimeout(3000, () => socket.destroy());
    let command = '';
    socket.on('data', (bytes) => {
      command += bytes.toString();
      if (command.length > 16) socket.destroy();
    });
    socket.on('end', () => {
      if (command === 'status') socket.end(ingress ? 'ready\n' : 'starting\n');
      else if (command === 'stop')
        socket.end('stopping\n', () => {
          void shutdown();
        });
      else socket.destroy();
    });
  });
  control.listen(controlPath);
  await once(control, 'listening');
  ownsControl = true;
  chmodSync(controlPath, 0o600);
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
  for (const [port, host] of [
    [3002, '::'],
    [3004, '127.0.0.1'],
    [4002, '127.0.0.1'],
  ]) {
    phase = `listener preflight on port ${port}`;
    const probe = createServer();
    probe.listen(port, host);
    await once(probe, 'listening');
    await new Promise((r) => probe.close(r));
  }
  const buildEnv = { ...process.env };
  for (const name of Object.keys(buildEnv))
    if (
      name.startsWith('PLATFORM_AUTH_') ||
      name.startsWith('STAFF_ISSUER_') ||
      name.startsWith('CREDENTIAL_EXCHANGE_') ||
      name === 'CREDENTIAL_BROWSER_BUILD'
    )
      delete buildEnv[name];
  phase = 'ordinary backend/UI/command-center build';
  console.log(
    'Staff HTTPS: building ordinary recipient and staff applications (no fixtures).',
  );
  await build(['build:backend'], buildEnv);
  await build(['--filter', '@myims/ui-web', 'build'], buildEnv);
  await build(['--filter', '@myims/command-center-web', 'build'], buildEnv);
  const common = {
    STAFF_ISSUER_ORIGIN: staffDevelopmentOrigin,
    STAFF_ISSUER_PROXY_SECRET: secrets.staffProxy,
    CREDENTIAL_EXCHANGE_ORIGIN: recipientOrigin,
    CREDENTIAL_EXCHANGE_PROXY_SECRET: secrets.exchangeProxy,
  };
  phase = 'private ordinary backend';
  launch(
    process.execPath,
    ['services/backend/dist/entrypoints/http/main.js'],
    {
      ...buildEnv,
      ...common,
      HOST: '127.0.0.1',
      PORT: '4002',
      MIGRATION_DATABASE_URL: '',
      MIGRATION_DATABASE_PASSWORD_FILE: '',
      MYIMS_OWNER_PATH: `${process.cwd()}/services/backend`,
      STAFF_ISSUER_PROXY_PEERS: '127.0.0.1',
      STAFF_ISSUER_CSRF_SECRET: secrets.staffCsrf,
      CREDENTIAL_EXCHANGE_PROXY_PEERS: '127.0.0.1',
      CREDENTIAL_EXCHANGE_CSRF_SECRET: secrets.exchangeCsrf,
      LIMITER_TRUSTED_PROXIES: [
        ...new Set([
          ...(buildEnv.LIMITER_TRUSTED_PROXIES || '')
            .split(',')
            .filter(Boolean),
          '127.0.0.1',
        ]),
      ].join(','),
    },
    process.cwd(),
    true,
  );
  await waitFor('http://127.0.0.1:4002/health/ready');
  const nextEnv = Object.fromEntries(
    ['PATH', 'HOME']
      .filter((n) => buildEnv[n] !== undefined)
      .map((n) => [n, buildEnv[n]]),
  );
  Object.assign(nextEnv, common, {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    STAFF_ISSUER_BACKEND_URL: 'http://127.0.0.1:4002',
    STAFF_ISSUER_INGRESS_SECRET: secrets.ingress,
    CREDENTIAL_EXCHANGE_BACKEND_URL: 'http://127.0.0.1:4002',
    CREDENTIAL_EXCHANGE_INGRESS_SECRET: secrets.ingress,
  });
  phase = 'private ordinary command center';
  const require = createRequire(
    `${process.cwd()}/apps/command-center-web/package.json`,
  );
  launch(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3004',
    ],
    nextEnv,
    `${process.cwd()}/apps/command-center-web`,
    true,
  );
  await waitFor('http://127.0.0.1:3004/credentials');
  phase = 'staff HTTPS ingress';
  ingress = createStaffIngress({
    tls: { cert: tls.cert, key: tls.key },
    config: {
      origin: staffDevelopmentOrigin,
      recipientOrigin,
      nextUrl: 'http://127.0.0.1:3004',
      backendUrl: 'http://127.0.0.1:4002',
      proxySecret: secrets.staffProxy,
      ingressSecret: secrets.ingress,
    },
  });
  ingress.on('error', () => {
    void fail();
  });
  ingress.listen(3002, '::');
  await once(ingress, 'listening');
  phase = 'running';
  console.log(
    `Recipient HTTPS ready: ${recipientOrigin}/credentials; staff ${staffDevelopmentOrigin}/sign-in via SSH to server loopback 3102.`,
  );
  console.log(`Development CA SHA256: ${tls.fingerprint}`);
  console.log(
    'Stop with Ctrl+C or ./dev staff-https-stop. Existing platform/shared services retained.',
  );
}
try {
  if (action === 'start') await start();
  else if (action === 'status' || action === 'stop') {
    if (!existsSync(controlPath)) console.log('Staff HTTPS: stopped');
    else await controlRequest(action);
  } else throw new Error('Unknown staff HTTPS action');
} catch {
  await fail();
}
