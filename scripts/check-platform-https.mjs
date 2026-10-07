/* global window, document */
// Checks the approved real development stack. No fixture identities or sign-in attempts.
import assert from 'node:assert/strict';
import { request } from 'node:https';
import { createRequire } from 'node:module';
import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { readMaterial, browserOrigin } from './platform-https-material.mjs';

const material = readMaterial();
let phase = 'existing database snapshot',
  browser;
const require = createRequire(`${process.cwd()}/services/backend/package.json`);
const { Client } = require('pg');
const { loadBackendConfig } = require(
  `${process.cwd()}/services/backend/dist/infrastructure/configuration.js`,
);
const database = new Client({
  connectionString: loadBackendConfig().database.url,
});

async function snapshot() {
  await database.query(
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  );
  try {
    const result = await database.query(`SELECT
      (SELECT count(*) FROM public.platform_operators WHERE status='active' AND credential_state='ready') AS ready,
      (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text, '[]')) FROM public.platform_operators p) AS operators,
      (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text, '[]')) FROM public.staff_users p) AS staff,
      (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text, '[]')) FROM public.tenants p) AS tenants,
      (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY migration_name)::text, '[]')) FROM public._prisma_migrations p) AS migrations`);
    return result.rows[0];
  } finally {
    await database.query('ROLLBACK');
  }
}

function probe(
  path,
  {
    method = 'GET',
    headers = {},
    body = '',
    ca = material.ca,
    servername = 'localhost',
  } = {},
) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '::1',
        port: 3001,
        servername,
        ca,
        method,
        path,
        headers: {
          host: 'localhost:3443',
          'sec-fetch-site': 'none',
          ...headers,
        },
        timeout: 10000,
      },
      (response) => {
        const authorized = response.socket.authorized;
        const chunks = [];
        response.on('data', (bytes) => chunks.push(bytes));
        response.on('error', reject);
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            authorized,
          }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

async function check(label, task) {
  phase = label;
  await task();
  console.log(`PASS ${label}`);
}

try {
  await database.connect();
  const before = await snapshot();
  assert.ok(Number(before.ready) > 0);
  const credentialFiles = [
    'postgres-password',
    'runtime-postgres-password',
    'session-redis-auth.conf',
    'realtime-redis-auth.conf',
  ];
  const fileHashes = () =>
    credentialFiles.map((name) =>
      createHash('sha256')
        .update(readFileSync(`.local/shared-services/${name}`))
        .digest('hex'),
    );
  const beforeFiles = fileHashes();
  await check(
    'normal client assets exclude private secrets and verification form',
    async () => {
      const root = 'apps/platform-console-web/.next/static';
      let assets = 0;
      for (const name of readdirSync(root, { recursive: true })) {
        const path = `${root}/${name}`;
        if (!statSync(path).isFile()) continue;
        assets++;
        const content = readFileSync(path, 'utf8');
        for (const secret of Object.values(material.secrets))
          assert.ok(!content.includes(secret));
        for (const marker of [
          '-----BEGIN PRIVATE KEY-----',
          'PLATFORM_AUTH_PROXY_SECRET',
          'PLATFORM_AUTH_INGRESS_SECRET',
          'PLATFORM_AUTH_CSRF_SECRET',
          'Unfinished notes',
          'Unfinished-work verification form',
          'Submit retained work',
        ])
          assert.ok(!content.includes(marker));
      }
      assert.ok(assets > 0);
    },
  );
  await check('trusted development CA and localhost identity', async () => {
    const response = await probe('/sign-in');
    assert.equal(response.status, 200);
    assert.equal(response.authorized, true);
    assert.ok(response.body.includes('Sign in'));
    await assert.rejects(
      () => probe('/sign-in', { ca: [] }),
      (error) =>
        [
          'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
          'SELF_SIGNED_CERT_IN_CHAIN',
        ].includes(error.code),
    );
    await assert.rejects(
      () => probe('/sign-in', { servername: 'foreign.example' }),
      (error) => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID',
    );
  });
  let csrf;
  await check(
    'CSRF transport and host-only secure pre-auth cookie',
    async () => {
      csrf = await probe('/platform/auth/csrf', {
        headers: { 'sec-fetch-site': 'same-origin' },
      });
      assert.equal(csrf.status, 200);
      assert.equal(csrf.headers['cache-control'], 'no-store');
      const cookies = csrf.headers['set-cookie'];
      assert.equal(cookies.length, 1);
      assert.match(cookies[0], /^__Host-myims-platform-csrf=/);
      for (const attribute of [
        /; Secure/i,
        /; HttpOnly/i,
        /; SameSite=Lax/i,
        /; Path=\/(?:;|$)/i,
      ])
        assert.match(cookies[0], attribute);
      assert.doesNotMatch(cookies[0], /; Domain=/i);
      assert.ok(typeof JSON.parse(csrf.body).proof === 'string');
    },
  );
  await check(
    'unauthenticated session and protected console denial',
    async () => {
      assert.equal((await probe('/platform/auth/session')).status, 401);
      const page = await probe('/');
      assert.ok([302, 303, 307, 308].includes(page.status));
      assert.ok(page.headers.location.startsWith('/sign-in'));
    },
  );
  await check(
    'foreign Host, Origin, fetch metadata and bearer rejection',
    async () => {
      for (const headers of [
        { host: 'foreign.example' },
        { 'sec-fetch-site': 'cross-site' },
        { 'sec-fetch-site': ['same-origin', 'none'] },
        { authorization: 'Bearer rejected-placeholder' },
      ])
        assert.equal(
          (await probe('/platform/auth/csrf', { headers })).status,
          403,
        );
      for (const headers of [
        {},
        { origin: 'https://foreign.example' },
        { origin: [browserOrigin, 'https://foreign.example'] },
      ])
        assert.equal(
          (await probe('/platform/auth/sign-in', { method: 'POST', headers }))
            .status,
          403,
        );
      assert.equal((await probe('/platform/auth/unknown')).status, 403);
      assert.equal(
        (await probe('/platform/auth/csrf?unexpected=1')).status,
        403,
      );
      assert.equal(
        (await probe('//foreign.example/platform/auth/csrf')).status,
        403,
      );
    },
  );
  await check(
    'forged forwarding stripped and socket attribution retained',
    async () => {
      const response = await probe('/platform/auth/csrf', {
        headers: {
          'x-myims-ingress': 'forged',
          'x-myims-client-ip': '127.0.0.1',
          'x-myims-path': '/',
          'x-platform-proxy': 'forged',
          'x-forwarded-for': '127.0.0.1',
          forwarded: 'for=127.0.0.1',
          'x-real-ip': '127.0.0.1',
        },
      });
      assert.equal(response.status, 200);
    },
  );
  await check(
    'direct Next and backend authentication fail closed',
    async () => {
      const direct = await fetch('http://127.0.0.1:3003/platform/auth/csrf', {
        headers: {
          'sec-fetch-site': 'same-origin',
          'x-myims-ingress': 'forged',
          'x-myims-client-ip': '::1',
        },
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(direct.status, 503);
      await direct.body?.cancel();
      const backend = await fetch('http://127.0.0.1:4001/platform/auth/csrf', {
        headers: { origin: browserOrigin },
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(backend.status, 403);
      await backend.body?.cancel();
    },
  );
  await check('sign-in CSRF rejection and bounded malformed body', async () => {
    assert.equal(
      (
        await probe('/platform/auth/sign-in', {
          method: 'POST',
          headers: {
            origin: browserOrigin,
            'content-type': 'application/json',
          },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await probe('/platform/auth/sign-in', {
          method: 'POST',
          headers: {
            origin: browserOrigin,
            'content-type': 'application/json',
          },
          body: ' '.repeat(4097),
        })
      ).status,
      400,
    );
  });
  await check('absent-session logout with fresh CSRF context', async () => {
    const response = await probe('/platform/auth/logout', {
      method: 'POST',
      headers: {
        origin: browserOrigin,
        'content-type': 'application/json',
        cookie: csrf.headers['set-cookie'][0].split(';')[0],
        'x-platform-csrf': JSON.parse(csrf.body).proof,
      },
      body: '{}',
    });
    assert.equal(response.status, 201);
    assert.equal(JSON.parse(response.body).signedOut, true);
    assert.equal((await probe('/platform/auth/session')).status, 401);
  });
  await check(
    'normal browser sign-in presentation over real HTTPS ingress',
    async () => {
      // Linux Chromium does not use Node's CA store. Pin only the verified leaf key
      // for presentation checks; Node above verifies chain and hostname without bypass.
      // Windows certificate trust and actual account sign-in remain manual checks.
      const pin = createHash('sha256')
        .update(
          new X509Certificate(material.cert).publicKey.export({
            type: 'spki',
            format: 'der',
          }),
        )
        .digest('base64');
      try {
        phase = 'browser launch';
        browser = await chromium.launch({
          headless: true,
          args: [
            '--host-resolver-rules=MAP localhost [::1]',
            `--ignore-certificate-errors-spki-list=${pin}`,
          ],
        });
        const context = await browser.newContext();
        const page = await context.newPage();
        // Route the declared URL to the existing ingress without changing its origin.
        // Port forwarding is handled below by a local TCP tunnel, like the user's SSH tunnel.
        const { createServer, createConnection } = await import('node:net');
        const sockets = new Set();
        const tunnel = createServer((socket) => {
          const upstream = createConnection({ host: '::1', port: 3001 });
          sockets.add(socket);
          sockets.add(upstream);
          socket.on('close', () => {
            sockets.delete(socket);
            upstream.destroy();
          });
          upstream.on('close', () => {
            sockets.delete(upstream);
            socket.destroy();
          });
          socket.on('error', () => upstream.destroy());
          upstream.on('error', () => socket.destroy());
          socket.pipe(upstream).pipe(socket);
        });
        const { once } = await import('node:events');
        phase = 'browser tunnel listener';
        tunnel.listen(3443, '::1');
        await once(tunnel, 'listening');
        try {
          phase = 'browser HTTPS navigation';
          const navigation = await page.goto(`${browserOrigin}/sign-in`);
          phase = 'browser secure context and form labels';
          assert.equal(navigation.status(), 200);
          assert.equal(await page.evaluate(() => window.isSecureContext), true);
          assert.equal(
            await page.getByRole('textbox', { name: 'Username' }).count(),
            1,
          );
          assert.equal(await page.getByLabel(/^Password/).count(), 1);
          phase = 'browser form hydration';
          await page.waitForFunction(
            () => !document.querySelector('button[type="submit"]')?.disabled,
          );
        } finally {
          await context.close();
          for (const socket of sockets) socket.destroy();
          await new Promise((resolve) => tunnel.close(resolve));
        }
      } finally {
        await browser?.close();
        browser = undefined;
      }
    },
  );
  await check(
    'existing identities, migration history and shared credentials preserved',
    async () => {
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(fileHashes(), beforeFiles);
    },
  );
  console.log(
    'Automated private HTTPS checks complete. Existing operator browser sign-in remains a private manual step.',
  );
} catch (error) {
  const category = [
    'ERR_CERT_AUTHORITY_INVALID',
    'ERR_CONNECTION_REFUSED',
    "Executable doesn't exist",
    'EADDRINUSE',
    'Timeout',
  ].find((name) => String(error).includes(name));
  if (category) console.error(`Failure category: ${category}`);
  console.error(
    `FAIL ${phase}. No response bodies, credentials or account identifiers logged.`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  await database.end();
}
