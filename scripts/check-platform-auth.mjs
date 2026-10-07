// Isolated real PostgreSQL/runtime grants and Redis, independent HTTP processes.
import { checkPlatformBrowser } from './check-platform-browser.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { parseLimiterConfig, parsePlatformAuthConfig } =
  backend('@myims/config');
const { hashPassword, verifyPasswordOutcome, verifyPassword } = load(
  'infrastructure/password/scrypt',
);
const { Pool } = backend('pg');
const { Transaction } = load('infrastructure/database/transaction');
const { SafeLogger } = load('infrastructure/execution/logging');
const { OperatorAuthorityMutations } = load(
  'modules/platform/adapters/db/authority-mutations',
);
const { signInInput } = load('modules/platform/application/sign-in');
const cookieName = '__Host-myims-platform';
function cookieJar(headers) {
  return (headers ?? [])
    .map((value) => value.split(';')[0])
    .filter((value) => !value.endsWith('='))
    .join('; ');
}
export async function checkPlatformAuth({
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  ref,
  secrets,
  appUrl,
  proxy,
  commitProxy,
  browserChecks = true,
  browserOnly = false,
}) {
  const password = ' Exact Password Åe\u0301 fixture 2026 ';
  const passwordBytes = Buffer.from(password);
  const hash = await hashPassword(passwordBytes);
  secrets.push(password, hash);
  const pendingHash = hashPassword(passwordBytes);
  assert.equal(
    (await verifyPasswordOutcome(passwordBytes, hash)).kind,
    'unavailable',
  );
  await pendingHash;
  for (const material of [
    null,
    'unsupported',
    hash.replace('N=131072', 'N=999999'),
  ])
    assert.equal(
      (await verifyPasswordOutcome(passwordBytes, material)).kind,
      'mismatch',
    );
  assert.equal(
    (await verifyPasswordOutcome(passwordBytes, hash)).kind,
    'match',
  );
  assert.equal(await verifyPassword(passwordBytes, hash), true);
  for (const changed of [
    password.trim(),
    password.toLowerCase(),
    password.normalize('NFC'),
  ])
    assert.equal(
      (await verifyPasswordOutcome(Buffer.from(changed), hash)).kind,
      'mismatch',
    );
  for (const data of [
    { username: 'okay', password, tenant: 'x' },
    { username: 'okay', password: '\ud800'.repeat(15) },
    { username: 'bad\ud800', password },
    { username: 'okay', password: 'x'.repeat(129) },
    { username: 'okay', password: 'x'.repeat(14) },
    { username: 'okay', password: 'x'.repeat(15) + '\n' },
  ])
    assert.equal(signInInput(data), null);
  const config = {
    origin: 'https://localhost:9443',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  };
  secrets.push(config.proxySecret, config.csrfSecret);
  const env = {
    PLATFORM_AUTH_ORIGIN: config.origin,
    PLATFORM_AUTH_PROXY_PEERS: '127.0.0.1',
    PLATFORM_AUTH_PROXY_SECRET: config.proxySecret,
    PLATFORM_AUTH_CSRF_SECRET: config.csrfSecret,
    LIMITER_TRUSTED_PROXIES: '127.0.0.1',
  };
  assert.ok(parsePlatformAuthConfig(env));
  for (const change of [
    { PLATFORM_AUTH_ORIGIN: 'http://localhost' },
    { PLATFORM_AUTH_ORIGIN: 'https://localhost/' },
    { PLATFORM_AUTH_PROXY_PEERS: '0.0.0.0/0' },
    { PLATFORM_AUTH_CSRF_SECRET: config.proxySecret },
    { LIMITER_TRUSTED_PROXIES: '' },
    { PLATFORM_AUTH_PROXY_SECRET: 'sentinel' },
  ])
    assert.throws(() => parsePlatformAuthConfig({ ...env, ...change }));
  const id = randomUUID(),
    secondId = randomUUID(),
    disabled = randomUUID(),
    unset = randomUUID(),
    malformed = randomUUID();
  const username = `auth.${randomBytes(5).toString('hex')}`;
  secrets.push(username);
  const calls = [],
    records = [],
    pool = new Pool({ connectionString: appUrl, max: 2 });
  pool.on('error', () => {});
  let secureServer, browser, selected, nextTarget, ingressSecret, droppedPath;
  const ingressEvents = [];
  const directory = mkdtempSync(join(tmpdir(), 'myims-platform-browser-'));
  async function insert(
    operatorId,
    name,
    status = 'active',
    state = 'ready',
    material = hash,
  ) {
    await owner.query(
      'INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,$3,$4,$5,$6)',
      [
        operatorId,
        name,
        status,
        state,
        state === 'ready' ? material : null,
        state === 'ready' ? new Date() : null,
      ],
    );
  }
  async function change(operatorId, mutation) {
    const current = (
      await runtime.query(
        'SELECT version FROM public.platform_operators WHERE id=$1',
        [operatorId],
      )
    ).rows[0];
    const result = await Transaction.run(
      pool,
      {
        actor: {
          kind: 'system',
          plane: 'system',
          tenantId: null,
          reference: 'platform-auth-fixture',
          reason: 'verification',
        },
        target: { type: 'operator', reference: operatorId, tenantId: null },
        correlationId: randomUUID(),
      },
      'platform-auth-fixture.change',
      new SafeLogger('http', () => {}),
      (tx) =>
        new OperatorAuthorityMutations().change(
          tx,
          { plane: 'platform', operatorId },
          current.version,
          mutation,
        ),
    );
    assert.equal(result.kind, 'found');
  }
  const limiterConfig = parseLimiterConfig({
    LIMITER_TRUSTED_PROXIES: '127.0.0.1',
  });
  async function replica(override = {}) {
    const call = await worker({
      http: true,
      browserConfig: config,
      limiterConfig,
      config: backend('@myims/config').parseSessionConfig({
        SESSION_TIMEOUT_MS: '1000',
      }),
      ...override,
    });
    calls.push(call);
    return call;
  }
  function request(
    call,
    path,
    {
      method = 'GET',
      cookie,
      proof,
      body,
      headers = {},
      source = '192.0.2.10',
    } = {},
  ) {
    return new Promise((resolve, reject) => {
      const payload =
        body === undefined
          ? undefined
          : typeof body === 'string' || Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body);
      const req = httpRequest(
        `${call.url}${path}`,
        {
          method,
          headers: {
            origin: config.origin,
            'x-platform-proxy': config.proxySecret,
            'x-forwarded-for': source,
            ...(cookie ? { cookie } : {}),
            ...(proof ? { 'x-platform-csrf': proof } : {}),
            ...(payload !== undefined
              ? { 'content-type': 'application/json' }
              : {}),
            ...headers,
          },
        },
        (res) => {
          let text = '';
          res.on('data', (bytes) => (text += bytes));
          res.on('end', () => {
            let data;
            try {
              data = JSON.parse(text);
            } catch {
              data = null;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data,
              text,
            });
          });
        },
      );
      req.setTimeout(15000, () =>
        req.destroy(new Error('HTTP fixture deadline')),
      );
      req.on('error', reject);
      req.end(payload);
    });
  }
  const csrf = async (call, cookie, source) => {
    const result = await request(call, '/platform/auth/csrf', {
      cookie,
      source,
    });
    assert.equal(result.status, 200);
    secrets.push(result.data.proof);
    return {
      cookie: [cookie, cookieJar(result.headers['set-cookie'])]
        .filter(Boolean)
        .join('; '),
      proof: result.data.proof,
    };
  };
  async function login(
    call,
    name = username,
    supplied = password,
    source = '192.0.2.10',
    prior,
  ) {
    const context = await csrf(call, prior, source);
    const result = await request(call, '/platform/auth/sign-in', {
      method: 'POST',
      ...context,
      source,
      body: { username: name, password: supplied },
    });
    if (result.status === 201) {
      const cookie = cookieJar(result.headers['set-cookie']);
      const token = cookie.split('=')[1];
      secrets.push(token, key(token).split(':').at(-1), result.data.proof);
      records.push({ token, cookie, proof: result.data.proof });
      assert.ok(!result.text.includes(token));
      assert.deepEqual(Object.keys(result.data).sort(), [
        'absoluteExpiresAt',
        'idleExpiresAt',
        'operatorId',
        'plane',
        'proof',
      ]);
      return { ...result, cookie, token, proof: result.data.proof, context };
    }
    return result;
  }
  async function waitBarrier(call) {
    for (let i = 0; i < 200; i++) {
      if ((await call('barrier')).entered) return;
      await delay(10);
    }
    throw new Error('Auth barrier deadline');
  }
  async function runAppBrowser() {
    // The integrated journey uses the actual shipping HTTP module, including tenants.
    const a = await replica({ productionHttp: true }),
      b = await replica({ productionHttp: true });
    selected = a;
    const tenantId = randomUUID(),
      staffId = randomUUID();
    await owner.query(
      "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Browser fixture','active')",
      [tenantId, `${username}.browser-tenant`],
    );
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'browser.staff','active','ready',$3,clock_timestamp(),ARRAY['call_taker'])",
      [staffId, tenantId, hash],
    );
    const browserId = randomUUID(),
      browserSecond = randomUUID();
    const browserName = `${username}.browser`;
    await insert(browserId, browserName);
    await insert(browserSecond, `${browserName}.second`);
    await checkPlatformBrowser({
      config,
      a,
      b,
      select: (value) => {
        selected = value;
      },
      ingress: {
        events: () => ingressEvents.slice(-8),
        selected: () => selected,
        drop: (path) => {
          droppedPath = path;
        },
        next: (value, secret) => {
          nextTarget = value;
          ingressSecret = secret;
        },
      },
      username: browserName,
      password,
      owner,
      redis,
      key,
      secrets,
      records,
      issue,
      staffFacts: {
        plane: 'tenant',
        identityId: staffId,
        tenantId,
        authenticationVersion: 1,
        tenantAuthorityVersion: 1,
      },
      change: (value) =>
        change(browserId, {
          kind: 'status',
          status: value === 'disable' ? 'disabled' : 'active',
        }),
    });
  }
  try {
    await insert(id, username);
    await insert(secondId, `${username}.second`);
    await insert(disabled, `${username}.disabled`, 'disabled');
    await insert(unset, `${username}.unset`, 'active', 'unset');
    await insert(
      malformed,
      `${username}.malformed`,
      'active',
      'ready',
      'malformed',
    );
    await owner.query(
      'CREATE SCHEMA IF NOT EXISTS guard_fixture; GRANT USAGE ON SCHEMA guard_fixture TO myims_runtime; CREATE TABLE guard_fixture.platform_writes(actor_id uuid NOT NULL REFERENCES public.platform_operators(id)); GRANT INSERT,SELECT ON guard_fixture.platform_writes TO myims_runtime',
    );
    const result = spawnSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        join(directory, 'key.pem'),
        '-out',
        join(directory, 'cert.pem'),
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
      ],
      { stdio: 'ignore' },
    );
    assert.equal(result.status, 0);
    secureServer = createServer(
      {
        key: readFileSync(join(directory, 'key.pem')),
        cert: readFileSync(join(directory, 'cert.pem')),
      },
      (req, res) => {
        if (
          req.headers.host !== new URL(config.origin).host ||
          (req.method === 'GET' &&
            !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
        ) {
          res.writeHead(403).end();
          return;
        }
        if (req.method !== 'GET' && req.headers.origin !== config.origin) {
          res.writeHead(403).end();
          return;
        }
        if (nextTarget) {
          const forwarded = { ...req.headers };
          for (const name of [
            'x-myims-ingress',
            'x-myims-client-ip',
            'x-myims-path',
            'x-platform-proxy',
            'x-forwarded-for',
            'forwarded',
            'x-forwarded-host',
            'x-forwarded-proto',
            'x-forwarded-port',
            'connection',
            'proxy-connection',
            'keep-alive',
            'te',
            'trailer',
            'transfer-encoding',
            'upgrade',
            'content-length',
            'expect',
          ])
            delete forwarded[name];
          Object.assign(forwarded, {
            'x-myims-ingress': ingressSecret,
            'x-myims-client-ip': req.socket.remoteAddress,
            'x-myims-path': req.url.split('?')[0],
            'x-forwarded-proto': 'https',
            'x-forwarded-host': new URL(config.origin).host,
          });
          const consumer = ['csrf', 'sign-in', 'session', 'logout'].find(
            (value) => req.url === `/platform/auth/${value}`,
          );
          if (consumer) {
            ingressEvents.push(`next-${consumer}:sent`);
            let bytes = 0;
            req.on('data', (chunk) => {
              bytes += chunk.length;
            });
            req.on('end', () =>
              ingressEvents.push(
                `next-${consumer}:body-${bytes === Number(req.headers['content-length'] ?? 0) ? 'complete' : 'framed'}`,
              ),
            );
          }
          const outgoing = httpRequest(
            `${nextTarget}${req.url}`,
            { method: req.method, headers: forwarded },
            (incoming) => {
              if (consumer)
                ingressEvents.push(`next-${consumer}:${incoming.statusCode}`);
              if (droppedPath === req.url && incoming.statusCode === 201) {
                droppedPath = null;
                incoming.resume();
                // Truncate a started response without delivering cookies. Closing before
                // any response bytes allows Chromium to transparently retransmit a POST.
                res.writeHead(201, {
                  'Content-Type': 'application/json',
                  'Content-Length': '2',
                  'Cache-Control': 'no-store',
                });
                res.write('{');
                setTimeout(() => res.destroy(), 30);
                return;
              }
              res.writeHead(incoming.statusCode, incoming.headers);
              incoming.pipe(res);
            },
          );
          outgoing.on('error', () => res.writeHead(503).end());
          req.pipe(outgoing);
          return;
        }
        if (req.url === '/') {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><title>Secure transport fixture</title>');
          return;
        }
        if (
          ![
            '/platform/auth/csrf',
            '/platform/auth/sign-in',
            '/platform/auth/session',
            '/platform/auth/logout',
          ].includes(req.url)
        ) {
          res.writeHead(404).end();
          return;
        }
        const expectedMethod = [
          '/platform/auth/csrf',
          '/platform/auth/session',
        ].includes(req.url)
          ? 'GET'
          : 'POST';
        if (req.method !== expectedMethod) {
          res.writeHead(405).end();
          return;
        }
        const upstream = httpRequest(
          `${selected.url}${req.url}`,
          {
            method: req.method,
            headers: {
              'content-type': 'application/json',
              origin: req.method === 'GET' ? config.origin : req.headers.origin,
              'x-platform-proxy': config.proxySecret,
              'x-forwarded-for': '192.0.2.40',
              ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
              ...(req.headers['x-platform-csrf']
                ? { 'x-platform-csrf': req.headers['x-platform-csrf'] }
                : {}),
            },
          },
          (incoming) => {
            res.writeHead(incoming.statusCode, incoming.headers);
            incoming.pipe(res);
          },
        );
        upstream.on('error', () => res.writeHead(503).end());
        req.pipe(upstream);
      },
    );
    // Separate the real browser source (::1) from the trusted backend proxy peer (127.0.0.1).
    secureServer.listen(0, '::1');
    await once(secureServer, 'listening');
    config.origin = `https://localhost:${secureServer.address().port}`;
    if (browserOnly) {
      await runAppBrowser();
      return;
    }
    const a = await replica(),
      b = await replica();
    selected = a;
    // Origin/proxy/channel and malformed body fail before admission/verification.
    for (const headers of [
      { origin: '' },
      { origin: 'https://foreign.invalid' },
      { origin: [config.origin, config.origin] },
      { 'x-platform-proxy': '' },
    ])
      assert.equal(
        (await request(a, '/platform/auth/csrf', { headers })).status,
        403,
      );
    assert.equal(
      (
        await request(a, '/platform/auth/sign-in', {
          method: 'POST',
          body: { username, password },
        })
      ).status,
      403,
    );
    const clock = Date.now;
    let expiredCookie, expiredProof;
    try {
      Date.now = () => clock() - 601000;
      expiredProof = new (load(
        'modules/identity/adapters/http/platform-browser',
      ).PlatformBrowser)(config).bootstrap(
        {
          socket: { remoteAddress: '127.0.0.1' },
          headers: {
            origin: config.origin,
            'x-platform-proxy': config.proxySecret,
          },
          rawHeaders: [
            'Origin',
            config.origin,
            'X-Platform-Proxy',
            config.proxySecret,
          ],
        },
        {
          setHeader: (_name, value) => {
            expiredCookie = value.split(';')[0];
          },
        },
      ).proof;
    } finally {
      Date.now = clock;
    }
    assert.equal(
      (
        await request(a, '/platform/auth/sign-in', {
          method: 'POST',
          cookie: expiredCookie,
          proof: expiredProof,
          body: { username, password },
        })
      ).status,
      403,
    );
    let context = await csrf(a);
    assert.equal((await request(a, '/fixture/no-channel')).status, 403);
    assert.equal(
      (await request(a, '/fixture/platform-write', { method: 'POST' })).status,
      401,
    );
    for (const body of [
      { username, password, role: 'platform_operator' },
      { username, password: 'short' },
      { username, password: '\ud800'.repeat(15) },
      '{broken',
      ' '.repeat(4097),
      Buffer.from([123, 255, 125]),
    ])
      assert.equal(
        (
          await request(a, '/platform/auth/sign-in', {
            method: 'POST',
            ...context,
            body,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await request(a, '/platform/auth/sign-in', {
          method: 'POST',
          ...context,
          body: { username, password },
          headers: { 'x-forwarded-for': 'garbage' },
        })
      ).status,
      400,
    );
    for (const forwarding of ['127.0.0.1', ['192.0.2.1', '192.0.2.2']])
      assert.equal(
        (
          await request(a, '/platform/auth/sign-in', {
            method: 'POST',
            ...context,
            body: { username, password },
            headers: { 'x-forwarded-for': forwarding },
          })
        ).status,
        400,
      );
    assert.equal((await a('stats')).hashes, 0);
    assert.equal((await a('stats')).candidates, 0);
    const denials = [];
    for (const name of [
      `${username}.unknown`,
      `${username}.disabled`,
      `${username}.unset`,
      `${username}.malformed`,
      username,
    ]) {
      const result = await login(
        a,
        name,
        'Wrong password fixture 2026',
        `192.0.2.${20 + denials.length}`,
      );
      assert.equal(result.status, 401);
      denials.push(result.text);
    }
    assert.equal((await a('stats')).hashes, denials.length);
    assert.equal(new Set(denials).size, 1);
    const first = await login(a, `  ${username.toUpperCase()}  `),
      another = await login(b, `${username}.second`, password, '192.0.2.11');
    assert.equal(first.status, 201);
    assert.equal(first.data.operatorId, id);
    assert.equal(another.status, 201);
    const stored = await redis.get(key(first.token));
    const passive = await request(b, '/platform/auth/session', {
      cookie: first.cookie,
    });
    assert.equal(passive.status, 200);
    assert.equal(passive.headers['cache-control'], 'no-store');
    assert.equal(await redis.get(key(first.token)), stored);
    for (const cookie of [
      `${first.cookie}; ${first.cookie}`,
      `${cookieName}=bad`,
    ])
      assert.equal(
        (await request(b, '/platform/auth/session', { cookie })).status,
        401,
      );
    assert.equal(
      (
        await request(b, '/platform/auth/session', {
          cookie: first.cookie,
          headers: { authorization: `Bearer ${first.token}` },
        })
      ).status,
      401,
    );
    assert.equal(
      (await request(b, '/platform', { cookie: first.cookie })).status,
      401,
    );
    for (const options of [
      {},
      { proof: 'x'.repeat(43) },
      { proof: another.proof },
      { proof: first.proof, headers: { origin: 'https://foreign.invalid' } },
    ])
      assert.equal(
        (
          await request(b, '/fixture/platform-write', {
            method: 'POST',
            cookie: first.cookie,
            ...options,
          })
        ).status,
        403,
      );
    assert.equal(
      (
        await request(b, '/fixture/platform-write', {
          method: 'POST',
          cookie: first.cookie,
          proof: first.proof,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await runtime.query(
          'SELECT count(*)::int AS n FROM guard_fixture.platform_writes',
        )
      ).rows[0].n,
      1,
    );
    const replacement = await login(
      a,
      username,
      password,
      '192.0.2.12',
      first.cookie,
    );
    assert.equal(replacement.status, 201);
    assert.ok(replacement.token !== first.token);
    assert.equal(
      (
        await request(a, '/fixture/platform-write', {
          method: 'POST',
          cookie: replacement.cookie,
          proof: first.proof,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(a, '/platform/auth/sign-in', {
          method: 'POST',
          cookie: replacement.cookie,
          proof: first.context.proof,
          body: { username, password },
        })
      ).status,
      403,
    );
    for (const options of [
      {},
      { proof: another.proof },
      { proof: first.proof, headers: { origin: '' } },
      { proof: first.proof, headers: { origin: 'https://foreign.invalid' } },
    ])
      assert.equal(
        (
          await request(b, '/platform/auth/logout', {
            method: 'POST',
            cookie: first.cookie,
            ...options,
          })
        ).status,
        403,
      );
    const freshContext = await csrf(b, replacement.cookie);
    assert.equal(
      (
        await request(b, '/platform/auth/sign-in', {
          method: 'POST',
          cookie: freshContext.cookie,
          proof: first.context.proof,
          body: { username, password },
        })
      ).status,
      403,
    );
    const beforeLogout = await redis.get(key(first.token));
    assert.equal(
      (
        await request(b, '/platform/auth/logout', {
          method: 'POST',
          cookie: first.cookie,
          proof: first.proof,
        })
      ).status,
      201,
    );
    assert.equal(
      (await request(a, '/platform/auth/session', { cookie: first.cookie }))
        .status,
      401,
    );
    assert.equal(
      (
        await request(a, '/platform/auth/session', {
          cookie: replacement.cookie,
        })
      ).status,
      200,
    );
    await redis.set(key(first.token), beforeLogout);
    assert.equal(
      (await request(a, '/platform/auth/session', { cookie: first.cookie }))
        .status,
      401,
    );
    assert.equal(
      (await request(a, '/platform/auth/session', { cookie: another.cookie }))
        .status,
      200,
    );
    assert.equal(
      (
        await request(a, '/platform/auth/logout', {
          method: 'POST',
          cookie: first.cookie,
          proof: first.proof,
        })
      ).status,
      201,
    );
    const retry = await csrf(b);
    assert.equal(
      (await request(b, '/platform/auth/logout', { method: 'POST', ...retry }))
        .status,
      201,
    );
    await change(id, { kind: 'status', status: 'disabled' });
    for (const call of [a, b])
      assert.equal(
        (
          await request(call, '/platform/auth/session', {
            cookie: replacement.cookie,
          })
        ).status,
        401,
      );
    await change(id, { kind: 'status', status: 'active' });
    const tenantId = randomUUID(),
      staffId = randomUUID();
    await owner.query(
      "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Auth fixture','active')",
      [tenantId, `${username}.tenant`],
    );
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'staff','active','ready',$3,clock_timestamp(),ARRAY['call_taker'])",
      [staffId, tenantId, hash],
    );
    const staffSession = await issue(a, {
      plane: 'tenant',
      identityId: staffId,
      tenantId,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    const staffCookie = `${cookieName}=${staffSession.token}`;
    const staffProof = new (load(
      'modules/identity/adapters/http/platform-browser',
    ).PlatformBrowser)(config).sessionProof(staffSession.token);
    assert.equal(
      (await request(b, '/platform/auth/session', { cookie: staffCookie }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(b, '/platform/auth/logout', {
          method: 'POST',
          cookie: staffCookie,
          proof: staffProof,
        })
      ).status,
      403,
    );
    assert.equal((await a('lookup', staffSession.token)).kind, 'found');
    assert.equal(
      (
        await request(a, `/staff/${tenantId}`, {
          headers: { authorization: `Bearer ${another.token}` },
        })
      ).status,
      403,
    );
    await a('revoke', staffSession.token, ref(staffSession));
    // Candidate/private-read/issuance race against real canonical mutation.
    for (const stage of ['credential-read', 'verified-issuance']) {
      await a('prepare', stage);
      const loginPromise = login(a, username, password, '192.0.2.13');
      await waitBarrier(a);
      await change(id, {
        kind: 'credential',
        credentialState: 'ready',
        passwordHash: hash,
        credentialChangedAt: new Date(),
      });
      await a('release');
      const raced = await loginPromise;
      assert.equal(raced.status, 401);
    }
    console.log(
      'PASS platform credential/CSRF/canonical race checks; checking independent shared budgets',
    );
    // Keep budget proofs inside one real Redis fixed window, rather than relying
    // on when this suite happened to start relative to an epoch boundary.
    const redisTime = await redis.sendCommand(['TIME']);
    const remainingWindow = 900 - (Number(redisTime[0]) % 900);
    if (remainingWindow < 240) {
      console.log(
        'CHECK: align platform auth budget fixture to the next fixed window',
      );
      await delay((remainingWindow + 1) * 1000);
    }
    // Shared independent identity and source budgets before hash work.
    const limitedName = `${username}.limit`;
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await login(
            i % 2 ? a : b,
            limitedName,
            password,
            `198.51.100.${i + 1}`,
          )
        ).status,
        401,
      );
    const limit = await login(b, limitedName, password, '198.51.100.30');
    assert.equal(limit.status, 429);
    const successId = randomUUID(),
      successName = `${username}.success.limit`;
    await insert(successId, successName);
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await login(
            i % 2 ? a : b,
            successName,
            password,
            `198.51.100.${50 + i}`,
          )
        ).status,
        201,
      );
    const beforeLimited = (await a('stats')).hashes;
    assert.equal(
      (await login(a, successName, password, '198.51.100.70')).status,
      429,
    );
    assert.equal((await a('stats')).hashes, beforeLimited);
    assert.ok(Number(limit.headers['retry-after']) <= 900);
    // Fill one real source with distinct unknown identities using its approved limit.
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await login(
            i % 2 ? a : b,
            `${username}.source.${i}`,
            password,
            '203.0.113.10',
          )
        ).status,
        401,
      );
    assert.equal(
      (await login(a, `${username}.source.extra`, password, '203.0.113.10'))
        .status,
      429,
    );
    console.log(
      'PASS platform A-01–07: real credentials, shared limits, cookie/CSRF channels, canonical races and cross-replica logout',
    );
    await a('hash-failure', true);
    secrets.push('HASH_INTERNAL_FAILURE_SENTINEL');
    const failedCrypto = await login(
      a,
      `${username}.internal`,
      password,
      '192.0.2.50',
    );
    assert.equal(failedCrypto.status, 503);
    assert.equal(failedCrypto.headers['retry-after'], '1');
    for (let i = 0; i < 9; i++)
      assert.equal(
        (
          await login(
            a,
            `${username}.downstream`,
            password,
            `198.51.100.${80 + i}`,
          )
        ).status,
        503,
      );
    assert.equal(
      (await login(a, `${username}.downstream`, password, '198.51.100.90'))
        .status,
      503,
    );
    assert.equal(
      (await login(b, `${username}.downstream`, password, '198.51.100.91'))
        .status,
      429,
    );
    await a('hash-failure', false);
    assert.equal(
      (await login(a, `${username}.internal`, password, '192.0.2.50')).status,
      401,
    );
    // Hash busy is a retryable failure on the actual HTTP use case.
    const concurrent = await Promise.all([
      login(a, `${username}.second`, password, '192.0.2.31'),
      login(a, `${username}.second`, password, '192.0.2.32'),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 503]);
    const pgDown = await replica({
      canonicalUrl: 'postgresql://myims_runtime:unavailable@127.0.0.1:1/absent',
    });
    assert.equal(
      (await login(pgDown, `${username}.second`, password, '192.0.2.33'))
        .status,
      503,
    );
    const lost = await proxy();
    const uncertain = await replica({ limiterUrl: lost.url });
    lost.arm();
    const denied = await login(
      uncertain,
      `${username}.second`,
      password,
      '192.0.2.34',
    );
    assert.equal(denied.status, 503);
    assert.equal(denied.headers['retry-after'], '1');
    assert.ok(
      denied.headers['set-cookie'] === undefined,
      'Failed operations must not set authentication cookies',
    );
    const commitLoss = await commitProxy();
    const uncertainIssue = await replica({ runtimeUrl: commitLoss.url });
    const lostIssue = await login(
      uncertainIssue,
      `${username}.second`,
      password,
      '192.0.2.35',
    );
    assert.equal(lostIssue.status, 503);
    assert.ok(commitLoss.dropped());
    assert.ok(
      lostIssue.headers['set-cookie'] === undefined,
      'Failed operations must not set authentication cookies',
    );
    // Real database rejection of durable revocation cannot clear a browser cookie.
    const valid = await login(b, `${username}.second`, password, '192.0.2.36');
    assert.equal(valid.status, 201);
    await owner.query(
      "ALTER TABLE public.audit_events ADD CONSTRAINT auth_fixture_reject CHECK (NOT (event_type = 'identity.session-fence' AND metadata->>'operation' = 'revoked')) NOT VALID",
    );
    const rejectedLogout = await request(a, '/platform/auth/logout', {
      method: 'POST',
      cookie: valid.cookie,
      proof: valid.proof,
    });
    await owner.query(
      'ALTER TABLE public.audit_events DROP CONSTRAINT auth_fixture_reject',
    );
    assert.equal(rejectedLogout.status, 503);
    assert.ok(
      rejectedLogout.headers['set-cookie'] === undefined,
      'Failed operations must not set authentication cookies',
    );
    assert.equal(
      (await request(b, '/platform/auth/session', { cookie: valid.cookie }))
        .status,
      200,
    );
    const faultId = randomUUID(),
      faultName = `${username}.fault`;
    await insert(faultId, faultName);
    const logoutTarget = await login(b, faultName, password, '192.0.2.51');
    assert.equal(logoutTarget.status, 201);
    const revokeLoss = await commitProxy();
    const unconfirmedRevoke = await replica({ runtimeUrl: revokeLoss.url });
    const lostRevoke = await request(
      unconfirmedRevoke,
      '/platform/auth/logout',
      {
        method: 'POST',
        cookie: logoutTarget.cookie,
        proof: logoutTarget.proof,
      },
    );
    assert.equal(lostRevoke.status, 503);
    assert.ok(revokeLoss.dropped());
    assert.ok(
      lostRevoke.headers['set-cookie'] === undefined,
      'Failed operations must not set authentication cookies',
    );
    for (const call of [a, b])
      assert.equal(
        (
          await request(call, '/platform/auth/session', {
            cookie: logoutTarget.cookie,
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await request(b, '/platform/auth/logout', {
          method: 'POST',
          cookie: logoutTarget.cookie,
          proof: logoutTarget.proof,
        })
      ).status,
      201,
    );
    const sessionLoss = await proxy();
    const unconfirmedRedis = await replica({
      redisUrl: sessionLoss.url,
      limiterUrl: redis.options.url,
    });
    sessionLoss.arm();
    const redisIssue = await login(
      unconfirmedRedis,
      faultName,
      password,
      '192.0.2.52',
    );
    assert.equal(redisIssue.status, 503);
    assert.ok(
      redisIssue.headers['set-cookie'] === undefined,
      'Failed operations must not set authentication cookies',
    );
    const short = await replica({
      config: backend('@myims/config').parseSessionConfig({
        SESSION_TIMEOUT_MS: '100',
        SESSION_WEB_IDLE_SECONDS: '2',
        SESSION_WEB_ABSOLUTE_SECONDS: '4',
      }),
    });
    const expiring = await login(short, faultName, password, '192.0.2.53');
    assert.equal(expiring.status, 201);
    const initialRecord = JSON.parse(await redis.get(key(expiring.token)));
    await delay(500);
    assert.equal(
      (await request(a, '/platform/auth/session', { cookie: expiring.cookie }))
        .status,
      200,
    );
    assert.equal(
      JSON.parse(await redis.get(key(expiring.token))).idleExpiresAt,
      initialRecord.idleExpiresAt,
    );
    assert.equal(
      (
        await request(b, '/fixture/platform-write', {
          method: 'POST',
          cookie: expiring.cookie,
          proof: expiring.proof,
        })
      ).status,
      201,
    );
    const renewedRecord = JSON.parse(await redis.get(key(expiring.token)));
    assert.ok(renewedRecord.idleExpiresAt > initialRecord.idleExpiresAt);
    assert.equal(
      renewedRecord.absoluteExpiresAt,
      initialRecord.absoluteExpiresAt,
    );
    const rotated = await short(
      'rotate',
      expiring.token,
      ref({ record: renewedRecord }),
    );
    assert.equal(rotated.kind, 'rotated');
    secrets.push(rotated.token);
    records.push({ token: rotated.token });
    assert.equal(
      rotated.record.absoluteExpiresAt,
      initialRecord.absoluteExpiresAt,
    );
    assert.equal(
      (
        await request(a, '/fixture/platform-write', {
          method: 'POST',
          cookie: `${cookieName}=${rotated.token}`,
          proof: expiring.proof,
        })
      ).status,
      403,
    );
    await delay(2100);
    for (const call of [a, b])
      assert.equal(
        (
          await request(call, '/platform/auth/session', {
            cookie: `${cookieName}=${rotated.token}`,
          })
        ).status,
        401,
      );
    const writesBefore = (
      await runtime.query(
        'SELECT count(*)::int AS n FROM guard_fixture.platform_writes',
      )
    ).rows[0].n;
    await a('prepare', 'before-lock');
    const staleWrite = request(a, '/fixture/platform-write', {
      method: 'POST',
      cookie: valid.cookie,
      proof: valid.proof,
    });
    await waitBarrier(a);
    await change(secondId, { kind: 'status', status: 'disabled' });
    await a('release');
    assert.equal((await staleWrite).status, 401);
    assert.equal(
      (
        await runtime.query(
          'SELECT count(*)::int AS n FROM guard_fixture.platform_writes',
        )
      ).rows[0].n,
      writesBefore,
    );
    await change(secondId, { kind: 'status', status: 'active' });
    const production = await replica({ productionHttp: true });
    const productionLogin = await login(
      production,
      faultName,
      password,
      '192.0.2.54',
    );
    assert.equal(productionLogin.status, 201);
    assert.equal(
      (
        await request(production, '/platform/auth/session', {
          cookie: productionLogin.cookie,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(production, '/platform/auth/logout', {
          method: 'POST',
          cookie: productionLogin.cookie,
          proof: productionLogin.proof,
        })
      ).status,
      201,
    );
    const raceSession = await login(b, faultName, password, '192.0.2.55');
    assert.equal(raceSession.status, 201);
    const retainedRace = await redis.get(key(raceSession.token));
    await a('prepare', 'after-lock');
    const renewingWrite = request(a, '/fixture/platform-write', {
      method: 'POST',
      cookie: raceSession.cookie,
      proof: raceSession.proof,
    });
    await waitBarrier(a);
    assert.equal(
      (
        await request(b, '/platform/auth/logout', {
          method: 'POST',
          cookie: raceSession.cookie,
          proof: raceSession.proof,
        })
      ).status,
      201,
    );
    await a('release');
    assert.equal((await renewingWrite).status, 401);
    await redis.set(key(raceSession.token), retainedRace);
    for (const call of [a, b])
      assert.equal(
        (
          await request(call, '/platform/auth/session', {
            cookie: raceSession.cookie,
          })
        ).status,
        401,
      );
    // Actual browser secure transport acceptance, using a bounded non-shipping proxy.
    browser = await chromium.launch({ headless: true });
    const browserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    const page = await browserContext.newPage();
    await page.goto(`https://localhost:${secureServer.address().port}`);
    const browserLogin = await page.evaluate(
      async ({ username, password }) => {
        const c = await fetch('/platform/auth/csrf');
        const { proof } = await c.json();
        const r = await fetch('/platform/auth/sign-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Platform-CSRF': proof,
          },
          body: JSON.stringify({ username, password }),
        });
        return {
          status: r.status,
          data: await r.json(),
          cookies: globalThis.document.cookie,
          local: globalThis.localStorage.length,
          session: globalThis.sessionStorage.length,
          secure: globalThis.isSecureContext,
        };
      },
      { username: `${username}.second`, password },
    );
    assert.equal(browserLogin.status, 201);
    assert.equal(browserLogin.secure, true);
    assert.ok(
      browserLogin.cookies === '',
      'Authentication cookies must remain HttpOnly',
    );
    assert.equal(browserLogin.local, 0);
    assert.equal(browserLogin.session, 0);
    const accepted = (await browserContext.cookies()).find(
      (c) => c.name === cookieName,
    );
    assert.ok(
      accepted?.secure &&
        accepted.httpOnly &&
        accepted.sameSite === 'Lax' &&
        accepted.path === '/' &&
        accepted.domain === 'localhost',
    );
    secrets.push(accepted.value, browserLogin.data.proof);
    records.push({ token: accepted.value });
    assert.ok(accepted.expires * 1000 <= browserLogin.data.absoluteExpiresAt);
    selected = b;
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/auth/session')).status,
      ),
      200,
    );
    assert.equal(
      await page.evaluate(
        async (proof) =>
          (
            await fetch('/platform/auth/logout', {
              method: 'POST',
              headers: { 'X-Platform-CSRF': proof },
            })
          ).status,
        browserLogin.data.proof,
      ),
      201,
    );
    selected = a;
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/auth/session')).status,
      ),
      401,
    );
    assert.ok(
      !(await browserContext.cookies()).some((c) => c.name === cookieName),
    );
    await browserContext.close();
    if (browserChecks) await runAppBrowser();
    console.log(
      'PASS platform A-08–09: hash capacity, real failure/response-loss boundaries and HTTPS Chromium Secure/HttpOnly cookie acceptance',
    );
  } finally {
    if (browser) await browser.close();
    if (secureServer) {
      secureServer.closeAllConnections();
      await new Promise((resolve) => secureServer.close(resolve));
    }
    for (const call of calls) {
      await call('release');
      await call('close');
    }
    for (const value of records) await redis.del(key(value.token));
    await pool.end();
    passwordBytes.fill(0);
    rmSync(directory, { recursive: true, force: true });
  }
}
