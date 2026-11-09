/* global document, innerWidth */
// Independent ordinary HTTPS read proof. No fixture server or credential login.
// A temporary canonical operator session is issued locally and revoked on exit.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { once } from 'node:events';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { manifest } from './tenant-call-preparation-store.mjs';
import { readMaterial, browserOrigin } from './platform-https-material.mjs';
const p = manifest(JSON.parse(readFileSync(process.argv[2], 'utf8')));
assert.equal(process.argv.length, 3);
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const config = load(
  './dist/infrastructure/configuration.js',
).loadBackendConfig();
const { SnapshotDatabase } = load(
  './dist/infrastructure/database/read-snapshot.js',
);
const { PlatformAuthorityRepository } = load(
  './dist/modules/platform/adapters/db/authority-read.js',
);
const { PostgresSessionFences } = load(
  './dist/modules/identity/adapters/db/session-fences.js',
);
const { RedisSessionRecords } = load(
  './dist/modules/identity/adapters/redis/session-records.js',
);
const { SharedSessionLifecycle } = load(
  './dist/modules/identity/application/session-lifecycle.js',
);
const db = new SnapshotDatabase(config.database.url);
const authority = new PlatformAuthorityRepository(db);
const fences = new PostgresSessionFences(config.database.url, config.sessions);
const records = new RedisSessionRecords(
  config.sessionRedis.url,
  config.sessions,
);
const lifecycle = new SharedSessionLifecycle(
  records,
  fences,
  {
    async current(a) {
      assert.equal(a.plane, 'platform');
      const r = await authority.byId({
        plane: 'platform',
        operatorId: a.identityId,
      });
      return r.kind === 'eligible'
        ? {
            kind: 'eligible',
            authority: {
              plane: 'platform',
              identityId: r.snapshot.operatorId,
              authenticationVersion: r.snapshot.authenticationVersion,
            },
          }
        : r;
    },
  },
  config.sessions,
);
let session, browser, tunnel;
const sockets = new Set();
const output = '.local/verification/p4-u2-dev-b/ordinary-console';
mkdirSync(output, { recursive: true, mode: 0o700 });
try {
  await records.connect();
  session = await lifecycle.issue(
    {
      plane: 'platform',
      identityId: p.operatorId,
      authenticationVersion: p.authenticationVersion,
    },
    'web',
  );
  assert.equal(session.kind, 'issued');
  const material = readMaterial();
  const pin = createHash('sha256')
    .update(
      new X509Certificate(material.cert).publicKey.export({
        type: 'spki',
        format: 'der',
      }),
    )
    .digest('base64');
  tunnel = createServer((socket) => {
    const upstream = createConnection({ host: '::1', port: 3001 });
    for (const s of [socket, upstream]) sockets.add(s);
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
  tunnel.listen(3443, '::1');
  await once(tunnel, 'listening');
  browser = await chromium.launch({
    headless: true,
    args: [
      '--host-resolver-rules=MAP localhost [::1]',
      `--ignore-certificate-errors-spki-list=${pin}`,
    ],
  });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: '__Host-myims-platform',
      value: session.token,
      url: browserOrigin,
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  const summary = [];
  for (const tenant of p.tenants) {
    const result = await db.read(async (snapshot) =>
      snapshot.query('SELECT id FROM public.tenants WHERE normalized_code=$1', [
        tenant.tenantCode,
      ]),
    );
    const tenantId = result.rows[0]?.id;
    assert.ok(tenantId);
    await page.goto(`${browserOrigin}/tenants/${tenantId}`);
    await page
      .getByRole('button', {
        name: 'Expand Tenant route bindings',
        exact: true,
      })
      .click();
    await page.getByLabel(/^Routing PBX node/).selectOption(p.nodeId);
    const control = page.getByLabel(/^Controlled call case/);
    await expect(control).toBeVisible();
    const response = await page.evaluate(async (path) => {
      const r = await fetch(path, { cache: 'no-store' });
      return {
        status: r.status,
        cacheControl: r.headers.get('cache-control'),
        view: await r.json(),
      };
    }, `/platform/tenants/${tenantId}/telephony/${p.nodeId}`);
    assert.equal(response.status, 200);
    assert.match(response.cacheControl, /no-store/);
    const view = response.view;
    assert.equal(view.cases.length, tenant.tenantCode === 'p4-dev-a' ? 8 : 3);
    assert.ok(view.cases.every((c) => c.available === true));
    assert.equal(view.grants.length, 0);
    assert.equal(view.tests.length, 0);
    assert.notEqual(view.readiness.state, 'ready');
    await expect(
      page.getByRole('button', {
        name: 'Run controlled call test',
        exact: true,
      }),
    ).toBeDisabled();
    await control.focus();
    await page.keyboard.press('ArrowDown');
    await expect(control).toBeFocused();
    const selectedCase = await control.inputValue();
    assert.ok(view.cases.some((c) => c.id === selectedCase));
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      if (width !== 768)
        await page
          .getByRole('region', { name: 'Verified tenant routing', exact: true })
          .screenshot({ path: `${output}/${tenant.tenantCode}-${width}.png` });
    }
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    const after = await page.evaluate(async (path) => {
      const r = await fetch(path, { cache: 'no-store' });
      return { status: r.status, view: await r.json() };
    }, `/platform/tenants/${tenantId}/telephony/${p.nodeId}`);
    assert.equal(after.status, 200);
    assert.deepEqual(after.view.grants, view.grants);
    assert.deepEqual(after.view.tests, view.tests);
    assert.deepEqual(
      after.view.cases.map((c) => c.id),
      view.cases.map((c) => c.id),
    );
    assert.ok(after.view.cases.every((c) => c.available === true));
    summary.push({
      tenantId,
      caseIds: view.cases.map((c) => c.id),
      readiness: view.readiness,
    });
  }
  console.log(
    JSON.stringify({
      state: 'ordinary_console_read_passed',
      nodeId: p.nodeId,
      installationId: p.installationId,
      temporaryCanonicalSession: true,
      manualPasswordSignInClaimed: false,
      tenants: summary,
      screenshots: output,
    }),
  );
} catch {
  console.error(
    'Ordinary controlled preparation console read failed; no session or credential data logged.',
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const socket of sockets) socket.destroy();
  tunnel?.close();
  if (session?.kind === 'issued') {
    const result = await lifecycle.revoke(session.token, {
      lifecycleId: session.record.lifecycleId,
      generation: session.record.generation,
    });
    if (result.kind !== 'revoked') {
      console.error('Temporary canonical session revocation unavailable');
      process.exitCode = 1;
    }
  }
  records.close();
  await fences.close();
  await db.close();
}
