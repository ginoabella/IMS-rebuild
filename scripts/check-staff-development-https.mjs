/* global document */
// Real local stack verification; never signs in, exchanges a code or creates fixture identities.
import assert from 'node:assert/strict';
import { request } from 'node:https';
import { createHash, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer, createConnection } from 'node:net';
import { once } from 'node:events';
import { chromium, expect } from '@playwright/test';
import { readMaterial } from './platform-https-material.mjs';
const origin = 'https://127.0.0.1:3444',
  material = readMaterial();
const staffOrigin = 'https://localhost:3444';
const leafCertificate = readFileSync(
  '.local/staff-development-https/tls/server.crt',
);
const secrets = Object.values(
  JSON.parse(readFileSync('.local/staff-development-https/auth.json', 'utf8')),
);
const require = createRequire(`${process.cwd()}/services/backend/package.json`);
const { Client } = require('pg');
const { loadBackendConfig } = require(
  `${process.cwd()}/services/backend/dist/infrastructure/configuration.js`,
);
const db = new Client({ connectionString: loadBackendConfig().database.url });
let phase = 'canonical snapshot',
  browser;
async function snapshot() {
  return (
    await db.query(`SELECT
    (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]')) FROM public.tenants p) AS tenants,
    (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]')) FROM public.staff_users p) AS staff,
    (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]')) FROM public.platform_operators p) AS operators,
    (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text,'[]')) FROM public.credential_actions p) AS actions,
    (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY migration_name)::text,'[]')) FROM public._prisma_migrations p) AS migrations`)
  ).rows[0];
}
function probe(
  path,
  {
    method = 'GET',
    headers = {},
    body = '',
    ca = material.ca,
    hostname = '::1',
    servername = 'localhost',
  } = {},
) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname,
        port: 3002,
        servername,
        ca,
        path,
        method,
        timeout: 10000,
        headers: {
          host:
            path.startsWith('/staff/') || path === '/'
              ? 'localhost:3444'
              : '127.0.0.1:3444',
          'sec-fetch-site': 'none',
          ...headers,
        },
      },
      (response) => {
        const authorized = response.socket.authorized;
        const chunks = [];
        response.on('data', (b) => chunks.push(b));
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
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.end(body);
  });
}
async function check(name, fn) {
  phase = name;
  await fn();
  console.log(`PASS ${name}`);
}
try {
  await db.connect();
  const before = await snapshot();
  await check(
    'recipient page with trusted CA/hostname and no-store',
    async () => {
      const r = await probe('/credentials', {
        hostname: '127.0.0.1',
        servername: '',
      });
      assert.equal(r.status, 200);
      assert.equal(r.authorized, true);
      assert.match(r.headers['cache-control'], /no-store/);
      assert.match(r.body, /Set staff credentials/);
      await assert.rejects(
        () => probe('/credentials', { ca: [] }),
        (e) =>
          [
            'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
            'SELF_SIGNED_CERT_IN_CHAIN',
            'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
          ].includes(e.code),
      );
      await assert.rejects(
        () => probe('/credentials', { servername: 'foreign.example' }),
        (e) => e.code === 'ERR_TLS_CERT_ALTNAME_INVALID',
      );
    },
  );
  await check(
    'real recipient/staff CSRF with separate secure host-only contexts',
    async () => {
      for (const [path, cookie] of [
        ['/credential-actions/csrf', '__Host-myims-exchange-csrf'],
        ['/staff/auth/browser/csrf', '__Host-myims-staff-csrf'],
      ]) {
        const r = await probe(path, {
          headers: { 'sec-fetch-site': 'same-origin' },
        });
        assert.equal(r.status, 200);
        assert.equal(r.headers['cache-control'], 'no-store');
        assert.match(JSON.parse(r.body).proof, /^[A-Za-z0-9_-]{43}$/);
        assert.equal(r.headers['set-cookie'].length, 1);
        const c = r.headers['set-cookie'][0];
        assert.ok(c.startsWith(`${cookie}=`));
        for (const a of [
          /; Secure/i,
          /; HttpOnly/i,
          /; SameSite=Lax/i,
          /; Path=\/(?:;|$)/i,
        ])
          assert.match(c, a);
        assert.doesNotMatch(c, /; Domain=/i);
      }
    },
  );
  await check(
    'protected shell, origin/host/CSRF and channel denials',
    async () => {
      assert.equal((await probe('/staff/auth/browser/session')).status, 401);
      assert.ok([302, 303, 307, 308].includes((await probe('/')).status));
      for (const headers of [
        { host: 'foreign.example' },
        { 'sec-fetch-site': 'cross-site' },
        { authorization: 'Bearer rejected-placeholder' },
      ])
        assert.equal(
          (await probe('/credential-actions/csrf', { headers })).status,
          403,
        );
      assert.equal(
        (await probe('/credential-actions/csrf?unexpected=1')).status,
        403,
      );
      assert.equal(
        (
          await probe('/credential-actions/exchange', {
            method: 'POST',
            headers: { origin: 'https://foreign.example' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await probe('/credential-actions/exchange', {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json' },
            body: '{}',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await probe('/credential-actions/csrf', {
            headers: { cookie: '__Host-myims-staff=invalid' },
          })
        ).status,
        401,
      );
      assert.equal(
        (await probe('/staff/auth/mobile/session', { headers: { origin } }))
          .status,
        403,
      );
      assert.equal(
        (
          await probe('/staff/auth/work-fixture', {
            method: 'POST',
            headers: { origin: staffOrigin },
          })
        ).status,
        403,
      );
    },
  );
  await check('direct private Next/backend fail closed', async () => {
    for (const url of [
      'http://127.0.0.1:3004/credential-actions/csrf',
      'http://127.0.0.1:4002/credential-actions/csrf',
    ]) {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      await r.body?.cancel();
      assert.equal(r.status, 403);
    }
  });
  await check(
    'ordinary client assets exclude transport secrets and incident fixture',
    async () => {
      let count = 0;
      for (const name of readdirSync('apps/command-center-web/.next/static', {
        recursive: true,
      })) {
        if (!/\.(js|html|json|map)$/.test(name)) continue;
        const text = readFileSync(
          `apps/command-center-web/.next/static/${name}`,
          'utf8',
        );
        count++;
        for (const secret of [...secrets, ...Object.values(material.secrets)])
          assert.ok(!text.includes(secret));
        assert.ok(!text.includes('Unfinished incident fixture'));
      }
      assert.ok(count > 0);
    },
  );
  await check(
    'actual Chromium recipient form, secure context and readiness',
    async () => {
      // Test-only leaf SPKI pin; Node above proves the actual CA chain and hostname.
      // Desktop acceptance uses the already installed development CA without a bypass.
      const pin = createHash('sha256')
        .update(
          new X509Certificate(leafCertificate).publicKey.export({
            type: 'spki',
            format: 'der',
          }),
        )
        .digest('base64');
      const sockets = new Set();
      const tunnel = createServer((socket) => {
        const upstream = createConnection({ host: '::1', port: 3002 });
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
      // The separately declared native ingress may already own port 3444.
      // Resolve the public names to a private ephemeral tunnel while retaining
      // the original URL, Host, Origin and cookie scopes in Chromium.
      tunnel.listen(0, '127.0.0.1');
      await once(tunnel, 'listening');
      try {
        const address = tunnel.address();
        assert.ok(address && typeof address !== 'string');
        browser = await chromium.launch({
          headless: true,
          args: [
            `--host-resolver-rules=MAP localhost:3444 127.0.0.1:${address.port}, MAP 127.0.0.1:3444 127.0.0.1:${address.port}`,
            `--ignore-certificate-errors-spki-list=${pin}`,
          ],
        });
        const context = await browser.newContext();
        const page = await context.newPage();
        assert.equal((await page.goto(`${origin}/credentials`)).status(), 200);
        assert.equal(
          await page.evaluate(() => globalThis.isSecureContext),
          true,
        );
        for (const label of [
          'Handoff code',
          'New password',
          'Confirm password',
        ])
          assert.equal(
            await page.getByLabel(label, { exact: true }).count(),
            1,
          );
        await page.waitForFunction(
          () => !document.querySelector('button[type="submit"]')?.disabled,
        );
        // Existing localhost platform cookies must not reach the dedicated IP host.
        phase = 'recipient hostname cookie isolation';
        await context.addCookies([
          {
            name: '__Host-myims-platform',
            value: 'A'.repeat(43),
            domain: 'localhost',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const cleanBootstrap = await page.evaluate(
          async () =>
            (await fetch('/credential-actions/csrf', { cache: 'no-store' }))
              .status,
        );
        assert.equal(cleanBootstrap, 200);
        assert.equal(
          (await probe('/credentials', { headers: { host: 'localhost:3444' } }))
            .headers.location,
          `${origin}/credentials`,
        );
        assert.equal(
          (
            await probe('/staff/auth/browser/csrf', {
              headers: { host: '127.0.0.1:3444' },
            })
          ).status,
          403,
        );
        // Deliberately forged workspace cookie on the recipient host still denies.
        phase = 'recipient workspace-cookie denial and safe recovery message';
        await context.addCookies([
          {
            name: '__Host-myims-platform',
            value: 'A'.repeat(43),
            domain: '127.0.0.1',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        let exchanges = 0;
        page.on('request', (request) => {
          if (
            new URL(request.url()).pathname === '/credential-actions/exchange'
          )
            exchanges++;
        });
        await page
          .getByLabel('Handoff code', { exact: true })
          .fill('A'.repeat(43));
        await page
          .getByLabel('New password', { exact: true })
          .fill('Synthetic browser-only password');
        await page
          .getByLabel('Confirm password', { exact: true })
          .fill('Synthetic browser-only password');
        const denied = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/credential-actions/csrf',
        );
        await page
          .getByRole('button', { name: 'Set credentials', exact: true })
          .click();
        assert.equal((await denied).status(), 401);
        await expect(page.getByRole('status')).toContainText(
          'Your code has not been submitted.',
        );
        await expect(page.getByRole('status')).toContainText(
          'separate browser',
        );
        assert.equal(exchanges, 0);
        for (const label of [
          'Handoff code',
          'New password',
          'Confirm password',
        ])
          await expect(page.getByLabel(label, { exact: true })).toHaveValue('');
        await context.close();
      } finally {
        for (const s of sockets) s.destroy();
        await new Promise((r) => tunnel.close(r));
        await browser?.close();
        browser = undefined;
      }
    },
  );
  await check(
    'existing identities, credential actions and migrations unchanged',
    async () => assert.deepEqual(await snapshot(), before),
  );
  console.log(
    'PASS recipient development HTTPS ready. Desktop tunnel/trust and native OS evidence remain separate.',
  );
} catch {
  console.error(
    `FAIL staff development HTTPS during ${phase}; no credentials or code artifacts logged.`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  await db.end().catch(() => {});
}
