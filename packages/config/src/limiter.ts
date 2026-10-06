import { BlockList, isIP } from 'node:net';
import { ConfigurationError, type Environment } from './index';
export const limiterOperations = [
  'platform.sign-in',
  'tenant.sign-in',
  'platform.protected',
  'tenant.protected',
] as const;
export type LimiterOperation = (typeof limiterOperations)[number];
export interface LimiterPolicy {
  source: number;
  identity: number;
  windowMs: number;
}
export interface LimiterConfig {
  policies: Record<LimiterOperation, LimiterPolicy>;
  capacity: number;
  trustedProxies: readonly string[];
}
export function parseLimiterConfig(env: Environment): LimiterConfig {
  function bound(key: string, fallback: number) {
    const raw = env[key] ?? String(fallback),
      value = Number(raw);
    if (
      !/^\d+$/.test(raw) ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > fallback
    )
      throw new ConfigurationError(
        `${key} must be an integer between 1 and ${fallback}`,
      );
    return value;
  }
  const policies = {} as Record<LimiterOperation, LimiterPolicy>;
  for (const operation of limiterOperations) {
    const signIn = operation.endsWith('sign-in');
    const prefix = `LIMITER_${operation.toUpperCase().replace(/[.-]/g, '_')}`;
    policies[operation] = {
      source: bound(`${prefix}_SOURCE`, signIn ? 60 : 600),
      identity: bound(`${prefix}_IDENTITY`, signIn ? 10 : 120),
      windowMs: bound(`${prefix}_WINDOW_SECONDS`, signIn ? 900 : 60) * 1000,
    };
  }
  const raw = env.LIMITER_TRUSTED_PROXIES ?? '';
  if (raw.length > 2048)
    throw new ConfigurationError('LIMITER_TRUSTED_PROXIES is too long');
  const trustedProxies = raw === '' ? [] : raw.split(',').map((s) => s.trim());
  if (trustedProxies.length > 32)
    throw new ConfigurationError('Too many trusted proxies');
  for (const entry of trustedProxies) {
    const [address, bits, extra] = entry.split('/');
    const family = address ? isIP(address) : 0;
    if (
      !family ||
      address?.includes('%') ||
      extra !== undefined ||
      (bits !== undefined &&
        (!/^\d+$/.test(bits) || Number(bits) > (family === 4 ? 32 : 128)))
    )
      throw new ConfigurationError(
        'LIMITER_TRUSTED_PROXIES must contain IP addresses or CIDRs',
      );
    try {
      const list = new BlockList();
      if (bits !== undefined)
        list.addSubnet(address!, Number(bits), family === 4 ? 'ipv4' : 'ipv6');
      else list.addAddress(address!, family === 4 ? 'ipv4' : 'ipv6');
    } catch {
      throw new ConfigurationError('Invalid trusted proxy configuration');
    }
  }
  return {
    policies,
    capacity: bound('LIMITER_CAPACITY', 8192),
    trustedProxies,
  };
}
