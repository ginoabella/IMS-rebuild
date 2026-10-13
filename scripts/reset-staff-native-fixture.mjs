// Fixed-fixture credential reset through the actual protected issuer/recipient UI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { createServer } from 'node:http';
import { request } from 'node:https';
import { createConnection } from 'node:net';
import { networkInterfaces } from 'node:os';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
let browser,
  proxy,
  pool,
  beforeToken,
  native,
  previousReplica,
  phase = 'development guard';
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
function control(command) {
  const result = spawnSync(
    process.execPath,
    ['scripts/staff-native-runtime.mjs', command],
    { encoding: 'utf8', timeout: 45000 },
  );
  assert.equal(result.status, 0);
  const value = JSON.parse(result.stdout);
  assert.equal(value.ok, true);
  return value;
}
try {
  assert.ok(
    ['--other', '--responder'].includes(process.argv[2]) &&
      process.argv.length === 3,
  );
  assert.notEqual(process.env.NODE_ENV, 'production');
  const config = backend(
    './dist/infrastructure/configuration.js',
  ).loadBackendConfig();
  assert.equal(new URL(config.database.url).hostname, 'postgres');
  assert.equal(new URL(config.database.url).pathname, '/myims');
  const state = privateJson('.local/staff-native-fixture/state.json');
  const handoffPath = '.local/staff-native-fixture/handoff.json';
  const handoff = privateJson(handoffPath);
  assert.equal(state.kind, 'P2-U4C-development-acceptance');
  assert.equal(state.state, 'ready');
  assert.match(state.tenantCode, /^native-p2u4c-[a-f0-9]{8}$/);
  const username =
    process.argv[2] === '--other' ? 'native.other' : 'native.responder';
  const target = state.accounts.find((a) => a.username === username);
  const admin = handoff.accounts.find((a) => a.username === 'native.admin');
  assert.ok(target && admin);
  const { Pool } = backend('pg');
  pool = new Pool({ connectionString: config.database.url, max: 1 });
  const rows = await pool.query(
    'SELECT t.normalized_code,t.display_name,t.status,s.authentication_version FROM public.tenants t JOIN public.staff_users s ON s.tenant_id=t.id WHERE t.id=$1 AND s.id=$2',
    [state.tenantId, target.id],
  );
  assert.equal(rows.rows[0]?.normalized_code, state.tenantCode);
  assert.equal(rows.rows[0]?.display_name, 'P2-U4C NATIVE ACCEPTANCE ONLY');
  assert.equal(rows.rows[0]?.status, 'active');
  const oldVersion = rows.rows[0].authentication_version;
  const draft = () =>
    pool.query(
      "SELECT t.id,t.status,t.version,t.authority_version,s.id AS staff_id,s.version AS staff_version,s.authentication_version FROM public.tenants t LEFT JOIN public.staff_users s ON s.tenant_id=t.id WHERE t.normalized_code='t001' ORDER BY s.id",
    );
  const beforeDraft = (await draft()).rows;
  const password = `Native-test!${randomBytes(24).toString('base64url')}`;
  const resetPath = `.local/staff-native-fixture/reset-${username}.json`;
  const reset = {
    username,
    staffId: target.id,
    password,
    state: 'prepared',
    createdAt: new Date().toISOString(),
  };
  // Reserve before any write; never replay a reset if its outcome is uncertain.
  writeFileSync(resetPath, JSON.stringify(reset) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  const c = privateJson('private/staff-access-config.json');
  assert.equal(c.origin, 'https://localhost:3444');
  const host = Object.values(networkInterfaces())
    .flat()
    .find((e) => e && !e.internal && e.family === 'IPv4')?.address;
  assert.ok(host);
  const ca = readFileSync('private/mkcert-rootCA.pem');
  native = (path, token, body) =>
    new Promise((accept, reject) => {
      const req = request(
        {
          hostname: host,
          port: 3445,
          servername: 'localhost',
          ca,
          timeout: 10000,
          method: path === 'session' ? 'GET' : 'POST',
          path: `/staff/auth/mobile/${path}`,
          headers: {
            host: 'localhost:3444',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
        },
        (res) => {
          const authorized = res.socket.authorized;
          let text = '';
          res.on('data', (chunk) => {
            text += chunk;
            if (text.length > 8192) res.destroy();
          });
          res.on('end', () => {
            try {
              assert.equal(authorized, true);
              accept({ status: res.statusCode, value: JSON.parse(text) });
            } catch {
              reject(new Error('Native reset check invalid'));
            }
          });
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy());
      req.end(body ? JSON.stringify(body) : undefined);
    });
  phase = 'pre-reset retained session';
  previousReplica = control('status').selected;
  control('a');
  const before = await native('sign-in', undefined, {
    tenantCode: state.tenantCode,
    username,
    password: handoff.accounts.find((a) => a.staffId === target.id).password,
  });
  assert.equal(before.status, 201);
  beforeToken = before.value.token;
  assert.equal((await native('session', beforeToken)).status, 200);
  const certificate = new X509Certificate(readFileSync(c.certFile));
  assert.equal(certificate.checkHost('localhost'), 'localhost');
  assert.equal(certificate.checkIP('127.0.0.1'), '127.0.0.1');
  const pin = createHash('sha256')
    .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
    .digest('base64');
  const sockets = new Set();
  proxy = createServer();
  proxy.on('connect', (req, socket, head) => {
    if (!['localhost:3444', '127.0.0.1:3444'].includes(req.url)) {
      socket.destroy();
      return;
    }
    const upstream = createConnection({ host, port: 3445 });
    sockets.add(socket);
    sockets.add(upstream);
    socket.on('error', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => {
      sockets.delete(socket);
      upstream.destroy();
    });
    upstream.on('close', () => {
      sockets.delete(upstream);
      socket.destroy();
    });
    upstream.on('connect', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
  });
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  browser = await chromium.launch({
    headless: true,
    args: [
      `--proxy-server=http://127.0.0.1:${proxy.address().port}`,
      '--proxy-bypass-list=<-loopback>',
      `--ignore-certificate-errors-spki-list=${pin}`,
    ],
  });
  // Only this declared leaf is pinned in test Chromium; Node proves its CA/hostname.
  // No blanket ignoreHTTPSErrors, device trust changes, screenshots or body logs.
  phase = 'actual administrator issuer';
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto('https://localhost:3444/credential-issuer');
  await page.getByLabel(/^Tenant code/).fill(state.tenantCode);
  await page.getByLabel(/^Username/).fill(admin.username);
  await page.getByLabel(/^Password/).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Target staff ID', { exact: true })).toBeVisible(
    { timeout: 15000 },
  );
  await page.getByLabel('Target staff ID', { exact: true }).fill(target.id);
  await page
    .getByLabel('Credential action', { exact: true })
    .selectOption('reset');
  await page.getByRole('checkbox').check();
  await page
    .getByRole('button', { name: 'Issue staff code', exact: true })
    .click();
  const code = page.getByLabel('One-time handoff code');
  await expect(code).toBeVisible();
  const capability = await code.textContent();
  assert.ok(capability);
  phase = 'actual recipient password exchange';
  const recipient = await browser.newContext(),
    exchange = await recipient.newPage();
  await exchange.goto('https://127.0.0.1:3444/credentials');
  await exchange.getByLabel('Handoff code', { exact: true }).fill(capability);
  await exchange.getByLabel('New password', { exact: true }).fill(password);
  await exchange.getByLabel('Confirm password', { exact: true }).fill(password);
  await exchange
    .getByRole('button', { name: 'Set credentials', exact: true })
    .click();
  await expect(exchange.getByRole('status')).toContainText('Credentials set.', {
    timeout: 15000,
  });
  phase = 'A/B stale token denial and fresh sign-in';
  for (const replica of ['a', 'b']) {
    control(replica);
    assert.equal((await native('session', beforeToken)).status, 401);
  }
  const fresh = await native('sign-in', undefined, {
    tenantCode: state.tenantCode,
    username,
    password,
  });
  assert.equal(fresh.status, 201);
  assert.equal(fresh.value.staffId, target.id);
  assert.equal((await native('logout', fresh.value.token)).status, 201);
  assert.equal(
    (
      await pool.query(
        'SELECT authentication_version FROM public.staff_users WHERE id=$1',
        [target.id],
      )
    ).rows[0].authentication_version,
    oldVersion + 1,
  );
  assert.deepEqual((await draft()).rows, beforeDraft);
  handoff.accounts.find((a) => a.staffId === target.id).password = password;
  const temporary = `${handoffPath}.reset.tmp`;
  writeFileSync(temporary, JSON.stringify(handoff, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  renameSync(temporary, handoffPath);
  reset.state = 'completed';
  writeFileSync(resetPath, JSON.stringify(reset) + '\n', { mode: 0o600 });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  console.log(
    `PASS ${username}: actual issuer/recipient UI reset, old token denied on A/B, fresh credentials verified, t001 unchanged. Private handoff updated; no secrets printed.`,
  );
} catch {
  console.error(
    `FAIL native fixture reset during ${phase}; reserved private password retained, no automatic reset replay and no secrets logged.`,
  );
  process.exitCode = 1;
} finally {
  if (beforeToken && native)
    await native('logout', beforeToken).catch(() => {});
  if (previousReplica) {
    try {
      control(previousReplica.toLowerCase());
    } catch {
      /* Preserve safe failure outcome. */
    }
  }
  await browser?.close();
  proxy?.closeAllConnections();
  proxy?.close();
  await pool?.end();
}
