// Backend clock evidence only; actual native expiry UI remains a separate check.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { readFileSync, lstatSync } from 'node:fs';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const config = backend(
  './dist/infrastructure/configuration.js',
).loadBackendConfig();
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(new URL(config.database.url).hostname, 'postgres');
assert.equal(new URL(config.database.url).pathname, '/myims');
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
const state = privateJson('.local/staff-native-fixture/state.json');
const handoff = privateJson('.local/staff-native-fixture/handoff.json');
assert.equal(state.kind, 'P2-U4C-development-acceptance');
assert.equal(state.state, 'ready');
const account = state.accounts.find((a) => a.username === 'native.other');
assert.ok(account);
const issuer = {
  origin: 'https://localhost:3444',
  proxyPeers: ['127.0.0.1'],
  proxySecret: randomBytes(32).toString('hex'),
  csrfSecret: randomBytes(32).toString('hex'),
};
const workers = [],
  tracked = new Map();
const clockOffsets = new Map();
let offset = 0,
  phase = 'initialization';
async function worker() {
  const child = fork(
    new URL('./native-acceptance/http-replica.mjs', import.meta.url),
    [],
    { silent: true },
  );
  child.stdout.resume();
  child.stderr.resume();
  let sequence = 0;
  const pending = new Map();
  child.on('message', (m) => {
    if (m.event === 'issuance-outcome') {
      console.log(
        `Finite fixture issuance outcome: ${['invalid', 'unavailable', 'conflict'].includes(m.kind) ? m.kind : 'other'}`,
      );
      return;
    }
    if (m.event === 'tracked') {
      tracked.set(m.token, {
        lifecycleId: m.lifecycleId,
        generation: m.generation,
      });
      return;
    }
    pending.get(m.id)?.(m.result ?? m);
    pending.delete(m.id);
  });
  const call = (operation, ...args) =>
    new Promise((accept, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Clock fixture unavailable'));
      }, 15000);
      pending.set(id, (value) => {
        clearTimeout(timer);
        accept(value);
      });
      child.send(
        operation === 'init'
          ? {
              id,
              operation,
              http: true,
              productionHttp: true,
              runtimeUrl: config.database.url,
              redisUrl: config.sessionRedis.url,
              config: config.sessions,
              limiterConfig: backend('@myims/config').parseLimiterConfig({
                LIMITER_TRUSTED_PROXIES: '127.0.0.1',
              }),
              staffIssuerConfig: issuer,
              fixtureTenant: state.tenantId,
              fixtureIdentities: state.accounts.map((a) => a.id),
            }
          : operation === 'native-clock'
            ? {
                id,
                operation,
                offset,
                tracked: [args[0]],
              }
            : { id, operation, args },
      );
    });
  const value = { child, call };
  workers.push(value);
  const result = await call('init');
  assert.equal(result.ready, true);
  value.url = result.url;
  return value;
}
async function advance(milliseconds, token) {
  const id = tracked.get(token).lifecycleId;
  offset = (clockOffsets.get(id) ?? 0) + milliseconds;
  clockOffsets.set(id, offset);
  for (const w of workers)
    assert.equal((await w.call('native-clock', id)).clockSet, true);
}
async function request(w, path, token, body) {
  return new Promise((accept, reject) => {
    const req = httpRequest(
      `${w.url}/staff/auth/mobile/${path}`,
      {
        method: path === 'session' ? 'GET' : 'POST',
        timeout: 10000,
        headers: {
          'x-staff-mobile-proxy': issuer.proxySecret,
          'x-forwarded-for': '192.0.2.77',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => {
          text += chunk;
          if (text.length > 8192) res.destroy();
        });
        res.on('end', () => {
          try {
            assert.equal(res.headers['cache-control'], 'no-store');
            accept({ status: res.statusCode, value: JSON.parse(text) });
          } catch {
            reject(new Error('Clock fixture response invalid'));
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy());
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
try {
  const a = await worker(),
    b = await worker();
  const signIn = async () => {
    phase = 'real sign-in';
    const signed = await request(a, 'sign-in', undefined, {
      tenantCode: state.tenantCode,
      username: account.username,
      password: handoff.accounts.find((v) => v.staffId === account.id).password,
    });
    assert.equal(signed.status, 201);
    return signed.value;
  };
  const idle = await signIn();
  for (let n = 0; n < 3; n++) {
    phase = 'passive checks';
    const session = await request(b, 'session', idle.token);
    assert.equal(session.status, 200);
    assert.equal(session.value.idleExpiresAt, idle.idleExpiresAt);
    assert.equal(session.value.absoluteExpiresAt, idle.absoluteExpiresAt);
  }
  await advance(config.sessions.mobile.idleMs + 1000, idle.token);
  phase = 'idle denial';
  assert.equal((await request(a, 'session', idle.token)).status, 401);
  assert.equal((await request(b, 'session', idle.token)).status, 401);
  console.log(
    'PASS native backend idle expiry: actual production A/B graph, passive checks preserve approved 24-hour deadline.',
  );
  const absolute = await signIn();
  phase = 'absolute setup';
  let token = absolute.token,
    current = await a.call('lookup', token),
    rotated = false;
  const reference = () => ({
    lifecycleId: current.record.lifecycleId,
    generation: current.record.generation,
  });
  const halfDay = Math.floor(config.sessions.mobile.idleMs / 2);
  for (let n = 0; n < 13; n++) {
    phase = 'absolute operational renewal';
    await advance(halfDay, token);
    current = await a.call(
      'renew',
      token,
      reference(),
      'successful-operational',
    );
    assert.equal(current.kind, 'found');
    assert.equal(current.record.absoluteExpiresAt, absolute.absoluteExpiresAt);
    if (!rotated) {
      phase = 'rotation';
      const next = await b.call('rotate', token, reference());
      assert.equal(next.kind, 'rotated');
      assert.equal(next.record.absoluteExpiresAt, absolute.absoluteExpiresAt);
      assert.equal((await request(a, 'session', token)).status, 401);
      tracked.set(next.token, {
        lifecycleId: next.record.lifecycleId,
        generation: next.record.generation,
      });
      token = next.token;
      current = { kind: 'found', record: next.record };
      rotated = true;
    }
    const session = await request(b, 'session', token);
    assert.equal(session.status, 200);
    assert.equal(session.value.absoluteExpiresAt, absolute.absoluteExpiresAt);
  }
  await advance(halfDay + 1000, token);
  phase = 'absolute denial';
  assert.equal((await request(a, 'session', token)).status, 401);
  assert.equal((await request(b, 'session', token)).status, 401);
  console.log(
    'PASS native backend absolute expiry: approved 7-day cap, simulated operational renewals and actual rotation preserve original deadline.',
  );
} catch (error) {
  console.error(
    `FAIL scoped native clock acceptance during ${phase}; no credentials or tokens logged.`,
  );
  if (
    error instanceof assert.AssertionError &&
    (typeof error.actual === 'number' ||
      ['found', 'invalid', 'unavailable', 'conflict'].includes(error.actual))
  )
    console.error(`Finite observed result: ${error.actual}`);
  process.exitCode = 1;
} finally {
  for (const [token, reference] of tracked)
    assert.equal(
      (await workers[0].call('revoke', token, reference)).kind,
      'revoked',
    );
  for (const w of workers) {
    const timer = setTimeout(() => w.child.kill('SIGKILL'), 5000);
    try {
      await w.call('close');
    } finally {
      clearTimeout(timer);
      w.child.kill();
    }
  }
}
