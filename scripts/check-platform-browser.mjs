// Actual production Next app, HTTPS ingress, and independent real-service replicas.
import assert from 'node:assert/strict';
import { checkDraftTenantBrowser } from './check-draft-tenant-browser.mjs';
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const expect = baseExpect.configure({ timeout: 15000 });

export async function checkPlatformBrowser({
  config,
  ingress,
  a,
  b,
  select,
  username,
  password,
  owner,
  redis,
  key,
  secrets,
  records,
  issue,
  staffFacts,
  change,
}) {
  const ingressSecret = randomBytes(32).toString('hex');
  secrets.push(ingressSecret);
  let next, browser;
  const sockets = new Set();
  let responseGate = null;
  const pendingGates = new Set();
  function holdResponse(method, path) {
    assert.equal(responseGate, null);
    let arrived, release;
    const reached = new Promise((r) => {
      arrived = r;
    });
    const released = new Promise((r) => {
      release = r;
    });
    const gate = {
      method,
      path,
      arrived,
      released,
      release: () => {
        release();
        pendingGates.delete(gate);
      },
    };
    responseGate = gate;
    pendingGates.add(gate);
    return { reached, release: gate.release };
  }
  const balancer = createServer((req, res) => {
    const delayed =
      responseGate?.method === req.method && responseGate.path === req.url
        ? responseGate
        : null;
    if (delayed) responseGate = null;
    if (req.url?.startsWith('/platform/auth/'))
      transportEvents.push(`backend-${req.url.split('/').at(-1)}:sent`);
    const forwarded = {};
    for (const name of [
      'origin',
      'x-platform-proxy',
      'x-forwarded-for',
      'cookie',
      'x-platform-csrf',
      'content-type',
    ]) {
      if (typeof req.headers[name] === 'string')
        forwarded[name] = req.headers[name];
    }
    const upstream = request(
      `${ingress.selected().url}${req.url}`,
      { method: req.method, headers: forwarded },
      (incoming) => {
        if (req.url?.startsWith('/platform/auth/'))
          transportEvents.push(
            `backend-${req.url.split('/').at(-1)}:${incoming.statusCode}`,
          );
        if (delayed) {
          incoming.pause();
          delayed.arrived(incoming.statusCode);
          void delayed.released.then(() => {
            res.writeHead(incoming.statusCode, incoming.headers);
            incoming.pipe(res);
          });
        } else {
          res.writeHead(incoming.statusCode, incoming.headers);
          incoming.pipe(res);
        }
      },
    );
    upstream.on('error', () => res.writeHead(503).end());
    req.pipe(upstream);
  });
  balancer.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  balancer.listen(0, '127.0.0.1');
  await once(balancer, 'listening');
  let output = '';
  let phase = 'production browser build';
  const statuses = [];
  const requestUrls = [];
  const transportEvents = [];
  let currentPage;
  try {
    // Compile the verification form only into a separate non-shipping output.
    const fixtureDir = 'apps/platform-console-web/.local';
    mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(
      `${fixtureDir}/platform-auth-tsconfig.json`,
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
    const fingerprint = createHash('sha256');
    for (const directory of [
      'apps/platform-console-web/app',
      'packages/ui-web/src',
    ]) {
      for (const name of readdirSync(directory, { recursive: true }).sort()) {
        const file = `${directory}/${name}`;
        if (statSync(file).isFile())
          fingerprint.update(file).update(readFileSync(file));
      }
    }
    for (const file of [
      'apps/platform-console-web/next.config.ts',
      'apps/platform-console-web/tsconfig.json',
      'apps/platform-console-web/package.json',
      'tsconfig.base.json',
      'pnpm-lock.yaml',
    ])
      fingerprint.update(readFileSync(file));
    const revision = fingerprint.digest('hex');
    const marker = `${fixtureDir}/platform-auth-source.sha256`;
    if (
      !existsSync(`${fixtureDir}/platform-auth-next/BUILD_ID`) ||
      !existsSync(marker) ||
      readFileSync(marker, 'utf8') !== revision
    ) {
      rmSync(marker, { force: true });
      console.log('CHECK platform browser: isolated production Next build');
      const sharedBuild = spawn(
        'pnpm',
        ['--filter', '@myims/ui-web', 'build'],
        { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
      );
      sharedBuild.stdout.on('data', (d) => {
        output += d;
      });
      sharedBuild.stderr.on('data', (d) => {
        output += d;
      });
      const sharedDeadline = setTimeout(
        () => process.kill(-sharedBuild.pid, 'SIGKILL'),
        60000,
      );
      const [sharedCode] = await once(sharedBuild, 'exit');
      clearTimeout(sharedDeadline);
      assert.equal(sharedCode, 0, 'Shared browser UI dependency build failed');
      const build = spawn(
        'pnpm',
        ['--filter', '@myims/platform-console-web', 'build'],
        {
          env: { ...process.env, PLATFORM_AUTH_BROWSER_BUILD: '1' },
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      build.stdout.on('data', (d) => {
        output += d;
      });
      build.stderr.on('data', (d) => {
        output += d;
      });
      const deadline = setTimeout(
        () => process.kill(-build.pid, 'SIGKILL'),
        480000,
      );
      const [buildCode, buildSignal] = await once(build, 'exit');
      clearTimeout(deadline);
      console.log('CHECK platform browser: build exit', buildCode, buildSignal);
      assert.equal(buildCode, 0, 'Isolated browser application build failed');
      console.log('CHECK platform browser: actual secure-origin journey');
      writeFileSync(marker, revision);
    } else
      console.log('CHECK platform browser: unchanged production output reused');
    const portServer = createServer();
    portServer.listen(0, '127.0.0.1');
    await once(portServer, 'listening');
    const port = portServer.address().port;
    await new Promise((r) => portServer.close(r));
    next = spawn(
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
        cwd: 'apps/platform-console-web',
        env: {
          ...process.env,
          PLATFORM_AUTH_ORIGIN: config.origin,
          PLATFORM_AUTH_BACKEND_URL: `http://127.0.0.1:${balancer.address().port}`,
          PLATFORM_AUTH_PROXY_SECRET: config.proxySecret,
          PLATFORM_AUTH_INGRESS_SECRET: ingressSecret,
          PLATFORM_AUTH_BROWSER_BUILD: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      },
    );
    next.stdout.on('data', (d) => {
      output += d;
    });
    next.stderr.on('data', (d) => {
      output += d;
    });
    ingress.next(`http://127.0.0.1:${port}`, ingressSecret);
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/sign-in`)).ok) break;
      } catch {
        /* Startup. */
      }
      if (i === 99) throw new Error('Next production startup failed');
      await delay(100);
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    currentPage = page;
    page.on('requestfailed', (request) => {
      const path = new URL(request.url()).pathname;
      if (
        ['csrf', 'sign-in', 'session', 'logout'].some(
          (name) => path === `/platform/auth/${name}`,
        )
      )
        statuses.push(`${path.split('/').at(-1)}:failed`);
    });
    page.on('request', (request) => {
      requestUrls.push(request.url());
      const path = new URL(request.url()).pathname;
      if (
        ['csrf', 'sign-in', 'session', 'logout'].some(
          (name) => path === `/platform/auth/${name}`,
        )
      )
        statuses.push(`${path.split('/').at(-1)}:sent`);
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (
        ['csrf', 'sign-in', 'session', 'logout'].some(
          (name) => path === `/platform/auth/${name}`,
        )
      ) {
        statuses.push(`${path.split('/').at(-1)}:${response.status()}`);
        if (statuses.length > 8) statuses.shift();
      }
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    async function login(target = page, name = username, secret = password) {
      await target.getByLabel(/^Username/).fill(name);
      await target.getByLabel(/^Password/).fill(secret);
      await target
        .getByRole('button', { name: 'Sign in', exact: true })
        .focus();
      await target.keyboard.press('Enter');
    }
    async function token() {
      const cookie = (await context.cookies()).find(
        (c) => c.name === '__Host-myims-platform',
      );
      assert.ok(cookie);
      secrets.push(cookie.value);
      records.push({ token: cookie.value });
      return cookie.value;
    }
    async function expire(boundary) {
      const opaque = await token(),
        raw = await redis.get(key(opaque));
      assert.ok(raw);
      const r = JSON.parse(raw),
        now = Date.now();
      r.createdAt = Math.min(r.createdAt, now - 2000);
      r.lastActivityAt = now - 1000;
      r.idleExpiresAt = now - 1;
      if (boundary === 'absolute') {
        r.createdAt = now - 2000;
        r.absoluteExpiresAt = now - 1;
        await owner.query(
          'ALTER TABLE public.session_fences DISABLE TRIGGER session_fence_protection',
        );
        try {
          await owner.query(
            'UPDATE public.session_fences SET absolute_expires_at=$2 WHERE id=$1',
            [r.lifecycleId, r.absoluteExpiresAt],
          );
        } finally {
          await owner.query(
            'ALTER TABLE public.session_fences ENABLE TRIGGER session_fence_protection',
          );
        }
      }
      await redis.set(key(opaque), JSON.stringify(r));
    }
    phase = 'entry and sign-in';
    select(a);
    await page.goto(`${config.origin}/ui-preview`);
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    assert.equal(new URL(page.url()).pathname, '/sign-in');
    assert.equal(
      new URL(page.url()).searchParams.get('returnTo'),
      '/ui-preview',
    );
    assert.equal(await page.locator('input').count(), 2);
    assert.equal(
      await page.evaluate(async () => {
        try {
          return (await fetch('/platform/auth/csrf')).status;
        } catch {
          return 0;
        }
      }),
      200,
    );
    await page.getByLabel(/^Username/).fill(username);
    await page.getByLabel(/^Password/).fill('Wrong fixture password 2026');
    let duplicateAttempts = 0;
    const observedAttempt = (request) => {
      if (request.url().endsWith('/platform/auth/sign-in')) duplicateAttempts++;
    };
    page.on('request', observedAttempt);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Signing in…', exact: true }),
    ).toBeDisabled();
    await page.evaluate(() =>
      globalThis.document.querySelector('button[type=submit]').click(),
    );

    await expect(
      page.locator('main [role="alert"], main[role="alert"]'),
    ).toContainText('Invalid credentials');
    assert.equal(duplicateAttempts, 1);
    page.off('request', observedAttempt);
    await expect(page.getByLabel(/^Username/)).toHaveValue(username);
    await expect(page.getByLabel(/^Password/)).toHaveValue('');
    await expect(
      page.locator('main [role="alert"], main[role="alert"]'),
    ).toBeFocused();
    // Keyboard sign-in and normalized username, exact password bytes.
    await page.getByLabel(/^Username/).fill(` ${username.toUpperCase()} `);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Unfinished notes')).toBeVisible();
    assert.equal(new URL(page.url()).pathname, '/ui-preview');
    const accepted = (await context.cookies()).find(
      (c) => c.name === '__Host-myims-platform',
    );
    assert.ok(
      accepted.secure &&
        accepted.httpOnly &&
        accepted.sameSite === 'Lax' &&
        accepted.path === '/',
    );
    await token();
    const protectedResponse = await context.request.get(
      `${config.origin}/ui-preview`,
      {
        headers: { 'Sec-Fetch-Site': 'same-origin' },
      },
    );
    assert.equal(protectedResponse.status(), 200);
    assert.match(protectedResponse.headers()['cache-control'], /no-store/);
    const browserDto = await page.evaluate(async () =>
      (await fetch('/platform/auth/session')).json(),
    );
    assert.deepEqual(Object.keys(browserDto).sort(), [
      'absoluteExpiresAt',
      'idleExpiresAt',
      'operatorId',
      'plane',
      'proof',
    ]);
    assert.ok(
      !JSON.stringify(browserDto).includes(accepted.value),
      'Authentication cookie in browser JSON',
    );
    assert.equal(accepted.domain, 'localhost');

    assert.deepEqual(
      await page.evaluate(() => ({
        cookie: globalThis.document.cookie,
        local: globalThis.localStorage.length,
        session: globalThis.sessionStorage.length,
        secure: globalThis.isSecureContext,
      })),
      { cookie: '', local: 0, session: 0, secure: true },
    );
    select(b);
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/auth/session')).status,
      ),
      200,
    );
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
        true,
      );
    }
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Actual proxy rejects conflicting channels and malformed duplicate cookies.
    const channelToken = await token();
    for (const [headers, status] of [
      [{ Authorization: `Bearer ${channelToken}` }, 403],
      [
        {
          Cookie: `__Host-myims-platform=${channelToken}; __Host-myims-platform=${channelToken}`,
        },
        401,
      ],
      [{ Cookie: '__Host-myims-platform=malformed' }, 401],
    ]) {
      assert.equal(
        (
          await context.request.get(`${config.origin}/platform/auth/session`, {
            headers: {
              'Sec-Fetch-Site': 'same-origin',
              Origin: config.origin,
              ...headers,
            },
          })
        ).status(),
        status,
      );
    }
    // Passive current-session reads do not change stored activity or deadlines.
    const passiveToken = await token(),
      before = await redis.get(key(passiveToken));
    await page.evaluate(async () => {
      await fetch('/platform/auth/session');
      await fetch('/platform/auth/session');
    });
    assert.equal(await redis.get(key(passiveToken)), before);
    phase = 'draft tenant browser';
    await checkDraftTenantBrowser({
      page,
      context,
      config,
      owner,
      login,
      expire,
      ingress,
      select,
      a,
      b,
      username,
      redis,
      holdResponse,
    });
    phase = 'expiry and canonical-owner recovery';
    for (const boundary of ['idle', 'absolute']) {
      await page
        .getByLabel('Unfinished notes')
        .fill(`retained ${boundary} notes`);
      if (boundary === 'idle') {
        await page.getByRole('button', { name: 'Open confirmation' }).click();
        await expect(
          page.getByRole('dialog', { name: 'Confirm sample action' }),
        ).toBeVisible();
      }
      await expire(boundary);
      if (boundary === 'idle') {
        assert.equal(
          await page.evaluate(() => {
            const dialog = globalThis.document.querySelector('[role="dialog"]');
            globalThis.dispatchEvent(
              new globalThis.PageTransitionEvent('pageshow', {
                persisted: true,
              }),
            );
            return globalThis.getComputedStyle(dialog).visibility;
          }),
          'hidden',
        );
      } else
        await page
          .getByRole('button', { name: 'Submit retained work' })
          .click();
      await expect(
        page.getByRole('heading', { name: 'Platform console sign-in' }),
      ).toBeVisible();
      await expect(page.getByLabel('Unfinished notes')).not.toBeVisible();
      await expect(
        page.getByRole('dialog', { name: 'Confirm sample action' }),
      ).not.toBeVisible();
      await login();
      if (boundary === 'idle') {
        await expect(
          page.getByRole('dialog', { name: 'Confirm sample action' }),
        ).toBeVisible();
        await page
          .getByRole('dialog', { name: 'Confirm sample action' })
          .getByRole('button', { name: 'Close', exact: true })
          .click();
      }
      await expect(page.getByLabel('Unfinished notes')).toHaveValue(
        `retained ${boundary} notes`,
      );
      await expect(
        page.getByText('Explicit submissions: 0', { exact: true }),
      ).toBeVisible();
    }
    await page.getByRole('button', { name: 'Submit retained work' }).click();
    await expect(
      page.getByText('Explicit submissions: 1', { exact: true }),
    ).toBeVisible();
    await expire('idle');
    await page.getByRole('button', { name: 'Submit retained work' }).click();
    await login(page, `${username}.second`);
    await expect(page.getByLabel('Unfinished notes')).toHaveValue('');
    await expect(
      page.getByText('Explicit submissions: 0', { exact: true }),
    ).toBeVisible();
    console.log(
      'PASS platform B-01/02/04/06: real Next HTTPS entry/deep link, cookie acceptance, keyboard/reflow/accessibility, passive reads, idle/absolute retention and canonical identity isolation',
    );
    phase = 'outage and logout';
    // Real backend outage, and a recovery read rather than a replayed submission.
    await page.getByLabel('Unfinished notes').fill('outage retained notes');
    select({ url: 'http://127.0.0.1:1' });
    await page.getByRole('button', { name: 'Submit retained work' }).click();
    await expect(page.getByRole('status')).toContainText('Service unavailable');
    await expect(page.getByLabel('Unfinished notes')).not.toBeVisible();
    select(a);
    await delay(1100);
    await page.getByRole('button', { name: 'Retry access' }).click();
    await expect(page.getByLabel('Unfinished notes')).toHaveValue(
      'outage retained notes',
    );
    await expect(
      page.getByText('Explicit submissions: 0', { exact: true }),
    ).toBeVisible();
    // Logout unavailability must hide content and never claim confirmed shared logout.
    select({ url: 'http://127.0.0.1:1' });
    await page.getByRole('button', { name: 'Sign out', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(
      'Sign-out is not confirmed',
    );
    await expect(
      page.getByRole('button', { name: 'Retry sign out' }),
    ).toBeFocused();
    select(b);
    await delay(1100);
    await page.getByRole('button', { name: 'Retry sign out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    select(a);
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/auth/session')).status,
      ),
      401,
    );
    await page.goBack();
    await expect(page.getByLabel('Unfinished notes')).not.toBeVisible();
    await page.goto(
      `${config.origin}/sign-in?returnTo=${encodeURIComponent('//foreign.invalid')}`,
    );
    await login(page, `${username}.second`);
    await expect(
      page.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    assert.equal(new URL(page.url()).pathname, '/');
    phase = 'history and tab isolation';
    // Independent tab identity switch, with cooperative signals and with signals absent.
    await page.goto(`${config.origin}/ui-preview`);
    await page.getByLabel('Unfinished notes').fill('tab-owned notes');
    const tab = await context.newPage();
    await tab.goto(`${config.origin}/sign-in`);
    await login(tab, username);
    await expect(
      tab.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    await page.bringToFront();
    await expect(page.getByLabel('Unfinished notes')).toHaveValue('');
    phase = 'delayed logout signal';
    await page.getByLabel('Unfinished notes').fill('delayed-signal notes');
    const validationReply = page.waitForResponse(
      (response) =>
        response.url().endsWith('/platform/auth/session') &&
        response.status() === 200,
    );
    await tab.evaluate(() => {
      const channel = new globalThis.BroadcastChannel('myims-platform-access');
      channel.postMessage('logout');
      channel.close();
    });
    await validationReply;
    await expect(page.getByLabel('Unfinished notes')).toBeVisible();
    await expect(page.getByLabel('Unfinished notes')).toHaveValue(
      'delayed-signal notes',
    );
    await page.getByLabel('Unfinished notes').fill('missing-signal notes');
    await tab.evaluate(() => {
      globalThis.BroadcastChannel = undefined;
    });
    await tab.goto(`${config.origin}/sign-in`);
    await tab.evaluate(() => {
      globalThis.BroadcastChannel = undefined;
    });
    await login(tab, `${username}.second`);
    await expect(
      tab.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    await page.bringToFront();
    // Headless Chromium does not consistently emit focus/visibility events between tabs.
    // Exercise the actual restoration listener with a persisted pageshow event.
    phase = 'missing-signal restoration';
    assert.equal(
      await page.evaluate(() => {
        globalThis.dispatchEvent(
          new globalThis.PageTransitionEvent('pageshow', { persisted: true }),
        );
        return globalThis.getComputedStyle(
          globalThis.document.querySelector('#fixture-notes'),
        ).visibility;
      }),
      'hidden',
    );
    await expect(page.getByLabel('Unfinished notes')).toHaveValue('');
    await tab.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      tab.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    await page.bringToFront();
    await expect(page.getByLabel('Unfinished notes')).not.toBeVisible();
    phase = 'canonical status and staff denial';
    // Backend canonical status changes deny actual server-rendered access.
    await page.goto(`${config.origin}/sign-in`);
    await login(page, username);
    await expect(
      page.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    await change('disable');
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    await change('enable');
    // Real staff session can never enter the operator console or use cookie APIs.
    const staffSession = await issue(a, staffFacts);
    await context.addCookies([
      {
        name: '__Host-myims-platform',
        value: staffSession.token,
        url: config.origin,
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto(`${config.origin}/`);
    await expect(
      page.locator('main [role="alert"], main[role="alert"]'),
    ).toContainText('Access denied');
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/auth/session')).status,
      ),
      403,
    );
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/tenants')).status,
      ),
      403,
    );
    await context.clearCookies();
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/tenants')).status,
      ),
      401,
    );
    // Narrow consumer, mutations with missing/foreign Origin/CSRF and browser-held proxy headers fail.
    await page.goto(`${config.origin}/sign-in`);
    for (const path of [
      '/platform/auth/unknown',
      '/platform/auth/session?destination=http://foreign.invalid',
    ])
      assert.equal(
        await page.evaluate(async (path) => (await fetch(path)).status, path),
        403,
      );
    assert.equal(
      await page.evaluate(
        async () =>
          (
            await fetch('/platform/auth/sign-in', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            })
          ).status,
      ),
      403,
    );
    const forbidden = await context.request.post(
      `${config.origin}/platform/auth/logout`,
      {
        headers: {
          Origin: 'https://foreign.invalid',
          'X-Platform-Proxy': config.proxySecret,
          'X-Forwarded-For': '192.0.2.99',
        },
      },
    );
    assert.equal(forbidden.status(), 403);
    const malformedUtf8 = Buffer.concat([
      Buffer.from('{"username":"x","password":"wrong fixture '),
      Buffer.from([255]),
      Buffer.from(' password 2026"}'),
    ]);
    assert.equal(
      (
        await context.request.post(`${config.origin}/platform/auth/sign-in`, {
          headers: {
            Origin: config.origin,
            'Content-Type': 'application/json',
          },
          data: malformedUtf8,
        })
      ).status(),
      400,
    );
    // Direct private Next access without trusted ingress metadata cannot establish a session.
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/platform/auth/session`)).status,
      503,
    );
    for (const headers of [
      {},
      {
        'x-myims-ingress': '0'.repeat(64),
        'x-myims-client-ip': '127.0.0.1',
        'x-platform-proxy': config.proxySecret,
        'x-forwarded-for': '192.0.2.99',
        'x-actor-id': username,
        'x-role': 'platform_operator',
      },
    ])
      assert.equal(
        (await fetch(`http://127.0.0.1:${port}/platform/tenants`, { headers }))
          .status,
        503,
      );
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
        true,
      );
    }
    assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations, []);
    phase = 'lost issuance and logout responses';
    // Lost issuance/logout responses are real committed operations dropped at TLS ingress.
    let lostAttempts = 0;
    const observeLostAttempt = (request) => {
      if (request.url().endsWith('/platform/auth/sign-in')) lostAttempts++;
    };
    page.on('request', observeLostAttempt);
    ingress.drop('/platform/auth/sign-in');
    await login(page, `${username}.second`);
    await expect(
      page.locator('main [role="alert"], main[role="alert"]'),
    ).toContainText('response uncertain');
    await expect(page.getByLabel(/^Username/)).toHaveValue(
      `${username}.second`,
    );
    await expect(page.getByLabel(/^Password/)).toHaveValue('');
    assert.ok(
      !(await context.cookies()).some(
        (c) => c.name === '__Host-myims-platform',
      ),
    );
    await delay(1100);
    assert.equal(lostAttempts, 1);
    page.off('request', observeLostAttempt);
    await login(page, `${username}.second`);
    await expect(
      page.getByRole('heading', { name: 'Platform console', exact: true }),
    ).toBeVisible();
    await token();
    ingress.drop('/platform/auth/logout');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(
      'Sign-out is not confirmed',
    );
    select(a);
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/platform/auth/session')).status,
      ),
      401,
    );
    await delay(1100);
    await page.getByRole('button', { name: 'Retry sign out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Platform console sign-in' }),
    ).toBeVisible();
    // Exhaust a distinct real identity allowance, then verify the app honors Retry-After without loops.
    phase = 'bounded real rate-limit retry';
    const limited = `${username}.limited`;
    for (let i = 0; i < 10; i++) {
      assert.equal(
        await page.evaluate(
          async ({ name, password }) => {
            const { proof } = await (await fetch('/platform/auth/csrf')).json();
            return (
              await fetch('/platform/auth/sign-in', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Platform-CSRF': proof,
                },
                body: JSON.stringify({ username: name, password }),
              })
            ).status;
          },
          { name: limited, password },
        ),
        401,
      );
    }
    await login(page, limited);
    await expect(
      page.locator('main [role="alert"], main[role="alert"]'),
    ).toContainText('Too many requests');
    let attempts = 0;
    const attempted = (request) => {
      if (request.url().endsWith('/platform/auth/sign-in')) attempts++;
    };
    page.on('request', attempted);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.locator('main [role="alert"], main[role="alert"]'),
    ).toContainText('Wait for the retry interval');
    await expect(page.getByLabel(/^Password/)).toHaveValue('');
    await delay(200);
    assert.equal(attempts, 0);
    page.off('request', attempted);
    console.log(
      'PASS platform B-05/06: lost real issuance/logout responses preserve truthful retry, absent logout uses fresh CSRF, real 429 honors Retry-After without request loops',
    );
    assert.deepEqual(errors, []);
    for (const url of requestUrls) {
      for (const secret of secrets)
        assert.ok(
          !url.includes(secret) && !url.includes(encodeURIComponent(secret)),
          'Sensitive material in browser URL',
        );
    }

    const staticRoot =
      'apps/platform-console-web/.local/platform-auth-next/static';
    for (const name of readdirSync(staticRoot, { recursive: true })) {
      const file = `${staticRoot}/${name}`;
      if (!statSync(file).isFile()) continue;
      const content = readFileSync(file);
      for (const secret of secrets)
        assert.ok(
          !content.includes(secret),
          'Sensitive material in browser build',
        );
      for (const privateImport of [
        'PLATFORM_AUTH_PROXY_SECRET',
        'PLATFORM_AUTH_INGRESS_SECRET',
        'platform_operators',
        'password_hash',
      ])
        assert.ok(
          !content.includes(privateImport),
          'Server authority material in browser build',
        );
    }
    for (const secret of secrets)
      assert.ok(
        !output.includes(secret),
        'Sensitive material in Next diagnostics',
      );
    console.log(
      'PASS platform B-03/05/07: actual A/B logout and outage recovery, no stale write replay, history/tab isolation with missing signals, canonical disable and staff denial, narrow proxy and direct-ingress checks',
    );
    await context.close();
  } catch (error) {
    await currentPage
      ?.screenshot({
        path: '.local/ui-review/draft-failure.png',
        fullPage: true,
      })
      .catch(() => {});
    // Playwright errors can include fill values or request details. Never emit those.
    const location =
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .find((line) =>
              /^\s*at .*check-(?:platform-browser|draft-tenant-browser)\.mjs:\d+/.test(
                line,
              ),
            )
            ?.trim()
        : '';
    const category = [
      'strict mode violation',
      'Timeout',
      'toHaveValue',
      'toBeVisible',
      'toContainText',
      'Target closed',
      'Execution context was destroyed',
    ]
      .filter((value) => error?.message?.includes(value))
      .join(',');
    const alert = await currentPage
      ?.locator('main [role="alert"], main[role="alert"]')
      .textContent({ timeout: 1000 })
      .catch(() => '');
    const safeState =
      [
        'Invalid credentials',
        'Service unavailable',
        'Access denied',
        'Too many requests',
      ].find((value) => alert?.includes(value)) ?? 'no known feedback';
    // eslint-disable-next-line preserve-caught-error -- The caught Playwright error may contain passwords or headers.
    throw new Error(
      `Platform browser acceptance failed during ${phase}${location ? ` (${location})` : ''}; category ${category}; statuses ${statuses.join(',')}; feedback ${safeState}; transport ${transportEvents.slice(-8).join(',')}; ingress ${ingress.events().join(',')}}`,
    );
  } finally {
    for (const gate of pendingGates) gate.release();
    ingress.next(null);
    if (browser) await browser.close();
    if (next && next.exitCode === null) {
      process.kill(-next.pid, 'SIGTERM');
      await Promise.race([once(next, 'exit'), delay(5000)]);
      if (next.exitCode === null) process.kill(-next.pid, 'SIGKILL');
    }
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => balancer.close(resolve));
  }
}
