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
const { enforceAdmission } = load('modules/identity/adapters/http/guards');
export async function openHttp({
  lifecycle,
  staff,
  platform,
  runtimeUrl,
  admission,
  source,
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
  const stats = { protected: 0, verification: 0 };
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
    ['health', Get, 'health/live', { access: 'public' }],
    ['signIn', Post, 'fixture/sign-in/:plane', { access: 'public' }],
    ['unclassified', Get, 'unclassified', null],
    [
      'platform',
      Get,
      'platform',
      {
        access: 'protected',
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
    controllers: [FixtureController],
    providers: [
      { provide: RequestAuthority, useValue: authority },
      { provide: Admission, useValue: admission },
      { provide: TrustedSource, useValue: source },
      { provide: APP_GUARD, useClass: AuthorityGuard },
      { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
    ],
  })(FixtureModule);
  const app = await NestFactory.create(FixtureModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  return {
    url: await app.getUrl(),
    control(operation, stage) {
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
