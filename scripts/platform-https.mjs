import { spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { chmodSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import {
  prepareMaterial,
  materialDirectory,
  browserOrigin,
} from './platform-https-material.mjs';
import { createIngress } from './platform-https-ingress.mjs';

const controlPath = `${materialDirectory}/control.sock`;
const action = process.argv[2];
let phase = action;
const children = new Set();
let control,
  ingress,
  stopping = false,
  ownsControl = false;

function terminate(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    /* An already exited owned process group needs no signal. */
  }
}

async function controlRequest(command) {
  const socket = createConnection(controlPath);
  socket.setTimeout(3000, () => socket.destroy(new Error('Control timeout')));
  let output = '';
  socket.on('data', (data) => {
    output += data.toString();
  });
  await once(socket, 'connect');
  socket.end(command);
  await once(socket, 'close');
  if (!['ready\n', 'starting\n', 'stopping\n'].includes(output))
    throw new Error('Invalid control response');
  console.log(`Platform HTTPS: ${output.trim()}`);
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
    [...children].some(
      (child) => child.exitCode === null && child.signalCode === null,
    ) &&
    Date.now() < deadline
  )
    await delay(100);
  for (const child of children) terminate(child, 'SIGKILL');
  if (ownsControl) rmSync(controlPath, { force: true });
}

function launch(command, args, env, cwd = process.cwd()) {
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
  return child;
}

async function fail() {
  if (stopping) return;
  console.error(
    `Platform HTTPS failed during ${phase}; check ports, dependencies and private material. No credentials logged.`,
  );
  process.exitCode = 1;
  await shutdown();
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
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        redirect: 'manual',
      });
      await response.body?.cancel();
      if (response.status === 200) return;
    } catch {
      /* Bounded startup readiness only; never retry authentication. */
    }
    await delay(250);
  }
  throw new Error('Readiness failed');
}

async function start() {
  process.umask(0o077);
  const material = prepareMaterial();
  // A live control listener owns the stack. Only remove a stale socket after ECONNREFUSED.
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
    socket.setTimeout(3000, () => socket.destroy());
    let command = '';
    socket.on('data', (bytes) => {
      command += bytes.toString();
      if (command.length > 16) socket.destroy();
    });
    socket.on('end', () => {
      if (command === 'stop') {
        socket.end('stopping\n', () => {
          void shutdown();
        });
      } else if (command === 'status')
        socket.end(ingress ? 'ready\n' : 'starting\n');
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
  phase = 'listener preflight';
  for (const [port, host] of [
    [3001, '::'],
    [3003, '127.0.0.1'],
    [4001, '127.0.0.1'],
  ]) {
    phase = `listener preflight on port ${port}`;
    const probe = createServer();
    probe.listen(port, host);
    await once(probe, 'listening');
    await new Promise((resolve) => probe.close(resolve));
  }
  const buildEnv = { ...process.env };
  for (const name of Object.keys(buildEnv))
    if (name.startsWith('PLATFORM_AUTH_')) delete buildEnv[name];
  phase = 'backend and UI dependency build';
  console.log(
    'Platform HTTPS: building ordinary backend and console (no fixtures).',
  );
  await build(['build:backend'], buildEnv);
  await build(['--filter', '@myims/ui-web', 'build'], buildEnv);
  phase = 'ordinary console build';
  await build(['--filter', '@myims/platform-console-web', 'build'], buildEnv);
  const backendEnv = {
    ...buildEnv,
    HOST: '127.0.0.1',
    PORT: '4001',
    MIGRATION_DATABASE_URL: '',
    MIGRATION_DATABASE_PASSWORD_FILE: '',
    MYIMS_OWNER_PATH: `${process.cwd()}/services/backend`,
    PLATFORM_AUTH_ORIGIN: browserOrigin,
    PLATFORM_AUTH_PROXY_PEERS: '127.0.0.1',
    LIMITER_TRUSTED_PROXIES: [
      ...new Set([
        ...(buildEnv.LIMITER_TRUSTED_PROXIES || '').split(',').filter(Boolean),
        '127.0.0.1',
      ]),
    ].join(','),
    PLATFORM_AUTH_PROXY_SECRET: material.secrets.proxy,
    PLATFORM_AUTH_CSRF_SECRET: material.secrets.csrf,
  };
  phase = 'private authentication backend';
  const backend = launch(
    process.execPath,
    ['services/backend/dist/entrypoints/http/main.js'],
    backendEnv,
  );
  backend.on('exit', () => {
    if (!stopping) void fail();
  });
  await waitFor('http://127.0.0.1:4001/health/ready');
  const nextEnv = Object.fromEntries(
    ['PATH', 'HOME', 'NODE_ENV', 'NEXT_TELEMETRY_DISABLED']
      .filter((name) => buildEnv[name] !== undefined)
      .map((name) => [name, buildEnv[name]]),
  );
  Object.assign(nextEnv, {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    PLATFORM_AUTH_ORIGIN: browserOrigin,
    PLATFORM_AUTH_BACKEND_URL: 'http://127.0.0.1:4001',
    PLATFORM_AUTH_PROXY_SECRET: material.secrets.proxy,
    PLATFORM_AUTH_INGRESS_SECRET: material.secrets.ingress,
  });
  phase = 'private console';
  const require = createRequire(
    `${process.cwd()}/apps/platform-console-web/package.json`,
  );
  const next = launch(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3003',
    ],
    nextEnv,
    `${process.cwd()}/apps/platform-console-web`,
  );
  next.on('exit', () => {
    if (!stopping) void fail();
  });
  await waitFor('http://127.0.0.1:3003/sign-in');
  phase = 'HTTPS ingress';
  ingress = createIngress(material);
  ingress.listen(3001, '::');
  await once(ingress, 'listening');
  ingress.on('error', () => {
    void fail();
  });
  phase = 'running';
  console.log(
    `Platform HTTPS ready: ${browserOrigin}/sign-in via SSH to server loopback 3101.`,
  );
  console.log(`Development CA SHA256: ${material.fingerprint}`);
  console.log(
    'Stop with Ctrl+C or ./dev platform-https-stop. Existing shared services retained.',
  );
}

try {
  if (action === 'start') await start();
  else if (action === 'prepare') {
    const material = prepareMaterial();
    console.log(`Development CA SHA256: ${material.fingerprint}`);
    console.log(
      'Transfer only .local/platform-https-ca.crt to your Windows computer.',
    );
  } else if (action === 'status' || action === 'stop') {
    if (!existsSync(controlPath)) console.log('Platform HTTPS: stopped');
    else await controlRequest(action);
  } else throw new Error('Unknown platform HTTPS action');
} catch {
  await fail();
}
