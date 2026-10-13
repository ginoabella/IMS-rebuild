// Private development-only A/B, response-loss and scoped-clock acceptance runtime.
// No control routes, token output, production clock changes or alternate auth store.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer as httpServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createServer as controlServer, createConnection } from 'node:net';
import { once } from 'node:events';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { createStaffIngress } from './staff-access-ingress.mjs';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const dir = resolve('.local/staff-native-runtime');
const socketPath = `${dir}/control.sock`;
const actions = [
  'start',
  'status',
  'a',
  'b',
  'lose-logout',
  'idle',
  'absolute',
  'check',
  'stop',
];
const action = process.argv[2];
const ownedTokens = new Map();
const workers = [],
  tracked = new Set();
let ingress,
  proxy,
  control,
  stopping = false,
  ownsSocket = false;
function privateJson(path) {
  const s = lstatSync(path);
  assert.ok(
    s.isFile() &&
      !s.isSymbolicLink() &&
      s.uid === process.getuid() &&
      (s.mode & 0o077) === 0,
  );
  return JSON.parse(readFileSync(path, 'utf8'));
}
function evidence(result) {
  appendFileSync(
    `${dir}/evidence.jsonl`,
    JSON.stringify({ at: new Date().toISOString(), ...result }) + '\n',
    { mode: 0o600 },
  );
}
async function stop() {
  if (stopping) return;
  stopping = true;
  ingress?.close();
  ingress?.closeAllConnections();
  proxy?.close();
  proxy?.closeAllConnections();
  control?.close();
  // Prevent fixture clock rollback from resurrecting sessions after shutdown.
  const revoker = workers.find((worker) => worker.child.connected);
  try {
    if (revoker)
      for (const [token, reference] of ownedTokens)
        assert.equal(
          (await revoker.call('revoke', token, reference)).kind,
          'revoked',
        );
    else assert.equal(ownedTokens.size, 0);
  } catch {
    console.error(
      'Native fixture shutdown could not confirm all tracked revocations; no tokens logged.',
    );
    process.exitCode = 1;
  }
  await Promise.allSettled(
    workers.map(async (worker) => {
      const timer = setTimeout(() => worker.child.kill('SIGKILL'), 5000);
      try {
        await worker.call('close');
      } finally {
        clearTimeout(timer);
        worker.child.kill();
      }
    }),
  );
  if (ownsSocket) rmSync(socketPath, { force: true });
}
async function callControl(command) {
  const s = lstatSync(socketPath);
  assert.ok(
    s.isSocket() && s.uid === process.getuid() && (s.mode & 0o077) === 0,
  );
  const socket = createConnection(socketPath);
  socket.setTimeout(45000, () => socket.destroy());
  let output = '';
  socket.on('data', (chunk) => {
    output += chunk;
    if (output.length > 4096) socket.destroy();
  });
  await once(socket, 'connect');
  socket.end(command);
  await once(socket, 'close');
  const value = JSON.parse(output);
  assert.equal(value.ok, true);
  console.log(JSON.stringify(value));
}
async function start() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const config = load('infrastructure/configuration').loadBackendConfig();
  assert.equal(new URL(config.database.url).hostname, 'postgres');
  assert.equal(new URL(config.database.url).pathname, '/myims');
  const c = privateJson('private/staff-access-config.json');
  assert.equal(c.origin, 'https://localhost:3444');
  assert.ok(['0.0.0.0', '::', '127.0.0.1', '::1'].includes(c.bind));
  assert.match(c.proxySecret, /^[a-f0-9]{64}$/);
  const state = privateJson('.local/staff-native-fixture/state.json');
  const handoff = privateJson('.local/staff-native-fixture/handoff.json');
  assert.equal(state.kind, 'P2-U4C-development-acceptance');
  assert.equal(state.state, 'ready');
  assert.match(state.tenantCode, /^native-p2u4c-[a-f0-9]{8}$/);
  assert.equal(state.accounts.length, 3);
  const secrets = privateJson('.local/staff-development-https/auth.json');
  assert.equal(secrets.staffProxy, c.proxySecret);
  assert.equal(secrets.ingress, c.ingressSecret);
  const { Pool } = backend('pg');
  const pool = new Pool({ connectionString: config.database.url, max: 1 });
  try {
    const { rows } = await pool.query(
      'SELECT normalized_code,display_name,status FROM public.tenants WHERE id=$1',
      [state.tenantId],
    );
    assert.equal(rows[0]?.normalized_code, state.tenantCode);
    assert.equal(rows[0]?.display_name, 'P2-U4C NATIVE ACCEPTANCE ONLY');
    assert.equal(rows[0]?.status, 'active');
  } finally {
    await pool.end();
  }
  process.umask(0o077);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const entry = lstatSync(dir);
  assert.ok(
    entry.isDirectory() &&
      !entry.isSymbolicLink() &&
      entry.uid === process.getuid() &&
      (entry.mode & 0o077) === 0,
  );
  assert.ok(
    !existsSync(socketPath),
    'Existing runtime must be stopped explicitly',
  );
  const issuer = {
    origin: c.origin,
    proxyPeers: ['127.0.0.1'],
    proxySecret: c.proxySecret,
    csrfSecret: secrets.staffCsrf,
  };
  const exchange = {
    origin: 'https://127.0.0.1:3444',
    proxyPeers: ['127.0.0.1'],
    proxySecret: secrets.exchangeProxy,
    csrfSecret: secrets.exchangeCsrf,
  };
  const limiter = backend('@myims/config').parseLimiterConfig({
    LIMITER_TRUSTED_PROXIES: '127.0.0.1',
  });
  const privateHost = Object.values(networkInterfaces())
    .flat()
    .find(
      (entry) => entry && !entry.internal && entry.family === 'IPv4',
    )?.address;
  assert.ok(privateHost);
  let offset = 0,
    selected = 'A',
    loseLogout = false,
    checking = false,
    lastToken,
    lastEvent;
  const clockOffsets = new Map();
  async function replica(name) {
    const child = fork(
      new URL('./native-acceptance/http-replica.mjs', import.meta.url),
      [],
      { silent: true },
    );
    // Never relay arbitrary child output: it may include errors from dependencies.
    child.stdout.resume();
    child.stderr.resume();
    let sequence = 0;
    const pending = new Map();
    child.on('message', (message) => {
      if (message.event === 'tracked') {
        assert.match(message.lifecycleId, /^[a-f0-9-]{36}$/);
        tracked.add(message.lifecycleId);
        assert.match(message.token, /^[A-Za-z0-9_-]{43}$/);
        ownedTokens.set(message.token, {
          lifecycleId: message.lifecycleId,
          generation: message.generation,
        });
        return;
      }
      const done = pending.get(message.id);
      if (done) {
        pending.delete(message.id);
        done.resolve(message.result ?? message);
      }
    });
    const failPending = () => {
      for (const value of pending.values()) value.reject();
      pending.clear();
    };
    child.on('error', failPending);
    child.on('exit', () => {
      failPending();
      if (!stopping) void stop();
    });
    const call = (operation, ...args) =>
      new Promise((accept, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Private IPC unavailable'));
        }, 15000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            accept(value);
          },
          reject: () => {
            clearTimeout(timer);
            reject(new Error('Private worker interrupted'));
          },
        });
        const message =
          operation === 'init'
            ? {
                id,
                operation,
                http: true,
                productionHttp: true,
                runtimeUrl: config.database.url,
                redisUrl: config.sessionRedis.url,
                config: config.sessions,
                limiterConfig: limiter,
                staffIssuerConfig: issuer,
                exchangeConfig: exchange,
                fixtureTenant: state.tenantId,
                fixtureIdentities: state.accounts.map((a) => a.id),
              }
            : operation === 'native-clock'
              ? { id, operation, offset, tracked: [args[0]] }
              : { id, operation, args };
        child.send(message);
      });
    const worker = { child, call, name };
    workers.push(worker);
    const result = await call('init');
    assert.equal(result.ready, true);
    worker.url = result.url;
    assert.equal(new URL(worker.url).hostname, '127.0.0.1');
    return worker;
  }
  await replica('A');
  await replica('B');
  async function setClock(next) {
    const target = ownedTokens.get(lastToken)?.lifecycleId;
    assert.ok(
      target &&
        next >= (clockOffsets.get(target) ?? 0) &&
        next <= 30 * 86400000,
    );
    offset = next;
    clockOffsets.set(target, next);
    for (const worker of workers)
      assert.equal((await worker.call('native-clock', target)).clockSet, true);
  }
  function native(path, body, token, extra = {}) {
    return new Promise((accept, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpsRequest(
        {
          hostname: privateHost,
          port: 3445,
          servername: 'localhost',
          ca: readFileSync('private/mkcert-rootCA.pem'),
          path: `/staff/auth/mobile/${path}`,
          method: path === 'session' ? 'GET' : 'POST',
          timeout: 10000,
          headers: {
            host: 'localhost:3444',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(payload ? { 'content-type': 'application/json' } : {}),
            ...extra,
          },
        },
        (res) => {
          assert.equal(res.socket.authorized, true);
          assert.equal(res.headers['cache-control'], 'no-store');
          let text = '';
          res.on('data', (chunk) => {
            text += chunk;
            if (text.length > 8192) res.destroy();
          });
          res.on('end', () =>
            accept({ status: res.statusCode, value: JSON.parse(text) }),
          );
          res.on('error', reject);
        },
      );
      req.on('timeout', () => req.destroy());
      req.on('error', reject);
      req.end(payload);
    });
  }
  proxy = httpServer((req, res) => {
    const path = req.url;
    if (!/^\/staff\/auth\/mobile\/(sign-in|session|logout)$/.test(path)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const chunks = [];
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 4096) req.destroy();
      else chunks.push(chunk);
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (path.endsWith('/sign-in')) {
        try {
          const value = JSON.parse(body.toString());
          assert.equal(value.tenantCode, state.tenantCode);
          assert.ok(state.accounts.some((a) => a.username === value.username));
        } catch {
          res.writeHead(403);
          res.end();
          return;
        }
      }
      const worker = workers.find((w) => w.name === selected);
      const token = req.headers.authorization?.slice(7);
      const upstream = httpRequest(
        `${worker.url}${path}`,
        { method: req.method, headers: req.headers },
        (incoming) => {
          const output = [];
          let size = 0;
          incoming.on('data', (chunk) => {
            size += chunk.length;
            if (size > 8192) incoming.destroy();
            else output.push(chunk);
          });
          incoming.on('end', () => {
            const data = Buffer.concat(output);
            let ownerMatches, account;
            if (
              incoming.statusCode === 200 ||
              (incoming.statusCode === 201 && path.endsWith('/sign-in'))
            ) {
              try {
                const value = JSON.parse(data.toString());
                ownerMatches =
                  value.tenantId === state.tenantId &&
                  state.accounts.some((a) => a.id === value.staffId);
                assert.equal(ownerMatches, true);
                account = state.accounts.find(
                  (a) => a.id === value.staffId,
                ).username;
                if (!checking) {
                  lastToken = value.token ?? token;
                  offset =
                    clockOffsets.get(ownedTokens.get(lastToken)?.lifecycleId) ??
                    0;
                }
              } catch {
                res.writeHead(503);
                res.end();
                return;
              }
            }
            const dropping =
              loseLogout &&
              path.endsWith('/logout') &&
              incoming.statusCode === 201;
            if (dropping) loseLogout = false;
            if (!checking) {
              lastEvent = {
                path: path.split('/').at(-1),
                replica: worker.name,
                status: incoming.statusCode,
                ...(ownerMatches === undefined ? {} : { ownerMatches }),
                ...(account ? { account } : {}),
                dropped: dropping,
              };
              evidence(lastEvent);
            }
            if (dropping) {
              res.destroy();
              return;
            }
            res.writeHead(incoming.statusCode, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              ...(incoming.headers['retry-after']
                ? { 'Retry-After': incoming.headers['retry-after'] }
                : {}),
            });
            res.end(data);
          });
          incoming.on('error', () => {
            if (!res.headersSent) res.writeHead(503);
            res.end();
          });
        },
      );
      upstream.setTimeout(10000, () => upstream.destroy());
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(503);
        res.end();
      });
      res.on('close', () => upstream.destroy());
      upstream.end(body);
    });
  });
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  assert.equal(lstatSync(c.keyFile).mode & 0o077, 0);
  ingress = createStaffIngress({
    tls: { key: readFileSync(c.keyFile), cert: readFileSync(c.certFile) },
    config: {
      ...c,
      recipientOrigin: exchange.origin,
      backendUrl: `http://127.0.0.1:${proxy.address().port}`,
    },
  });
  ingress.listen(3445, c.bind);
  await once(ingress, 'listening');
  async function selfCheck() {
    checking = true;
    const previous = selected;
    const tokens = [];
    try {
      for (const account of state.accounts) {
        evidence({ check: 'sign-in A', account: account.username });
        selected = 'A';
        const signed = await native('sign-in', {
          tenantCode: state.tenantCode,
          username: account.username,
          password: handoff.accounts.find((a) => a.staffId === account.id)
            .password,
        });
        assert.equal(signed.status, 201);
        evidence({ check: 'sign-in A', status: signed.status });
        tokens.push(signed.value.token);
        selected = 'B';
        const session = await native('session', undefined, signed.value.token);
        assert.equal(session.status, 200);
        assert.equal(session.value.staffId, account.id);
        assert.equal(session.value.tenantId, state.tenantId);
        assert.equal(
          session.value.absoluteExpiresAt,
          signed.value.absoluteExpiresAt,
        );
        assert.equal(session.value.idleExpiresAt, signed.value.idleExpiresAt);
        for (const headers of [
          { origin: c.origin },
          { cookie: 'synthetic=blocked' },
        ])
          assert.equal(
            (await native('session', undefined, signed.value.token, headers))
              .status,
            403,
          );
        assert.equal(
          (await native('session?_=1', undefined, signed.value.token)).status,
          403,
        );
        loseLogout = true;
        assert.equal(
          (await native('logout', undefined, signed.value.token)).status,
          503,
        );
        selected = 'A';
        assert.equal(
          (await native('session', undefined, signed.value.token)).status,
          401,
        );
        assert.equal(
          (await native('logout', undefined, signed.value.token)).status,
          201,
        );
      }
      evidence({
        check:
          'A/B canonical owner, unchanged passive deadlines, boundary denial, real dropped logout response and revoked retry',
        passed: true,
      });
      return { checked: true };
    } finally {
      loseLogout = false;
      for (const token of tokens)
        await native('logout', undefined, token).catch(() => {});
      selected = previous;
      checking = false;
    }
  }
  async function execute(command) {
    if (command === 'a' || command === 'b') selected = command.toUpperCase();
    else if (command === 'lose-logout') loseLogout = true;
    else if (command === 'idle') {
      assert.ok(lastToken && ownedTokens.has(lastToken));
      assert.equal((await workers[0].call('lookup', lastToken)).kind, 'found');
      await setClock(offset + config.sessions.mobile.idleMs + 1000);
      assert.equal(
        (await workers[0].call('lookup', lastToken)).kind,
        'invalid',
      );
    } else if (command === 'absolute') {
      assert.ok(lastToken);
      const worker = workers[0];
      let current = await worker.call('lookup', lastToken);
      assert.equal(current.kind, 'found');
      assert.ok(tracked.has(current.record.lifecycleId));
      const absolute = current.record.absoluteExpiresAt;
      // Successful operational activity is simulated only over trusted test IPC.
      // Renew at half-idle intervals to isolate absolute expiry under real policy.
      for (let step = 0; step < 16; step++) {
        const nextOffset =
          offset + Math.floor(config.sessions.mobile.idleMs / 2);
        if (
          current.record.lastActivityAt + config.sessions.mobile.idleMs / 2 >=
          absolute
        )
          break;
        await setClock(nextOffset);
        current = await worker.call(
          'renew',
          lastToken,
          {
            lifecycleId: current.record.lifecycleId,
            generation: current.record.generation,
          },
          'successful-operational',
        );
        assert.equal(current.kind, 'found');
        assert.equal(current.record.absoluteExpiresAt, absolute);
      }
      await setClock(offset + config.sessions.mobile.idleMs);
      assert.equal((await worker.call('lookup', lastToken)).kind, 'invalid');
    } else if (command === 'check') return { ok: true, ...(await selfCheck()) };
    else assert.ok(['status', 'stop'].includes(command));
    const result = {
      ok: true,
      selected,
      clockOffsetSeconds: offset / 1000,
      loseLogout,
      ...(lastEvent ? { lastEvent } : {}),
    };
    if (command !== 'status')
      evidence({
        control: command,
        selected,
        clockOffsetSeconds: offset / 1000,
      });
    return result;
  }
  let flight = Promise.resolve();
  control = controlServer({ allowHalfOpen: true }, (socket) => {
    socket.setTimeout(45000, () => socket.destroy());
    let text = '';
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      text += chunk;
      if (text.length > 32) socket.destroy();
    });
    socket.on('end', () => {
      flight = flight.then(async () => {
        try {
          assert.ok(actions.includes(text) && text !== 'start');
          socket.end(JSON.stringify(await execute(text)));
          if (text === 'stop') setTimeout(() => void stop(), 100);
        } catch (error) {
          evidence({
            control: text,
            failure: 'control failed',
            ...(error instanceof assert.AssertionError &&
            typeof error.actual === 'number'
              ? { actual: error.actual }
              : {}),
          });
          socket.end(
            JSON.stringify({
              ok: false,
              message:
                'Private acceptance control failed; no credentials logged.',
            }),
          );
        }
      });
    });
  });
  control.listen(socketPath);
  await once(control, 'listening');
  ownsSocket = true;
  chmodSync(socketPath, 0o600);
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
  console.log(
    'Native acceptance A/B runtime ready on private port 3445; exact public origin remains https://localhost:3444.',
  );
}
try {
  assert.ok(actions.includes(action) && process.argv.length === 3);
  if (action === 'start') await start();
  else await callControl(action);
} catch {
  console.error(
    'Native acceptance runtime unavailable; check private configuration, fixed fixture and ports. No secrets logged.',
  );
  process.exitCode = 1;
  await stop();
}
