import {
  constants,
  openSync,
  fstatSync,
  readFileSync,
  closeSync,
} from 'node:fs';
import { uuid } from '../../../identity/domain/storage';
export function protectedLiveBytes(path: string, maximum = 16384): Buffer {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.uid !== process.getuid?.() ||
      stat.mode & 0o077 ||
      stat.size > maximum
    )
      throw new Error('Protected live configuration unavailable');
    const bytes = readFileSync(fd);
    if (bytes.length > maximum)
      throw new Error('Protected live configuration unavailable');
    return bytes;
  } finally {
    closeSync(fd);
  }
}
export function liveConfiguration(path: string, consumer: boolean) {
  const value: unknown = JSON.parse(protectedLiveBytes(path).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Live configuration unavailable');
  const config = value as Record<string, unknown>;
  const keys = [
    'nodeId',
    'installationId',
    'databaseUrl',
    'databasePasswordFile',
    ...(consumer ? ['providerTokenFile', 'providerCaFile'] : ['socketGroup']),
  ];
  if (
    Object.keys(config).length !== keys.length ||
    Object.keys(config).some((key) => !keys.includes(key)) ||
    !uuid(config.nodeId) ||
    !uuid(config.installationId) ||
    typeof config.databaseUrl !== 'string'
  )
    throw new Error('Live configuration unavailable');
  for (const key of [
    'databasePasswordFile',
    ...(consumer ? ['providerTokenFile', 'providerCaFile'] : []),
  ])
    if (
      typeof config[key] !== 'string' ||
      !String(config[key]).startsWith('/run/pbx-live-') ||
      String(config[key]).includes('\0')
    )
      throw new Error('Live configuration unavailable');
  if (
    !consumer &&
    (!Number.isSafeInteger(config.socketGroup) ||
      Number(config.socketGroup) < 1 ||
      Number(config.socketGroup) > 2147483647)
  )
    throw new Error('Live configuration unavailable');
  const database = new URL(config.databaseUrl);
  if (
    database.protocol !== 'postgresql:' ||
    database.username !== 'myims_pbx_executor' ||
    database.password ||
    database.hostname !== 'postgres' ||
    database.port !== '5432'
  )
    throw new Error('Live database unavailable');
  database.password = protectedLiveBytes(
    String(config.databasePasswordFile),
    256,
  )
    .toString('utf8')
    .trim();
  if (!database.password) throw new Error('Live database unavailable');
  return {
    nodeId: config.nodeId as string,
    installationId: config.installationId as string,
    database: database.href,
    providerTokenFile: config.providerTokenFile as string,
    providerCaFile: config.providerCaFile as string,
    socketGroup: config.socketGroup as number,
  };
}
