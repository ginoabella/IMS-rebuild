export type Environment = Record<string, string | undefined>;
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
export interface ConnectionConfig {
  url: string;
  secretFile?: string;
}
export interface BackendConfig {
  http: { host: string; port: number };
  database: ConnectionConfig;
  sessionRedis: ConnectionConfig;
  realtimeRedis: ConnectionConfig;
  dependencyTimeoutMs: number;
  databasePoolMax: number;
}
function integer(
  env: Environment,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = env[name] ?? String(fallback);
  const number = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  )
    throw new ConfigurationError(
      `${name} must be an integer between ${min} and ${max}`,
    );
  return number;
}
function connection(
  env: Environment,
  name: string,
  protocols: string[],
  fileKey: string,
): ConnectionConfig {
  const value = env[name];
  if (!value) throw new ConfigurationError(`${name} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError(`${name} must be a valid connection URL`);
  }
  if (!protocols.includes(url.protocol) || !url.hostname || url.hash)
    throw new ConfigurationError(`${name} has an invalid protocol or host`);
  if (
    name.endsWith('DATABASE_URL') &&
    (!url.username || url.pathname.length < 2)
  )
    throw new ConfigurationError(
      `${name} must include a database user and name`,
    );
  try {
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    decodeURIComponent(url.pathname);
  } catch {
    throw new ConfigurationError(`${name} contains invalid URL encoding`);
  }
  if (url.port === '0')
    throw new ConfigurationError(`${name} must use a nonzero service port`);
  if (
    protocols.includes('redis:') &&
    url.pathname !== '' &&
    url.pathname !== '/' &&
    !/^\/\d+$/.test(url.pathname)
  )
    throw new ConfigurationError(`${name} must use a numeric Redis database`);
  const secretFile = env[fileKey];
  if (
    secretFile !== undefined &&
    (!secretFile.startsWith('/') || secretFile.includes('\0'))
  )
    throw new ConfigurationError(`${fileKey} must be an absolute file path`);
  if (!url.password && !secretFile)
    throw new ConfigurationError(`${name} requires credentials or ${fileKey}`);
  if (url.password && secretFile)
    throw new ConfigurationError(
      `${name} and ${fileKey} must not both supply credentials`,
    );
  return { url: url.href, ...(secretFile ? { secretFile } : {}) };
}
export function parseDatabaseConfig(env: Environment, migration = false) {
  const prefix = migration ? 'MIGRATION_DATABASE' : 'DATABASE';
  return connection(
    env,
    `${prefix}_URL`,
    ['postgres:', 'postgresql:'],
    `${prefix}_PASSWORD_FILE`,
  );
}
export function parseBackendConfig(env: Environment): BackendConfig {
  const database = parseDatabaseConfig(env);
  const sessionRedis = connection(
    env,
    'SESSION_REDIS_URL',
    ['redis:', 'rediss:'],
    'SESSION_REDIS_AUTH_FILE',
  );
  const realtimeRedis = connection(
    env,
    'REALTIME_REDIS_URL',
    ['redis:', 'rediss:'],
    'REALTIME_REDIS_AUTH_FILE',
  );
  const session = new URL(sessionRedis.url);
  const realtime = new URL(realtimeRedis.url);
  if (
    session.hostname === realtime.hostname &&
    (session.port || '6379') === (realtime.port || '6379')
  )
    throw new ConfigurationError(
      'SESSION_REDIS_URL and REALTIME_REDIS_URL must use separate services',
    );
  const host = env.HOST ?? '127.0.0.1';
  if (!host || !/^[a-zA-Z0-9:.%-]+$/.test(host))
    throw new ConfigurationError('HOST must be a valid bind address');
  return {
    http: { host, port: integer(env, 'PORT', 4000, 0, 65535) },
    database,
    sessionRedis,
    realtimeRedis,
    dependencyTimeoutMs: integer(
      env,
      'DEPENDENCY_TIMEOUT_MS',
      2000,
      100,
      10000,
    ),
    databasePoolMax: integer(env, 'DATABASE_POOL_MAX', 5, 1, 20),
  };
}
