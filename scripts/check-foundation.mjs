import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer, createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const backendRequire = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = backendRequire('pg');
const { loadBackendConfig, loadMigrationConfig } = backendRequire(
  './dist/infrastructure/configuration.js',
);
const runtime = loadBackendConfig();
const migration = loadMigrationConfig();
const databaseName = `myims_foundation_${randomBytes(6).toString('hex')}`;
const databaseUrl = new URL(runtime.database.url);
databaseUrl.pathname = `/${databaseName}`;
const migrationUrl = new URL(migration.adminUrl);
migrationUrl.pathname = `/${databaseName}`;
const admin = new Client({
  connectionString: migration.adminUrl,
  connectionTimeoutMillis: 2000,
});
const apps = [];
const proxies = [];
const captured = [];
let created = false;
function env(overrides = {}) {
  return {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '0',
    DEPENDENCY_TIMEOUT_MS: '500',
    DATABASE_URL: databaseUrl.href,
    DATABASE_PASSWORD_FILE: undefined,
    MIGRATION_DATABASE_URL: migrationUrl.href,
    MIGRATION_DATABASE_PASSWORD_FILE: undefined,
    SESSION_REDIS_URL: runtime.sessionRedis.url,
    SESSION_REDIS_AUTH_FILE: undefined,
    REALTIME_REDIS_URL: runtime.realtimeRedis.url,
    REALTIME_REDIS_AUTH_FILE: undefined,
    ...overrides,
  };
}
function child(entrypoint, environment, args = []) {
  const process = spawn(
    globalThis.process.execPath,
    [`${root}services/backend/dist/entrypoints/${entrypoint}/main.js`, ...args],
    { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const exit = once(process, 'exit');
  const timer = setTimeout(() => process.kill('SIGKILL'), 90000);
  let output = '';
  let errors = '';
  process.stdout.on('data', (data) => {
    output += data;
  });
  process.stderr.on('data', (data) => {
    errors += data;
  });
  exit.then(() => {
    clearTimeout(timer);
    captured.push(output + errors);
  });
  return { process, exit, output: () => output, errors: () => errors };
}
async function migrate() {
  const job = child('deployment', env(), ['migrate']);
  const [code] = await job.exit;
  assert.equal(code, 0, `Migration failed: ${job.errors()}`);
}
async function start(environment) {
  const app = child('http', environment);
  apps.push(app);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const line = app
      .output()
      .split('\n')
      .find((line) => line.includes('"entrypoint":"http"'));
    if (line) return { ...app, address: JSON.parse(line).address };
    if (app.process.exitCode !== null)
      throw new Error(`HTTP failed: ${app.errors()}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('HTTP did not report startup');
}
async function stop(app) {
  if (app.process.exitCode !== null || app.process.signalCode !== null) return;
  app.process.kill('SIGTERM');
  const [code, signal] = await app.exit;
  assert.ok(code === 0 || signal === 'SIGTERM', 'HTTP shutdown failed');
}
async function probe(app, endpoint) {
  const response = await fetch(`${app.address}/health/${endpoint}`, {
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { status: response.status, body: await response.json() };
}
async function waitFor(app, status, dependency) {
  const deadline = Date.now() + 12000;
  let last;
  while (Date.now() < deadline) {
    const result = await probe(app, 'ready');
    last = result;
    if (
      result.status === status &&
      (!dependency || result.body.checks[dependency] === 'down')
    )
      return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Readiness did not reach HTTP ${status}: ${JSON.stringify(last)}; process output: ${app.output()}`,
  );
}
async function proxy(url) {
  const target = new URL(url);
  const upstream = {
    host: target.hostname,
    port: Number(
      target.port || (target.protocol.startsWith('postgres') ? 5432 : 6379),
    ),
  };
  const sockets = new Set();
  let enabled = true;
  const server = createServer((incoming) => {
    if (!enabled) {
      incoming.destroy();
      return;
    }
    const outgoing = createConnection(upstream);
    for (const socket of [incoming, outgoing]) {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => {
        sockets.delete(socket);
        incoming.destroy();
        outgoing.destroy();
      });
    }
    incoming.pipe(outgoing);
    outgoing.pipe(incoming);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  target.hostname = '127.0.0.1';
  target.port = String(server.address().port);
  const result = {
    url: target.href,
    disable() {
      enabled = false;
      for (const socket of sockets) socket.destroy();
    },
    enable() {
      enabled = true;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
  proxies.push(result);
  return result;
}
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const database = await proxy(databaseUrl.href);
  const session = await proxy(runtime.sessionRedis.url);
  const realtime = await proxy(runtime.realtimeRedis.url);
  const environment = env({
    DATABASE_URL: database.url,
    SESSION_REDIS_URL: session.url,
    REALTIME_REDIS_URL: realtime.url,
  });
  let app = await start(environment);
  assert.deepEqual(await probe(app, 'live'), {
    status: 200,
    body: { status: 'alive' },
  });
  assert.equal((await waitFor(app, 503, 'database')).body.status, 'not_ready');
  console.log(
    'PASS: fresh database is unready while liveness remains available',
  );
  const concurrent = await Promise.allSettled([migrate(), migrate()]);
  for (const result of concurrent)
    if (result.status === 'rejected') throw result.reason;
  await migrate();
  assert.equal((await waitFor(app, 200)).body.status, 'ready');
  const connection = new Client({ connectionString: databaseUrl.href });
  await connection.connect();
  try {
    const result = await connection.query(
      'SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL',
    );
    assert.equal(result.rows[0].count, 5);
    const role = await connection.query(
      'SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user',
    );
    assert.ok(Object.values(role.rows[0]).every((value) => value === false));
    await assert.rejects(
      connection.query('CREATE TABLE public.p1u3_forbidden (id integer)'),
      (error) => error.code === '42501',
    );
  } finally {
    await connection.end();
  }
  console.log(
    'PASS: fresh migration, concurrent deployment, safe rerun, PostGIS and restricted runtime role',
  );
  for (const [dependency, proxy] of [
    ['database', database],
    ['sessionRedis', session],
    ['realtimeRedis', realtime],
  ]) {
    proxy.disable();
    const before = Date.now();
    await waitFor(app, 503, dependency);
    assert.ok(
      Date.now() - before < 3000,
      `${dependency} readiness timeout was not bounded`,
    );
    assert.equal((await probe(app, 'live')).status, 200);
    proxy.enable();
    await waitFor(app, 200);
    console.log(
      `PASS: ${dependency} outage returns 503, liveness stays 200, recovery restores readiness`,
    );
  }
  await stop(app);
  app = await start(environment);
  await waitFor(app, 200);
  await stop(app);
  console.log('PASS: backend shutdown/restart retains baseline and reconnects');
  for (const overrides of [
    { DATABASE_URL: '' },
    { PORT: 'invalid' },
    {
      DATABASE_URL: 'postgresql://runtime@postgres/myims',
      DATABASE_PASSWORD_FILE: '/missing-secret',
    },
  ]) {
    const invalid = child('http', env(overrides));
    const [code] = await invalid.exit;
    assert.equal(code, 1);
    assert.match(invalid.errors(), /DATABASE|PORT/);
  }
  console.log(
    'PASS: missing/invalid configuration and unreadable credentials fail clearly',
  );
  for (const secretUrl of [
    runtime.database.url,
    runtime.sessionRedis.url,
    runtime.realtimeRedis.url,
    migration.adminUrl,
  ]) {
    const password = decodeURIComponent(new URL(secretUrl).password);
    assert.ok(
      !captured.some((output) => password && output.includes(password)),
      'Secret leaked into process output',
    );
  }
  console.log('PASS: responses and process logs contain no credentials');
} finally {
  for (const app of apps) await stop(app);
  for (const proxy of proxies) await proxy.close();
  if (created)
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
