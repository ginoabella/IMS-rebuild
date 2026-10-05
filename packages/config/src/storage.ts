import { ConfigurationError, type Environment } from './index';

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  credentialsFile: string;
  maxBytes: number;
  concurrency: number;
  timeoutMs: number;
  attempts: number;
}
function limit(env: Environment, key: string, fallback: number, max: number) {
  const value = env[key] ?? String(fallback);
  const parsed = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > max
  )
    throw new ConfigurationError(
      `${key} must be an integer between 1 and ${max}`,
    );
  return parsed;
}
export function parseStorageConfig(
  env: Environment,
): StorageConfig | undefined {
  if (env.STORAGE_ENABLED === undefined || env.STORAGE_ENABLED === 'false')
    return undefined;
  if (env.STORAGE_ENABLED !== 'true')
    throw new ConfigurationError('STORAGE_ENABLED must be true or false');
  let endpoint: URL;
  try {
    endpoint = new URL(env.STORAGE_ENDPOINT ?? '');
  } catch {
    throw new ConfigurationError(
      'STORAGE_ENDPOINT must be a valid service URL',
    );
  }
  if (
    !['https:', 'http:'].includes(endpoint.protocol) ||
    !endpoint.hostname ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    endpoint.port === '0'
  )
    throw new ConfigurationError(
      'STORAGE_ENDPOINT must be a credential-free service origin',
    );
  // HTTP is restricted to the approved local service or loopback test proxies.
  if (
    endpoint.protocol === 'http:' &&
    (env.STORAGE_LOCAL_HTTP !== 'true' ||
      !['garage', 'localhost', '127.0.0.1', '[::1]'].includes(
        endpoint.hostname,
      ))
  )
    throw new ConfigurationError(
      'STORAGE_ENDPOINT requires HTTPS outside approved local development',
    );
  if (
    env.STORAGE_LOCAL_HTTP !== undefined &&
    !['true', 'false'].includes(env.STORAGE_LOCAL_HTTP)
  )
    throw new ConfigurationError('STORAGE_LOCAL_HTTP must be true or false');
  const bucket = env.STORAGE_BUCKET ?? '';
  if (!/^[a-z][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
    throw new ConfigurationError('STORAGE_BUCKET must be a valid bucket name');
  const region = env.STORAGE_REGION ?? '';
  if (!/^[a-z0-9-]{1,32}$/.test(region))
    throw new ConfigurationError('STORAGE_REGION must be a valid region');
  const credentialsFile = env.STORAGE_CREDENTIALS_FILE ?? '';
  if (!credentialsFile.startsWith('/') || /[\r\n\0]/.test(credentialsFile))
    throw new ConfigurationError(
      'STORAGE_CREDENTIALS_FILE must be an absolute file path',
    );
  return {
    endpoint: endpoint.origin,
    bucket,
    region,
    credentialsFile,
    maxBytes: limit(env, 'STORAGE_MAX_BYTES', 8388608, 16777216),
    concurrency: limit(env, 'STORAGE_CONCURRENCY', 4, 16),
    timeoutMs: limit(env, 'STORAGE_TIMEOUT_MS', 5000, 30000),
    attempts: limit(env, 'STORAGE_ATTEMPTS', 2, 3),
  };
}
