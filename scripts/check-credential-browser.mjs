import { createStaffIngress } from './staff-access-ingress.mjs';
import { checkStaffBrowser } from './check-staff-browser.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as httpServer, request } from 'node:http';
import {
  createServer as httpsServer,
  request as httpsRequest,
} from 'node:https';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 15000 });
export async function checkCredentialBrowser({
  owner,
  worker,
  redis,
  key,
  secrets,
  settings,
  limiter,
  password,
  hashPassword,
}) {
  const directory = mkdtempSync(join(tmpdir(), 'myims-credential-browser-'));
  const processes = [],
    servers = [],
    sockets = new Set(),
    calls = [],
    sessions = [],
    urls = [],
    output = [];
  let fixtureBackend;
  const authStatuses = [],
    detailStatuses = [];
  let lastSessionExpiry = null,
    droppedStatus = null;
  let browser,
    selected,
    dropPath = null,
    gate = null,
    nextOperator,
    nextRecipient;
  const ingressSecret = randomBytes(32).toString('hex');
  secrets.push(ingressSecret);
  const cfg = () => ({
    origin: '',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  });
  const platform = cfg(),
    exchange = cfg(),
    staff = cfg();
  for (const c of [platform, exchange, staff])
    secrets.push(c.proxySecret, c.csrfSecret);
  const staffIngressConfig = {
    origin: '',
    nextUrl: '',
    backendUrl: '',
    proxySecret: staff.proxySecret,
    ingressSecret,
  };
  function track(server) {
    servers.push(server);
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    });
    return server;
  }
  async function listen(server, host = '127.0.0.1') {
    server.listen(0, host);
    await once(server, 'listening');
    return server.address().port;
  }
  async function ensureBuild(app, prefix) {
    const fingerprint = createHash('sha256');
    for (const dir of [
      `apps/${app}/app`,
      'packages/ui-web/src',
      'packages/contracts/src',
    ])
      for (const file of readdirSync(dir, { recursive: true }).sort()) {
        const path = `${dir}/${file}`;
        if (statSync(path).isFile())
          fingerprint.update(path).update(readFileSync(path));
      }
    for (const file of [
      `apps/${app}/next.config.ts`,
      `apps/${app}/tsconfig.json`,
      'pnpm-lock.yaml',
      'tsconfig.base.json',
    ])
      fingerprint.update(readFileSync(file));
    const revision = fingerprint.digest('hex'),
      marker = `apps/${app}/.local/credential-source.sha256`;
    const dist =
      app === 'platform-console-web' ? 'platform-auth-next' : 'credential-next';
    if (
      existsSync(marker) &&
      readFileSync(marker, 'utf8') === revision &&
      existsSync(`apps/${app}/.local/${dist}/BUILD_ID`)
    )
      return;
    mkdirSync(`apps/${app}/.local`, { recursive: true });
    if (app === 'command-center-web')
      writeFileSync(
        `apps/${app}/.local/staff-access-tsconfig.json`,
        JSON.stringify({
          extends: '../tsconfig.json',
          compilerOptions: {
            incremental: false,
            paths: {
              '@staff/work-fixture': ['../app/auth/work-fixture.tsx'],
              '@staff/work-submit': ['../app/auth/work-submit.ts'],
            },
          },
          include: [
            '../app/**/*.ts',
            '../app/**/*.tsx',
            '../next-env.d.ts',
            '../next.config.ts',
            './credential-next/types/**/*.ts',
          ],
          exclude: ['../node_modules'],
        }),
      );
    if (app === 'platform-console-web')
      writeFileSync(
        `apps/${app}/.local/platform-auth-tsconfig.json`,
        JSON.stringify({
          extends: '../tsconfig.json',
          compilerOptions: {
            incremental: false,
            paths: {
              '@platform/work-fixture': ['../app/auth/work-fixture.tsx'],
            },
          },
          include: [
            '../app/**/*.ts',
            '../app/**/*.tsx',
            '../next-env.d.ts',
            '../next.config.ts',
            './platform-auth-next/types/**/*.ts',
          ],
          exclude: ['../node_modules'],
        }),
      );
    const build = spawn('pnpm', ['--filter', `@myims/${app}`, 'build'], {
      env: { ...process.env, [prefix]: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let diagnostics = '';
    build.stdout.on('data', (b) => {
      diagnostics += b;
    });
    build.stderr.on('data', (b) => {
      diagnostics += b;
    });
    const deadline = setTimeout(
      () => process.kill(-build.pid, 'SIGKILL'),
      480000,
    );
    const [code] = await once(build, 'exit');
    clearTimeout(deadline);
    if (code !== 0) {
      const safe = diagnostics
        .split('\n')
        .filter((line) =>
          /error TS|Type error:|Cannot find module|Module not found|Failed to compile|Error:/.test(
            line,
          ),
        )
        .slice(-8)
        .join('\n');
      throw new Error(`Credential browser ${app} build failed: ${safe}`);
    }
    writeFileSync(marker, revision);
    console.log(`CHECK credential browser: ${app} production build passed`);
  }
  async function next(app, prefix, env) {
    const reservation = httpServer(),
      port = await listen(reservation);
    await new Promise((r) => reservation.close(r));
    const child = spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      {
        cwd: `apps/${app}`,
        env: { ...process.env, [prefix]: '1', ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      },
    );
    processes.push(child);
    child.stdout.on('data', (d) => output.push(d.toString()));
    child.stderr.on('data', (d) => output.push(d.toString()));
    for (let i = 0; i < 100; i++) {
      try {
        if (
          (
            await fetch(
              `http://127.0.0.1:${port}${app === 'platform-console-web' ? '/sign-in' : '/credentials'}`,
            )
          ).ok
        )
          return `http://127.0.0.1:${port}`;
      } catch {
        /* Startup is bounded below. */
      }
      await delay(100);
    }
    throw new Error('Credential Next startup deadline');
  }
  let page;
  let phase = 'startup';
  try {
    const cert = spawnSync(
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
      { stdio: 'ignore', timeout: 30000 },
    );
    assert.equal(cert.status, 0);
    const tls = {
      key: readFileSync(join(directory, 'key.pem')),
      cert: readFileSync(join(directory, 'cert.pem')),
    };
    function ingress(target, config) {
      return track(
        httpsServer(tls, (req, res) => {
          if (
            req.headers.host !== new URL(config.origin).host ||
            req.headers.authorization !== undefined ||
            (req.method === 'POST' && req.headers.origin !== config.origin) ||
            (req.method === 'GET' &&
              !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
          ) {
            res.writeHead(403, { 'Cache-Control': 'no-store' }).end();
            return;
          }
          const headers = { ...req.headers };
          for (const name of Object.keys(headers))
            if (
              name.startsWith('x-myims-') ||
              name.startsWith('x-forwarded-') ||
              name.endsWith('-proxy') ||
              name === 'authorization' ||
              name === 'forwarded'
            )
              delete headers[name];
          headers['x-myims-ingress'] = ingressSecret;
          headers['x-myims-client-ip'] = req.socket.remoteAddress;
          headers['x-myims-path'] = req.url.split('?')[0];
          const upstream = request(
            `${target()}${req.url}`,
            { method: req.method, headers },
            (incoming) => {
              res.writeHead(incoming.statusCode, incoming.headers);
              incoming.pipe(res);
            },
          );
          upstream.on('error', () => {
            if (!res.headersSent) res.writeHead(503);
            res.end();
          });
          req.pipe(upstream);
        }),
      );
    }
    const operatorIngress = ingress(() => nextOperator, platform),
      recipientIngress = track(
        createStaffIngress({ tls, config: staffIngressConfig }),
      );
    platform.origin = `https://localhost:${await listen(operatorIngress, '::1')}`;
    exchange.origin = `https://localhost:${await listen(recipientIngress, '::1')}`;
    staff.origin = exchange.origin;
    staffIngressConfig.origin = staff.origin;
    const balancer = track(
      httpServer((req, res) => {
        const delayed =
          gate?.path === req.url && req.method === 'POST' ? gate : null;
        if (delayed) gate = null;
        const headers = {};
        for (const name of [
          'origin',
          'cookie',
          'content-type',
          'x-platform-proxy',
          'x-platform-csrf',
          'x-credential-proxy',
          'x-credential-csrf',
          'x-staff-proxy',
          'x-staff-csrf',
          'x-staff-mobile-proxy',
          'authorization',
          'x-forwarded-for',
        ])
          if (typeof req.headers[name] === 'string')
            headers[name] = req.headers[name];
        const upstream = request(
          `${req.url === '/fixture/staff-write' ? fixtureBackend.url : selected.url}${req.url}`,
          { method: req.method, headers },
          (incoming) => {
            if (dropPath === req.url && req.method === 'POST') {
              dropPath = null;
              droppedStatus = incoming.statusCode;
              incoming.resume();
              res.destroy();
              return;
            }
            if (delayed) {
              incoming.pause();
              delayed.arrived();
              void delayed.released.then(() => {
                res.writeHead(incoming.statusCode, incoming.headers);
                incoming.pipe(res);
              });
              return;
            }
            res.writeHead(incoming.statusCode, incoming.headers);
            incoming.pipe(res);
          },
        );
        upstream.on('error', () => {
          if (!res.headersSent) res.writeHead(503);
          res.end();
        });
        req.pipe(upstream);
      }),
    );
    const backendUrl = `http://127.0.0.1:${await listen(balancer)}`;
    staffIngressConfig.backendUrl = backendUrl;
    for (let i = 0; i < 2; i++)
      calls.push(
        await worker({
          http: true,
          productionHttp: true,
          browserConfig: platform,
          exchangeConfig: exchange,
          staffIssuerConfig: staff,
          limiterConfig: limiter,
          config: settings,
        }),
      );
    fixtureBackend = await worker({
      http: true,
      staffIssuerConfig: staff,
      limiterConfig: limiter,
      config: settings,
    });
    calls.push(fixtureBackend);
    selected = calls[0];
    await ensureBuild('platform-console-web', 'PLATFORM_AUTH_BROWSER_BUILD');
    await ensureBuild('command-center-web', 'CREDENTIAL_BROWSER_BUILD');
    nextOperator = await next(
      'platform-console-web',
      'PLATFORM_AUTH_BROWSER_BUILD',
      {
        PLATFORM_AUTH_ORIGIN: platform.origin,
        PLATFORM_AUTH_BACKEND_URL: backendUrl,
        PLATFORM_AUTH_PROXY_SECRET: platform.proxySecret,
        PLATFORM_AUTH_INGRESS_SECRET: ingressSecret,
      },
    );
    nextRecipient = await next(
      'command-center-web',
      'CREDENTIAL_BROWSER_BUILD',
      {
        CREDENTIAL_EXCHANGE_ORIGIN: exchange.origin,
        CREDENTIAL_EXCHANGE_BACKEND_URL: backendUrl,
        CREDENTIAL_EXCHANGE_PROXY_SECRET: exchange.proxySecret,
        CREDENTIAL_EXCHANGE_INGRESS_SECRET: ingressSecret,
        STAFF_ISSUER_ORIGIN: staff.origin,
        STAFF_ISSUER_BACKEND_URL: backendUrl,
        STAFF_ISSUER_PROXY_SECRET: staff.proxySecret,
        STAFF_ISSUER_INGRESS_SECRET: ingressSecret,
      },
    );
    staffIngressConfig.nextUrl = nextRecipient;
    const operatorId = randomUUID(),
      username = `credential.browser.${operatorId.slice(0, 8)}`,
      hash = await hashPassword(Buffer.from(password));
    secrets.push(username, hash);
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready',$3,clock_timestamp())",
      [operatorId, username, hash],
    );
    browser = await chromium.launch({ headless: true });
    const operator = await browser.newContext({ ignoreHTTPSErrors: true }),
      recipient = await browser.newContext({ ignoreHTTPSErrors: true });
    page = await operator.newPage();
    page.on('response', async (response) => {
      const path = new URL(response.url()).pathname;
      if (/^\/platform\/tenants\/[a-f0-9-]{36}$/.test(path)) {
        detailStatuses.push(response.status());
        if (detailStatuses.length > 8) detailStatuses.shift();
      }
      if (!['/platform/auth/session', '/platform/auth/sign-in'].includes(path))
        return;
      authStatuses.push(response.status());
      if (authStatuses.length > 12) authStatuses.shift();
      if (response.status() === 200 || response.status() === 201) {
        try {
          const d = await response.json();
          if (
            Number.isFinite(d.idleExpiresAt) &&
            Number.isFinite(d.absoluteExpiresAt)
          )
            lastSessionExpiry = {
              idle: d.idleExpiresAt,
              absolute: d.absoluteExpiresAt,
            };
        } catch {
          /* No raw response or credential diagnostics. */
        }
      }
    });
    const form = await recipient.newPage();
    for (const p of [page, form]) p.on('request', (r) => urls.push(r.url()));
    async function login() {
      await page.getByLabel(/^Username/).fill(username);
      await page.getByLabel(/^Password/).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).focus();
      await page.keyboard.press('Enter');
    }
    phase = 'operator sign-in';
    await page.goto(`${platform.origin}/sign-in`);
    await login();
    await expect(
      page.getByRole('button', { name: 'Sign out', exact: true }),
    ).toBeVisible();
    phase = 'draft creation';
    await page.goto(`${platform.origin}/tenants/create`);
    // Settle the mounted access checks before submitting or injecting an outage.
    await page.waitForLoadState('networkidle');
    await page
      .getByLabel(/^Tenant code/)
      .fill(`credential-browser-${randomUUID().slice(0, 8)}`);
    await page
      .getByLabel(/^Organization name/)
      .fill('Credential browser organization');
    await page.getByLabel(/^Administrator username/).fill('browser.admin');
    const creationResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/platform/tenants' &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Create draft tenant', exact: true })
      .click();
    const creation = await creationResponse;
    if (creation.status() !== 201)
      throw new Error(
        `Credential browser draft creation status ${creation.status()}`,
      );
    await expect(
      page.getByText('Credentials not set', { exact: true }),
    ).toBeVisible();
    const tenantId = new URL(page.url()).pathname.split('/').at(-1),
      backendPath = `/platform/tenants/${tenantId}/administrator/credential-actions`;
    await page
      .getByLabel('Verification method', { exact: true })
      .selectOption('known_contact_call');
    await page.getByRole('checkbox').check();
    await page
      .getByRole('button', { name: 'Issue setup code', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('One-time handoff code')).toBeVisible();
    const capability = await page
      .getByLabel('One-time handoff code')
      .textContent();
    secrets.push(capability);
    const status = await page.evaluate(async (path) => {
      const response = await fetch(path);
      return { status: response.status, data: await response.json() };
    }, backendPath);
    assert.equal(status.status, 200);
    assert.ok(!JSON.stringify(status.data).includes(capability));
    phase = 'recipient exchange';
    selected = calls[1];
    await form.goto(`${exchange.origin}/credentials`);
    await form.getByLabel('Handoff code', { exact: true }).fill(capability);
    await form.getByLabel('New password', { exact: true }).fill(password);
    await form
      .getByLabel('Confirm password', { exact: true })
      .fill(password + 'x');
    await form
      .getByRole('button', { name: 'Set credentials', exact: true })
      .click();
    await expect(form.getByRole('status')).toContainText(
      'Passwords must match',
    );
    await expect(form.getByLabel('New password', { exact: true })).toHaveValue(
      password,
    );
    await form.getByLabel('Confirm password', { exact: true }).fill(password);
    await form
      .getByRole('button', { name: 'Set credentials', exact: true })
      .focus();
    await form.keyboard.press('Enter');
    await expect(form.getByRole('status')).toContainText('Credentials set.');
    assert.equal(await form.locator('input').count(), 0);
    const rows = (
      await owner.query(
        'SELECT s.id,s.credential_state,s.authentication_version,t.status FROM public.staff_users s JOIN public.tenants t ON t.id=s.tenant_id WHERE t.id=$1',
        [tenantId],
      )
    ).rows;
    assert.equal(rows[0].credential_state, 'ready');
    assert.equal(rows[0].authentication_version, 2);
    assert.equal(rows[0].status, 'draft');
    assert.ok(
      !(await recipient.cookies()).some((c) => c.name === '__Host-myims-staff'),
    );
    await page.getByRole('button', { name: 'Hide code', exact: true }).click();
    await page
      .getByRole('button', { name: 'Check credential status', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Issue recovery code', exact: true }),
    ).toBeVisible();
    phase = 'recipient accessibility';
    const recipientViolations = (await new AxeBuilder({ page: form }).analyze())
      .violations;
    if (recipientViolations.length)
      throw new Error(
        `Safe accessibility: ${recipientViolations.map((v) => v.id.replace(/[^a-z-]/g, '')).join(',')}`,
      );
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    phase = 'recipient/operator reflow';
    for (const p of [page, form])
      for (const width of [1440, 768, 390, 320]) {
        await p.setViewportSize({ width, height: 900 });
        assert.equal(
          await p.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
          true,
        );
      }
    phase = 'recipient secret clearing';
    await form.reload();
    await expect(form.getByLabel('Handoff code', { exact: true })).toHaveValue(
      '',
    );
    await form.getByLabel('Handoff code', { exact: true }).fill(capability);
    await form.getByLabel('New password', { exact: true }).fill(password);
    await form.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pagehide', { persisted: true }),
      ),
    );
    await expect(form.getByLabel('Handoff code', { exact: true })).toHaveValue(
      '',
    );
    await expect(form.getByLabel('New password', { exact: true })).toHaveValue(
      '',
    );
    phase = 'lost issuance response';
    await page.getByRole('checkbox').check();
    dropPath = backendPath;
    await page
      .getByRole('button', { name: 'Issue recovery code', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Retry access', exact: true }),
    ).toBeVisible();
    assert.equal(
      droppedStatus,
      201,
      'Lost issuance fixture requires committed 201',
    );
    assert.equal(await page.getByLabel('One-time handoff code').count(), 0);
    await delay(1100);
    await page
      .getByRole('button', { name: 'Retry access', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Check credential status',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/Outcome uncertain/)).toBeVisible();
    await page
      .getByRole('button', { name: 'Check credential status', exact: true })
      .click();
    await expect(
      page.getByText(/Canonical credential status loaded/),
    ).toBeVisible();
    await page.getByRole('checkbox').check();
    await page
      .getByRole('button', { name: 'Reissue code', exact: true })
      .click();
    await expect(page.getByLabel('One-time handoff code')).toBeVisible();
    const resetCode = await page
      .getByLabel('One-time handoff code')
      .textContent();
    secrets.push(resetCode);
    await form.getByLabel('Handoff code', { exact: true }).fill(resetCode);
    await form.getByLabel('New password', { exact: true }).fill(password);
    await form.getByLabel('Confirm password', { exact: true }).fill(password);
    dropPath = '/credential-actions/exchange';
    await form
      .getByRole('button', { name: 'Set credentials', exact: true })
      .click();
    await expect(form.getByRole('status')).toContainText('Outcome uncertain');
    for (const label of ['Handoff code', 'New password', 'Confirm password'])
      await expect(form.getByLabel(label, { exact: true })).toHaveValue('');
    assert.equal(
      (
        await owner.query(
          'SELECT authentication_version FROM public.staff_users WHERE id=$1',
          [rows[0].id],
        )
      ).rows[0].authentication_version,
      3,
    );
    phase = 'late disclosure fencing';
    // Late one-time disclosure is fenced after canonical-owner access loss.
    await page.getByRole('button', { name: 'Hide code', exact: true }).click();
    await page.getByRole('checkbox').check();
    let arrived, release;
    const reached = new Promise((r) => {
        arrived = r;
      }),
      released = new Promise((r) => {
        release = r;
      });
    gate = { path: backendPath, arrived, released, release };
    await page
      .getByRole('button', { name: 'Reissue code', exact: true })
      .click();
    await reached;
    const cookie = (await operator.cookies()).find(
      (c) => c.name === '__Host-myims-platform',
    );
    await redis.del(key(cookie.value));
    await page.evaluate(() =>
      globalThis.dispatchEvent(
        new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
      ),
    );
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    release();
    await login();
    await expect(
      page.getByRole('button', {
        name: 'Check credential status',
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(await page.getByLabel('One-time handoff code').count(), 0);
    await expect(
      page.getByLabel('Verification method', { exact: true }),
    ).toHaveValue('known_contact_call');
    phase = 'actual draft sign-in denial';
    const draftCode = (
      await owner.query(
        'SELECT normalized_code FROM public.tenants WHERE id=$1',
        [tenantId],
      )
    ).rows[0].normalized_code;
    await form.goto(`${staff.origin}/sign-in`);
    await form.getByLabel(/^Tenant code/).fill(draftCode);
    await form.getByLabel(/^Username/).fill('browser.admin');
    await form.getByLabel(/^Password/).fill(password);
    await form.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      form.getByRole('alert').filter({ hasText: 'Invalid credentials' }),
    ).toBeVisible();
    assert.ok(
      !(await recipient.cookies()).some((c) => c.name === '__Host-myims-staff'),
    );
    phase = 'staff browser integrated acceptance';
    const nativeRequest = (path, body, token, extra = {}) =>
      new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const r = httpsRequest(
          `${staff.origin}/staff/auth/mobile/${path}`,
          {
            ca: tls.cert,
            family: 6,
            method: path === 'session' ? 'GET' : 'POST',
            headers: {
              ...(payload ? { 'Content-Type': 'application/json' } : {}),
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...extra,
            },
          },
          (response) => {
            let text = '';
            response.on('data', (chunk) => {
              text += chunk;
            });
            response.on('end', () => {
              let data;
              try {
                data = JSON.parse(text);
              } catch {
                data = null;
              }
              resolve({
                status: response.statusCode,
                headers: response.headers,
                data,
              });
            });
          },
        );
        r.on('error', reject);
        r.setTimeout(10000, () =>
          r.destroy(new Error('Native TLS probe unavailable')),
        );
        r.end(payload);
      });
    await checkStaffBrowser({
      exchange,
      nativeRequest,
      progress: (stage) => {
        phase = `staff browser ${stage}`;
      },
      owner,
      redis,
      key,
      secrets,
      password,
      hash,
      form,
      recipient,
      staff,
      calls,
      select: (call) => {
        selected = call;
      },
      drop: (path) => {
        dropPath = path;
      },
      gate: (value) => {
        gate = value;
      },
    });
    const forged = await form.evaluate(async () => {
      const r = await fetch('/credential-actions/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capability: 'a'.repeat(43),
          password: 'not a secret password',
        }),
      });
      return r.status;
    });
    assert.equal(forged, 401);
    for (const secret of secrets) {
      assert.ok(
        !urls.some((url) => url.includes(secret)),
        'Secret in browser URL',
      );
      assert.ok(
        !output.join('').includes(secret),
        'Secret in Next diagnostics',
      );
    }
    for (const p of [page, form])
      assert.equal(
        await p.evaluate(
          () =>
            globalThis.localStorage.length + globalThis.sessionStorage.length,
        ),
        0,
      );
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
    console.log(
      'PASS credential A-02/07: actual HTTPS operator create/detail/issue and recipient keyboard exchange; no session/activation, uncertainty without replay, labels/axe/narrow reflow and secret exclusion',
    );
    console.log(
      'PASS credential A-07: late disclosure fencing and same/foreign-owner staff issuer isolation; real qualified staff login and protected command-center recovery',
    );
  } catch (error) {
    const safeSession = {
      authStatuses,
      detailStatuses,
      droppedStatus,
      idleRemainingMs: lastSessionExpiry
        ? lastSessionExpiry.idle - Date.now()
        : null,
      absoluteRemainingMs: lastSessionExpiry
        ? lastSessionExpiry.absolute - Date.now()
        : null,
      signInVisible: page
        ? await page
            .getByRole('button', { name: 'Sign in', exact: true })
            .isVisible()
            .catch(() => false)
        : false,
    };
    console.log(
      'CHECK credential browser failure metadata ' +
        JSON.stringify(safeSession),
    );
    const location =
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .find((l) => /check-(?:credential|staff)-browser\.mjs:\d+/.test(l))
            ?.trim()
        : '';
    // eslint-disable-next-line preserve-caught-error -- Browser errors may contain passwords or one-time capabilities.
    throw new Error(
      `Credential HTTPS browser acceptance failed during ${phase}${location ? ` (${location})` : ''}${error && typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? ` [${error.code}]` : ''}${error?.message?.startsWith('Credential browser') ? `: ${error.message}` : ''}`,
    );
  } finally {
    gate?.release?.();
    if (browser) await browser.close();
    for (const child of processes)
      if (child.exitCode === null) {
        process.kill(-child.pid, 'SIGTERM');
        await Promise.race([once(child, 'exit'), delay(5000)]);
        if (child.exitCode === null) process.kill(-child.pid, 'SIGKILL');
      }
    for (const socket of sockets) socket.destroy();
    for (const server of servers) await new Promise((r) => server.close(r));
    for (const call of calls) await call('close').catch(() => {});
    for (const s of sessions) await redis.del(key(s.token));
    rmSync(directory, { recursive: true, force: true });
  }
}
