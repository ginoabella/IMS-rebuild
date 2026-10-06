import { ConfigurationError, type Environment } from './index';
import { isIP } from 'node:net';
export interface PlatformAuthConfig {
  origin: string;
  proxyPeers: readonly string[];
  proxySecret: string;
  csrfSecret: string;
}
export function parsePlatformAuthConfig(
  env: Environment,
): PlatformAuthConfig | undefined {
  const names = [
    'PLATFORM_AUTH_ORIGIN',
    'PLATFORM_AUTH_PROXY_PEERS',
    'PLATFORM_AUTH_PROXY_SECRET',
    'PLATFORM_AUTH_CSRF_SECRET',
  ] as const;
  if (names.every((name) => env[name] === undefined || env[name] === ''))
    return undefined;
  const fail = () => {
    throw new ConfigurationError(
      'Invalid platform authentication configuration',
    );
  };
  const origin = env.PLATFORM_AUTH_ORIGIN;
  if (!origin || origin.length > 256) return fail();
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return fail();
  }
  if (
    url.protocol !== 'https:' ||
    url.origin !== origin ||
    url.username ||
    url.password
  )
    return fail();
  const proxyPeers = env.PLATFORM_AUTH_PROXY_PEERS?.split(',');
  if (
    !proxyPeers ||
    proxyPeers.length < 1 ||
    proxyPeers.length > 32 ||
    proxyPeers.some((peer) => !isIP(peer)) ||
    new Set(proxyPeers).size !== proxyPeers.length
  )
    return fail();
  const trusted = env.LIMITER_TRUSTED_PROXIES?.split(',') ?? [];
  if (proxyPeers.some((peer) => !trusted.includes(peer))) return fail();
  const proxySecret = env.PLATFORM_AUTH_PROXY_SECRET;
  const csrfSecret = env.PLATFORM_AUTH_CSRF_SECRET;
  if (
    !proxySecret ||
    !csrfSecret ||
    !/^[a-f0-9]{64}$/.test(proxySecret) ||
    !/^[a-f0-9]{64}$/.test(csrfSecret) ||
    proxySecret === csrfSecret
  )
    return fail();
  return { origin, proxyPeers, proxySecret, csrfSecret };
}
