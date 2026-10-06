import { openHttp } from './session-http-fixture.mjs';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { SharedSessionLifecycle } = backend(
  './dist/modules/identity/application/session-lifecycle.js',
);
const { PostgresSessionFences } = backend(
  './dist/modules/identity/adapters/db/session-fences.js',
);
const { RedisSessionRecords } = backend(
  './dist/modules/identity/adapters/redis/session-records.js',
);
const { CanonicalSessionAuthority } = backend(
  './dist/modules/identity/adapters/db/session-authority.js',
);
const { SnapshotDatabase } = backend(
  './dist/infrastructure/database/read-snapshot.js',
);
const { StaffAuthorityRepository } = backend(
  './dist/modules/identity/adapters/db/authority-read.js',
);
const { PlatformAuthorityRepository } = backend(
  './dist/modules/platform/adapters/db/authority-read.js',
);
const { TenantAdmissionRepository } = backend(
  './dist/modules/tenancy/adapters/db/admission-read.js',
);
const { SafeLogger } = backend('./dist/infrastructure/execution/logging.js');
const { RedisDistributedLimiter } = backend(
  './dist/modules/identity/adapters/redis/limiter.js',
);
const { Admission } = backend(
  './dist/modules/identity/application/admission.js',
);
const { TrustedSource } = backend(
  './dist/modules/identity/adapters/http/trusted-source.js',
);
const { parseLimiterConfig } = backend('@myims/config');
let lifecycle, records, fences, database, http, limiter;
process.on('message', async (message) => {
  try {
    if (message.operation === 'init') {
      const { runtimeUrl, redisUrl, config } = message;
      database = new SnapshotDatabase(message.canonicalUrl ?? runtimeUrl);
      fences = new PostgresSessionFences(
        runtimeUrl,
        config,
        new SafeLogger('http', (line) => process.stdout.write(`${line}\n`)),
      );
      records = new RedisSessionRecords(redisUrl, config);
      await records.connect();
      const tenants = new TenantAdmissionRepository();
      const staff = new StaffAuthorityRepository(database, tenants, tenants);
      const platform = new PlatformAuthorityRepository(database);
      lifecycle = new SharedSessionLifecycle(
        records,
        fences,
        new CanonicalSessionAuthority(staff, platform),
        config,
      );
      if (message.http) {
        const limiterConfig = message.limiterConfig ?? parseLimiterConfig({});
        limiter = new RedisDistributedLimiter(
          message.limiterUrl ?? redisUrl,
          config,
          limiterConfig,
        );
        await limiter.connect();
        if (message.productionHttp) {
          backend('reflect-metadata');
          const { NestFactory } = backend('@nestjs/core');
          const { HttpModule } = backend(
            './dist/entrypoints/http/http.module.js',
          );
          const { configureHttpBoundary } = backend(
            './dist/modules/platform/adapters/http/http-boundary.js',
          );
          const base = backend(
            './dist/infrastructure/configuration.js',
          ).loadBackendConfig();
          const app = await NestFactory.create(
            HttpModule.register({
              ...base,
              database: { url: runtimeUrl },
              sessionRedis: { url: redisUrl },
              sessions: config,
              limiter: limiterConfig,
              platformAuth: message.browserConfig,
            }),
            { logger: false, bodyParser: false, abortOnError: false },
          );
          configureHttpBoundary(app);
          await app.listen(0, '127.0.0.1');
          http = {
            url: await app.getUrl(),
            close: () => app.close(),
            control: () => ({}),
          };
        } else
          http = await openHttp({
            browserConfig: message.browserConfig,
            credentials: new (backend(
              './dist/modules/platform/adapters/db/credential-read.js',
            ).PlatformCredentialRepository)(database),
            lifecycle,
            staff,
            platform,
            runtimeUrl,
            admission: new Admission(limiter),
            source: new TrustedSource(limiterConfig.trustedProxies),
          });
      }
      process.send({
        id: message.id,
        result: { ready: true, ...(http ? { url: http.url } : {}) },
      });
      return;
    }
    if (
      [
        'prepare',
        'release',
        'barrier',
        'stats',
        'metrics',
        'hash-failure',
      ].includes(message.operation)
    ) {
      process.send({
        id: message.id,
        result: http.control(message.operation, ...message.args),
      });
      return;
    }
    if (message.operation === 'close') {
      if (http) await http.close();
      records.close();
      limiter?.close();
      await fences.close();
      await database.close();
      process.send({ id: message.id, closed: true });
      process.disconnect();
      return;
    }
    const result = await lifecycle[message.operation](...message.args);
    // Tokens travel only over private trusted fixture IPC, never stdout/stderr.
    process.send({ id: message.id, result });
  } catch {
    process.send({ id: message.id, result: { kind: 'unavailable' } });
  }
});
