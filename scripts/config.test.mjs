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
test('approved limiter budgets, shortened settings and bounded trusted proxies', () => {
  const config = parseBackendConfig(valid);
  assert.deepEqual(config.limiter.policies['tenant.protected'], {
    source: 600,
    identity: 120,
    windowMs: 60000,
  });
  assert.equal(config.limiter.capacity, 8192);
  assert.deepEqual(config.limiter.trustedProxies, []);
  assert.equal(
    parseBackendConfig({ ...valid, LIMITER_TENANT_PROTECTED_IDENTITY: '100' })
      .limiter.policies['tenant.protected'].identity,
    100,
  );
  for (const env of [
    { LIMITER_TENANT_PROTECTED_IDENTITY: '121' },
    { LIMITER_CAPACITY: '8193' },
    { LIMITER_TENANT_SIGN_IN_WINDOW_SECONDS: '901' },
    { LIMITER_TRUSTED_PROXIES: 'arbitrary-host' },
  ])
    assert.throws(
      () => parseBackendConfig({ ...valid, ...env }),
      ConfigurationError,
    );
});
test('platform browser settings are optional together and enforce exact trusted HTTPS topology', () => {
  assert.equal(parseBackendConfig(valid).platformAuth, undefined);
  const settings = {
    PLATFORM_AUTH_ORIGIN: 'https://console.example.test',
    PLATFORM_AUTH_PROXY_PEERS: '127.0.0.1',
    PLATFORM_AUTH_PROXY_SECRET: 'a'.repeat(64),
    PLATFORM_AUTH_CSRF_SECRET: 'b'.repeat(64),
    LIMITER_TRUSTED_PROXIES: '127.0.0.1',
  };
  assert.equal(
    parseBackendConfig({ ...valid, ...settings }).platformAuth.origin,
    settings.PLATFORM_AUTH_ORIGIN,
  );
  const empty = Object.fromEntries(
    Object.keys(settings).map((name) => [name, '']),
  );
  assert.equal(
    parseBackendConfig({ ...valid, ...empty }).platformAuth,
    undefined,
  );
  for (const change of [
    { PLATFORM_AUTH_ORIGIN: 'http://console.example.test' },
    { PLATFORM_AUTH_ORIGIN: 'https://console.example.test/path' },
    { PLATFORM_AUTH_ORIGIN: 'https://console.example.test/' },
    { PLATFORM_AUTH_PROXY_PEERS: '127.0.0.1/8' },
    { PLATFORM_AUTH_PROXY_PEERS: '127.0.0.1,127.0.0.1' },
    { LIMITER_TRUSTED_PROXIES: '' },
    { PLATFORM_AUTH_CSRF_SECRET: settings.PLATFORM_AUTH_PROXY_SECRET },
    { PLATFORM_AUTH_PROXY_SECRET: 'CONFIG_SECRET_SENTINEL' },
    { PLATFORM_AUTH_CSRF_SECRET: '' },
  ])
    assert.throws(
      () => parseBackendConfig({ ...valid, ...settings, ...change }),
      (error) =>
        error instanceof ConfigurationError &&
        !error.message.includes('CONFIG_SECRET_SENTINEL'),
    );
});
test('credential consumers require their own complete HTTPS configuration', () => {
  const platform = {
    PLATFORM_AUTH_ORIGIN: 'https://console.example.test',
    PLATFORM_AUTH_PROXY_PEERS: '127.0.0.1',
    PLATFORM_AUTH_PROXY_SECRET: 'a'.repeat(64),
    PLATFORM_AUTH_CSRF_SECRET: 'b'.repeat(64),
    LIMITER_TRUSTED_PROXIES: '127.0.0.1',
  };
  const absent = parseBackendConfig({ ...valid, ...platform });
  assert.equal(absent.credentialExchange, undefined);
  assert.equal(absent.staffIssuer, undefined);
  for (const [prefix, field] of [
    ['CREDENTIAL_EXCHANGE', 'credentialExchange'],
    ['STAFF_ISSUER', 'staffIssuer'],
  ]) {
    const settings = {
      [`${prefix}_ORIGIN`]: 'https://staff.example.test',
      [`${prefix}_PROXY_PEERS`]: '127.0.0.1',
      [`${prefix}_PROXY_SECRET`]: 'c'.repeat(64),
      [`${prefix}_CSRF_SECRET`]: 'd'.repeat(64),
    };
    const configured = parseBackendConfig({
      ...valid,
      ...platform,
      ...settings,
    });
    assert.equal(configured[field].origin, settings[`${prefix}_ORIGIN`]);
    assert.equal(
      configured[
        field === 'staffIssuer' ? 'credentialExchange' : 'staffIssuer'
      ],
      undefined,
    );
    for (const change of [
      { [`${prefix}_ORIGIN`]: 'http://staff.example.test' },
      { [`${prefix}_ORIGIN`]: 'https://staff.example.test/path' },
      { [`${prefix}_CSRF_SECRET`]: '' },
      { [`${prefix}_CSRF_SECRET`]: settings[`${prefix}_PROXY_SECRET`] },
      { [`${prefix}_PROXY_PEERS`]: '192.0.2.1' },
    ])
      assert.throws(
        () =>
          parseBackendConfig({ ...valid, ...platform, ...settings, ...change }),
        ConfigurationError,
      );
  }
});
