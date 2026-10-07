// Test-only HTTP graph. Trusted issuance/control stays on IPC, never a route.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
backend('reflect-metadata');
const load = (p) => backend(`./dist/${p}.js`);
const { Controller, Get, Post, Req, Module, HttpException } =
  backend('@nestjs/common');
const { NestFactory, APP_GUARD, APP_INTERCEPTOR } = backend('@nestjs/core');
const { Pool } = backend('pg');
const { RequestAuthority, principalActor } = load(
  'modules/identity/application/request-authority',
);
const { TransactionAuthority } = load(
  'modules/identity/application/transaction-authority',
);
const { AuthorityGuard, ActivityInterceptor, requestPrincipal, httpFailure } =
  load('modules/identity/adapters/http/guards');
const { HttpAccess } = load('modules/identity/adapters/http/policy');
const { Transaction } = load('infrastructure/database/transaction');
const { SafeLogger } = load('infrastructure/execution/logging');
const { AuditRepository } = load('modules/audit/adapters/db/audit-repository');
const { Admission } = load('modules/identity/application/admission');
const { TrustedSource } = load('modules/identity/adapters/http/trusted-source');
const { StaffIssuerBrowser } = load(
  'modules/identity/adapters/http/credential-browser',
);
const { PlatformBrowser } = load(
  'modules/identity/adapters/http/platform-browser',
);
const { PlatformLogout } = load('modules/platform/application/logout');
const { PlatformCurrentSession } = load(
  'modules/platform/application/current-session',
);
const { PlatformSignIn } = load('modules/platform/application/sign-in');
const { PlatformAuthController } = load(
  'modules/platform/adapters/http/auth.controller',
);
const { configureHttpBoundary } = load(
  'modules/platform/adapters/http/http-boundary',
);
const { enforceAdmission } = load('modules/identity/adapters/http/guards');
export async function openHttp({
  lifecycle,
  staff,
  platform,
  runtimeUrl,
  admission,
  source,
  browserConfig,
  credentials,
}) {
  const pool = new Pool({
    connectionString: runtimeUrl,
    max: 4,
    connectionTimeoutMillis: 1000,
    statement_timeout: 4000,
  });
  pool.on('error', () => {});
  const authority = new RequestAuthority(lifecycle, staff, platform);
  const transactionAuthority = new TransactionAuthority(staff, platform);
  let barrier = null;
  const originalRead = credentials?.read.bind(credentials);
  if (credentials)
    credentials.read = async (...args) => {
      const result = await originalRead(...args);
      await wait('credential-read');
      return result;
    };
  const originalIssue = lifecycle.issue.bind(lifecycle);
  lifecycle.issue = async (...args) => {
    await wait('verified-issuance');
    return originalIssue(...args);
  };
  const stats = { protected: 0, verification: 0, hashes: 0, candidates: 0 };
  const passwordModule = load('infrastructure/password/scrypt');
  const originalVerify = passwordModule.verifyPasswordOutcome;
  passwordModule.verifyPasswordOutcome = (...args) => {
    stats.hashes++;
    return originalVerify(...args);
  };
  const candidate = platform.candidate.bind(platform);
  platform.candidate = (...args) => {
    stats.candidates++;
    return candidate(...args);
  };
  const crypto = backend('node:crypto');
  const originalScrypt = crypto.scrypt;
  const consumeProtected = admission.protected.bind(admission);
  admission.protected = async (...args) => {
    await wait('admission');
    return consumeProtected(...args);
  };
  async function wait(stage) {
    if (barrier?.stage !== stage) return;
    barrier.entered = true;
    barrier.count++;
    await barrier.promise;
  }
  function own(p, tenantId) {
    if (p.plane !== 'tenant' || p.tenantId !== tenantId) throw httpFailure(403);
  }
  // Representative owning use case: resource ownership, lock/version check,
  // fixture write and canonical actor audit all occur in the same transaction.
  async function sensitiveWrite(p, tenantId) {
    own(p, tenantId);
    await wait('before-lock');
    return Transaction.run(
      pool,
      {
        actor: principalActor(p),
        target: { type: 'guard-fixture', reference: randomUUID(), tenantId },
        correlationId: randomUUID(),
      },
      'guard-fixture.write',
      new SafeLogger('http'),
      async (tx) => {
        if (!(await transactionAuthority.validate(tx, p)))
          throw httpFailure(401);
        await wait('after-lock');
        await tx.query(
          'INSERT INTO guard_fixture.writes(tenant_id,actor_id) VALUES($1,$2)',
          [tenantId, p.staffId],
        );
        await new AuditRepository().append(
          tx,
          {
            type: 'guard-fixture.write',
            version: 1,
            fields: { revision: { kind: 'integer', min: 1, max: 1 } },
          },
          { revision: 1 },
        );
        return { written: true };
      },
    );
  }
  class FixtureController {
    health() {
      return { status: 'alive' };
    }
    async cookieWrite(req) {
      const p = requestPrincipal(req);
      await wait('before-lock');
      return Transaction.run(
        pool,
        {
          actor: principalActor(p),
          target: {
            type: 'guard-fixture',
            reference: randomUUID(),
            tenantId: null,
          },
          correlationId: randomUUID(),
        },
        'guard-fixture.write',
        new SafeLogger('http'),
        async (tx) => {
          if (!(await transactionAuthority.validate(tx, p)))
            throw httpFailure(401);
          await wait('after-lock');
          await tx.query(
            'INSERT INTO guard_fixture.platform_writes(actor_id) VALUES($1)',
            [p.operatorId],
          );
          await new AuditRepository().append(
            tx,
            {
              type: 'guard-fixture.write',
              version: 1,
              fields: { revision: { kind: 'integer', min: 1, max: 1 } },
            },
            { revision: 1 },
          );
          return { written: true };
        },
      );
    }
    platformActivity(req) {
      return this.platform(req);
    }
    async signIn(req) {
      await wait('sign-in');
      enforceAdmission(
        await admission.signIn({
          plane: req.params.plane,
          source: source.extract(req),
          username: req.body?.username,
          tenantCode: req.body?.tenantCode,
        }),
        req.res,
      );
      // Test-only verification sentinel: never issues a token or checks a password.
      stats.verification++;
      return { verifiedFixture: true };
    }
    noChannel() {
      throw new Error('Unclassified channel executed');
    }
    unclassified() {
      throw new Error('Unclassified handler executed');
    }
    platform(req) {
      stats.protected++;
      return {
        principal: requestPrincipal(req),
        actor: principalActor(requestPrincipal(req)),
      };
    }
    staff(req) {
      stats.protected++;
      const p = requestPrincipal(req);
      own(p, req.params.tenantId);
      return { principal: p, actor: principalActor(p) };
    }
    manage(req) {
      return this.staff(req);
    }
    async write(req) {
      return sensitiveWrite(requestPrincipal(req), req.params.tenantId);
    }
    fail() {
      throw new HttpException({ message: 'Fixture operation failed' }, 409);
    }
    async activity(req) {
      await wait('activity');
      return { principal: requestPrincipal(req) };
    }
  }
  Controller()(FixtureController);
  const routes = [
    [
      'cookieWrite',
      Post,
      'fixture/platform-write',
      {
        access: 'protected',
        channel: 'platform-cookie',
        plane: 'platform',
        permissions: ['platform_operator'],
        activity: 'operational',
      },
    ],
    ['health', Get, 'health/live', { access: 'public' }],
    ['signIn', Post, 'fixture/sign-in/:plane', { access: 'public' }],
    ['unclassified', Get, 'unclassified', null],
    [
      'noChannel',
      Get,
      'fixture/no-channel',
      {
        access: 'protected',
        plane: 'platform',
        permissions: ['platform_operator'],
        activity: 'passive',
      },
    ],
    [
      'platform',
      Get,
      'platform',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'platform',
        permissions: ['platform_operator'],
        activity: 'passive',
      },
    ],
    [
      'platformActivity',
      Post,
      'platform/activity',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'platform',
        permissions: ['platform_operator'],
        activity: 'operational',
      },
    ],
    [
      'staff',
      Get,
      'staff/:tenantId',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'tenant',
        permissions: ['incident.read'],
        activity: 'passive',
      },
    ],
    [
      'manage',
      Get,
      'manage/:tenantId',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'tenant',
        permissions: ['tenant.manage'],
        activity: 'passive',
      },
    ],
    [
      'write',
      Post,
      'staff/:tenantId/write',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'tenant',
        permissions: ['incident.create'],
        activity: 'operational',
      },
    ],
    [
      'fail',
      Post,
      'fail',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'tenant',
        permissions: ['incident.create'],
        activity: 'operational',
      },
    ],
    [
      'activity',
      Post,
      'activity',
      {
        access: 'protected',
        channel: 'bearer',
        plane: 'tenant',
        permissions: ['incident.create'],
        activity: 'operational',
      },
    ],
  ];
  for (const [name, method, path, policy] of routes) {
    const descriptor = Object.getOwnPropertyDescriptor(
      FixtureController.prototype,
      name,
    );
    method(path)(FixtureController.prototype, name, descriptor);
    if (policy)
      HttpAccess(policy)(FixtureController.prototype, name, descriptor);
    Req()(FixtureController.prototype, name, 0);
  }
  class FixtureModule {}
  Module({
    controllers: [
      FixtureController,
      ...(browserConfig ? [PlatformAuthController] : []),
    ],
    providers: [
      { provide: StaffIssuerBrowser, useValue: new StaffIssuerBrowser() },
      {
        provide: PlatformLogout,
        useValue: new PlatformLogout(authority, admission),
      },
      {
        provide: PlatformCurrentSession,
        useValue: new PlatformCurrentSession(),
      },
      {
        provide: PlatformBrowser,
        useValue: new PlatformBrowser(browserConfig),
      },
      {
        provide: PlatformSignIn,
        useValue: new PlatformSignIn(
          admission,
          platform,
          credentials,
          lifecycle,
        ),
      },
      { provide: RequestAuthority, useValue: authority },
      { provide: Admission, useValue: admission },
      { provide: TrustedSource, useValue: source },
      { provide: APP_GUARD, useClass: AuthorityGuard },
      { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
    ],
  })(FixtureModule);
  const app = await NestFactory.create(FixtureModule, {
    logger: false,
    bodyParser: false,
  });
  configureHttpBoundary(app);
  await app.listen(0, '127.0.0.1');
  return {
    url: await app.getUrl(),
    control(operation, stage) {
      if (operation === 'hash-failure') {
        crypto.scrypt = stage
          ? () => {
              throw new Error('HASH_INTERNAL_FAILURE_SENTINEL');
            }
          : originalScrypt;
        return { configured: true };
      }
      if (operation === 'metrics') return admission.metrics();
      if (operation === 'stats') return { ...stats };
      if (operation === 'prepare') {
        let release;
        const promise = new Promise((r) => {
          release = r;
        });
        barrier = { stage, promise, release, entered: false, count: 0 };
      }
      if (operation === 'release') barrier?.release();
      return { entered: barrier?.entered ?? false, count: barrier?.count ?? 0 };
    },
    async close() {
      barrier?.release();
      await app.close();
      await pool.end();
    },
  };
}
