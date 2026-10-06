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
let lifecycle, records, fences, database;
process.on('message', async (message) => {
  try {
    if (message.operation === 'init') {
      const { runtimeUrl, redisUrl, config } = message;
      database = new SnapshotDatabase(runtimeUrl);
      fences = new PostgresSessionFences(
        runtimeUrl,
        config,
        new SafeLogger('http', (line) => process.stdout.write(`${line}\n`)),
      );
      records = new RedisSessionRecords(redisUrl, config);
      await records.connect();
      lifecycle = new SharedSessionLifecycle(
        records,
        fences,
        new CanonicalSessionAuthority(
          new StaffAuthorityRepository(
            database,
            new TenantAdmissionRepository(),
          ),
          new PlatformAuthorityRepository(database),
        ),
        config,
      );
      process.send({ id: message.id, ready: true });
      return;
    }
    if (message.operation === 'close') {
      records.close();
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
