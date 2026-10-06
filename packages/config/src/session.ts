import { ConfigurationError, type Environment } from './index';
export interface SessionConfig {
  web: { idleMs: number; absoluteMs: number };
  mobile: { idleMs: number; absoluteMs: number };
  timeoutMs: number;
  concurrency: number;
}
export function parseSessionConfig(env: Environment): SessionConfig {
  function bounded(key: string, fallback: number, max: number) {
    const raw = env[key] ?? String(fallback);
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1 || n > max)
      throw new ConfigurationError(
        `${key} must be an integer between 1 and ${max}`,
      );
    return n;
  }
  function policy(prefix: string, idle: number, absolute: number) {
    const idleMs = bounded(`SESSION_${prefix}_IDLE_SECONDS`, idle, idle) * 1000;
    const absoluteMs =
      bounded(`SESSION_${prefix}_ABSOLUTE_SECONDS`, absolute, absolute) * 1000;
    if (idleMs > absoluteMs)
      throw new ConfigurationError(
        `SESSION_${prefix} idle must not exceed absolute lifetime`,
      );
    return { idleMs, absoluteMs };
  }
  return {
    web: policy('WEB', 3600, 43200),
    mobile: policy('MOBILE', 86400, 604800),
    timeoutMs: bounded('SESSION_TIMEOUT_MS', 2000, 10000),
    concurrency: bounded('SESSION_CONCURRENCY', 4, 16),
  };
}
