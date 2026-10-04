import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConfigurationError,
  parseBackendConfig,
  parseDatabaseConfig,
} from '../packages/config/dist/index.js';
const valid = {
  DATABASE_URL: 'postgresql://runtime:fixture@postgres:5432/myims',
  SESSION_REDIS_URL: 'redis://:fixture@session-redis:6379',
  REALTIME_REDIS_URL: 'redis://:fixture@realtime-redis:6379',
};
test('validated defaults and explicit limits', () => {
  const config = parseBackendConfig(valid);
  assert.deepEqual(config.http, { host: '127.0.0.1', port: 4000 });
  assert.equal(config.databasePoolMax, 5);
  assert.equal(config.dependencyTimeoutMs, 2000);
  assert.equal(parseBackendConfig({ ...valid, PORT: '0' }).http.port, 0);
});
test('missing, malformed and ambiguous configuration fails without exposing values', () => {
  for (const DATABASE_URL of [
    'postgresql://runtime:%ZZ@postgres/myims',
    'postgresql://runtime:fixture@postgres:0/myims',
  ])
    assert.throws(
      () => parseBackendConfig({ ...valid, DATABASE_URL }),
      ConfigurationError,
    );
  assert.throws(
    () =>
      parseBackendConfig({
        ...valid,
        SESSION_REDIS_URL: 'redis://:fixture@session-redis/not-a-number',
      }),
    /numeric Redis database/,
  );
  for (const key of Object.keys(valid))
    assert.throws(
      () => parseBackendConfig({ ...valid, [key]: '' }),
      ConfigurationError,
    );
  for (const PORT of ['', 'abc', '-1', '65536', '1.2', 'Infinity'])
    assert.throws(() => parseBackendConfig({ ...valid, PORT }), /PORT must/);
  for (const DEPENDENCY_TIMEOUT_MS of ['0', '10001'])
    assert.throws(
      () => parseBackendConfig({ ...valid, DEPENDENCY_TIMEOUT_MS }),
      /DEPENDENCY_TIMEOUT_MS/,
    );
  assert.throws(
    () => parseBackendConfig({ ...valid, DATABASE_POOL_MAX: '21' }),
    /DATABASE_POOL_MAX/,
  );
  assert.throws(
    () =>
      parseBackendConfig({
        ...valid,
        DATABASE_URL: 'https://user:secret-sentinel@host',
      }),
    (error) => {
      assert.ok(!error.message.includes('secret-sentinel'));
      return error instanceof ConfigurationError;
    },
  );
  assert.throws(
    () =>
      parseBackendConfig({
        ...valid,
        REALTIME_REDIS_URL: valid.SESSION_REDIS_URL + '/1',
      }),
    /separate services/,
  );
  assert.throws(
    () =>
      parseBackendConfig({ ...valid, DATABASE_PASSWORD_FILE: '/tmp/fixture' }),
    /must not both/,
  );
});
test('file references and trusted migration credentials are distinct', () => {
  const config = parseBackendConfig({
    ...valid,
    DATABASE_URL: 'postgresql://runtime@postgres/myims',
    DATABASE_PASSWORD_FILE: '/run/secrets/runtime',
  });
  assert.equal(config.database.secretFile, '/run/secrets/runtime');
  assert.throws(
    () =>
      parseBackendConfig({
        ...valid,
        DATABASE_URL: 'postgresql://runtime@postgres/myims',
        DATABASE_PASSWORD_FILE: 'relative',
      }),
    /absolute/,
  );
  assert.throws(
    () => parseDatabaseConfig(valid, true),
    /MIGRATION_DATABASE_URL is required/,
  );
  assert.equal(
    new URL(
      parseDatabaseConfig(
        {
          MIGRATION_DATABASE_URL:
            'postgresql://deployment:fixture@postgres/myims',
        },
        true,
      ).url,
    ).username,
    'deployment',
  );
});
