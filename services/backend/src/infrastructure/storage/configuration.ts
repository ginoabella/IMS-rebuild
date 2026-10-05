import { readFileSync } from 'node:fs';
import {
  ConfigurationError,
  parseStorageConfig,
  type Environment,
  type StorageConfig,
} from '@myims/config';
export interface StorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}
export type ResolvedStorageConfig = StorageConfig & {
  credentials: StorageCredentials;
};
export function resolveStorageConfig(
  config: StorageConfig,
): ResolvedStorageConfig {
  try {
    const bytes = readFileSync(config.credentialsFile);
    if (bytes.length > 4096) throw new Error();
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (
      typeof value !== 'object' ||
      value === null ||
      !('accessKeyId' in value) ||
      !('secretAccessKey' in value) ||
      typeof value.accessKeyId !== 'string' ||
      typeof value.secretAccessKey !== 'string' ||
      !/^GK[a-f0-9]{32}$/.test(value.accessKeyId) ||
      !/^[a-f0-9]{64}$/.test(value.secretAccessKey) ||
      Object.keys(value).length !== 2
    )
      throw new Error();
    return {
      ...config,
      credentials: {
        accessKeyId: value.accessKeyId,
        secretAccessKey: value.secretAccessKey,
      },
    };
  } catch {
    throw new ConfigurationError(
      'STORAGE credential file cannot be read or is invalid',
    );
  }
}
export function loadStorageConfig(env: Environment = process.env) {
  const config = parseStorageConfig(env);
  return config ? resolveStorageConfig(config) : undefined;
}
