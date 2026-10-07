import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as httpServer, request } from 'node:http';
import { createServer as httpsServer } from 'node:https';
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
  issue,
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
  function track(server) {
    servers.push(server);
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    });
    return server;
  }
  async function listen(server) {
    server.listen(0, '127.0.0.1');
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
          headers['x-myims-client-ip'] = '192.0.2.180';
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
      recipientIngress = ingress(() => nextRecipient, exchange);
    platform.origin = `https://localhost:${await listen(operatorIngress)}`;
    exchange.origin = `https://localhost:${await listen(recipientIngress)}`;
    staff.origin = exchange.origin;
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
          'x-forwarded-for',
        ])
          if (typeof req.headers[name] === 'string')
            headers[name] = req.headers[name];
        const upstream = request(
          `${selected.url}${req.url}`,
          { method: req.method, headers },
          (incoming) => {
            if (dropPath === req.url && req.method === 'POST') {
              dropPath = null;
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
    await page
      .getByLabel(/^Tenant code/)
      .fill(`credential-browser-${randomUUID().slice(0, 8)}`);
    await page
      .getByLabel(/^Organization name/)
      .fill('Credential browser organization');
    await page.getByLabel(/^Administrator username/).fill('browser.admin');
    await page
      .getByRole('button', { name: 'Create draft tenant', exact: true })
      .click();
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
    assert.deepEqual(
      (await new AxeBuilder({ page: form }).analyze()).violations,
      [],
    );
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
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
    phase = 'staff issuer browser';
    const activeId = randomUUID(),
      adminId = randomUUID(),
      targetId = randomUUID();
    await owner.query(
      "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Issuer browser fixture','active')",
      [activeId, `issuer-browser-${randomUUID().slice(0, 8)}`],
    );
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$3,'issuer','active','ready',$4,clock_timestamp(),ARRAY['tenant_admin']),($2,$3,'recipient','active','unset',NULL,NULL,ARRAY['call_taker'])",
      [adminId, targetId, activeId, hash],
    );
    const controlled = await issue(calls[0], {
      plane: 'tenant',
      tenantId: activeId,
      identityId: adminId,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    sessions.push(controlled);
    await recipient.addCookies([
      {
        name: '__Host-myims-staff',
        value: controlled.token,
        url: staff.origin,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await form.goto(`${staff.origin}/credential-issuer`);
    await expect(
      form.getByLabel('Target staff ID', { exact: true }),
    ).toBeVisible();
    await form.getByLabel('Target staff ID', { exact: true }).fill(targetId);
    await form.getByRole('checkbox').check();
    await form
      .getByRole('button', { name: 'Issue staff code', exact: true })
      .click();
    await expect(form.getByLabel('One-time handoff code')).toBeVisible();
    const staffCode = await form
      .getByLabel('One-time handoff code')
      .textContent();
    secrets.push(staffCode);
    await form.getByRole('button', { name: 'Hide code', exact: true }).click();
    const staffViolations = (await new AxeBuilder({ page: form }).analyze())
      .violations;
    if (staffViolations.length)
      throw new Error(
        `Credential browser accessibility failed: ${staffViolations.map((v) => (/^[a-z-]+$/.test(v.id) ? v.id : 'unknown')).join(',')}`,
      );
    await redis.del(key(controlled.token));
    await form
      .getByRole('button', { name: 'Check administrator access', exact: true })
      .click();
    await expect(
      form.getByLabel('Target staff ID', { exact: true }),
    ).toBeHidden();
    const renewed = await issue(calls[1], {
      plane: 'tenant',
      tenantId: activeId,
      identityId: adminId,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    sessions.push(renewed);
    await recipient.addCookies([
      {
        name: '__Host-myims-staff',
        value: renewed.token,
        url: staff.origin,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await form
      .getByRole('button', { name: 'Check administrator access', exact: true })
      .click();
    await expect(
      form.getByLabel('Target staff ID', { exact: true }),
    ).toHaveValue(targetId);
    const foreignId = randomUUID();
    await owner.query(
      "INSERT INTO public.staff_users(id,tenant_id,normalized_username,status,credential_state,password_hash,credential_changed_at,roles) VALUES($1,$2,'foreign.issuer','active','ready',$3,clock_timestamp(),ARRAY['tenant_admin'])",
      [foreignId, activeId, hash],
    );
    const foreign = await issue(calls[0], {
      plane: 'tenant',
      tenantId: activeId,
      identityId: foreignId,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    sessions.push(foreign);
    await recipient.addCookies([
      {
        name: '__Host-myims-staff',
        value: foreign.token,
        url: staff.origin,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await form
      .getByRole('button', { name: 'Check administrator access', exact: true })
      .click();
    await expect(
      form.getByLabel('Target staff ID', { exact: true }),
    ).toHaveValue('');
    await form.getByLabel('Target staff ID', { exact: true }).fill(targetId);
    await form.evaluate(() =>
      globalThis.dispatchEvent(new globalThis.Event('myims-staff-logout')),
    );
    await expect(
      form.getByLabel('Target staff ID', { exact: true }),
    ).toBeHidden();
    await form
      .getByRole('button', { name: 'Check administrator access', exact: true })
      .click();
    await expect(
      form.getByLabel('Target staff ID', { exact: true }),
    ).toHaveValue('');
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
      'PASS credential A-07: late disclosure fencing and same/foreign-owner staff issuer isolation; staff session is a controlled fixture pending b/c sign-in',
    );
  } catch (error) {
    const location =
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .find((l) => /check-credential-browser\.mjs:\d+/.test(l))
            ?.trim()
        : '';
    // eslint-disable-next-line preserve-caught-error -- Browser errors may contain passwords or one-time capabilities.
    throw new Error(
      `Credential HTTPS browser acceptance failed during ${phase}${location ? ` (${location})` : ''}${error?.message?.startsWith('Credential browser') ? `: ${error.message}` : ''}`,
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
