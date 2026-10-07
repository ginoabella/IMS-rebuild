import {
  parsePlatformAuthConfig,
  parseCredentialBrowserConfig,
  type PlatformAuthConfig,
} from './platform-auth';
export {
  parsePlatformAuthConfig,
  parseCredentialBrowserConfig,
  type PlatformAuthConfig,
} from './platform-auth';
import { parseLimiterConfig, type LimiterConfig } from './limiter';
export {
  parseLimiterConfig,
  limiterOperations,
  type LimiterConfig,
  type LimiterOperation,
  type LimiterPolicy,
} from './limiter';
import { parseSessionConfig, type SessionConfig } from './session';
export { parseSessionConfig, type SessionConfig } from './session';
import { parseStorageConfig, type StorageConfig } from './storage';
export { parseStorageConfig, type StorageConfig } from './storage';
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
  platformAuth?: PlatformAuthConfig;
  credentialExchange?: PlatformAuthConfig;
  staffIssuer?: PlatformAuthConfig;
  storage?: StorageConfig;
  sessions: SessionConfig;
  limiter: LimiterConfig;
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
    platformAuth: parsePlatformAuthConfig(env),
    credentialExchange: parseCredentialBrowserConfig(
      env,
      'CREDENTIAL_EXCHANGE',
    ),
    staffIssuer: parseCredentialBrowserConfig(env, 'STAFF_ISSUER'),
    storage: parseStorageConfig(env),
    sessions: parseSessionConfig(env),
    limiter: parseLimiterConfig(env),
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

export function parseWorkerConfig(env: Environment) {
  return {
    batch: integer(env, 'WORKER_BATCH', 20, 1, 100),
    concurrency: integer(env, 'WORKER_CONCURRENCY', 2, 1, 10),
    pollMs: integer(env, 'WORKER_POLL_MS', 1000, 100, 30000),
    attempts: integer(env, 'WORKER_ATTEMPTS', 3, 1, 10),
    retrySeconds: integer(env, 'WORKER_RETRY_SECONDS', 2, 1, 60),
    timeoutSeconds: integer(env, 'WORKER_TIMEOUT_SECONDS', 30, 5, 300),
    shutdownMs: integer(env, 'WORKER_SHUTDOWN_MS', 10000, 1000, 30000),
  };
}
