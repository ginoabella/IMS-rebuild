import { readFileSync } from 'node:fs';
import {
  ConfigurationError,
  parseBackendConfig,
  parseDatabaseConfig,
  type ConnectionConfig,
  type Environment,
} from '@myims/config';
export function resolveConnection(
  config: ConnectionConfig,
  label: string,
  redis = false,
): string {
  if (!config.secretFile) return config.url;
  let secret: string;
  try {
    secret = readFileSync(config.secretFile, 'utf8').trim();
  } catch {
    throw new ConfigurationError(`${label} credential file cannot be read`);
  }
  if (redis) {
    if (!/^requirepass [a-zA-Z0-9]+$/.test(secret))
      throw new ConfigurationError(
        `${label} auth file must contain one requirepass directive`,
      );
    secret = secret.slice('requirepass '.length);
  }
  if (!secret || /[\r\n\0]/.test(secret))
    throw new ConfigurationError(`${label} credential file is invalid`);
  const url = new URL(config.url);
  url.password = secret;
  return url.href;
}
export function loadBackendConfig(env: Environment = process.env) {
  const config = parseBackendConfig(env);
  return {
    ...config,
    database: { url: resolveConnection(config.database, 'DATABASE') },
    sessionRedis: {
      url: resolveConnection(config.sessionRedis, 'SESSION_REDIS', true),
    },
    realtimeRedis: {
      url: resolveConnection(config.realtimeRedis, 'REALTIME_REDIS', true),
    },
  };
}
export function loadMigrationConfig(env: Environment = process.env) {
  return {
    adminUrl: resolveConnection(
      parseDatabaseConfig(env, true),
      'MIGRATION_DATABASE',
    ),
    runtimeUrl: resolveConnection(parseDatabaseConfig(env), 'DATABASE'),
  };
}
