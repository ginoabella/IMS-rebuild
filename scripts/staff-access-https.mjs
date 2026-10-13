// Declared private development composition; deploy ingress using your approved host/TLS mapping.
import { readFileSync, statSync } from 'node:fs';
import { createStaffIngress } from './staff-access-ingress.mjs';
try {
  const file = process.env.STAFF_ACCESS_CONFIG_FILE;
  if (!file || (statSync(file).mode & 0o077) !== 0)
    throw new Error('Private configuration required');
  const c = JSON.parse(readFileSync(file, 'utf8'));
  const origin = new URL(c.origin);
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== c.origin ||
    !/^[a-f0-9]{64}$/.test(c.proxySecret) ||
    !/^[a-f0-9]{64}$/.test(c.ingressSecret) ||
    c.proxySecret === c.ingressSecret ||
    !Number.isSafeInteger(c.port) ||
    c.port < 1024 ||
    c.port > 65535 ||
    !['127.0.0.1', '::1', '0.0.0.0', '::'].includes(c.bind)
  )
    throw new Error('Invalid configuration');
  for (const value of [c.nextUrl, c.backendUrl]) {
    const u = new URL(value);
    if (
      u.origin !== value ||
      u.protocol !== 'http:' ||
      u.hostname !== '127.0.0.1'
    )
      throw new Error('Private upstream required');
  }
  if ((statSync(c.keyFile).mode & 0o077) !== 0)
    throw new Error('Private TLS key required');
  const server = createStaffIngress({
    tls: { key: readFileSync(c.keyFile), cert: readFileSync(c.certFile) },
    config: c,
  });
  server.on('error', () => {
    console.error(
      'Staff HTTPS ingress unavailable. Check private configuration and ports.',
    );
    process.exitCode = 1;
  });
  server.listen(c.port, c.bind, () =>
    console.log(
      'Staff HTTPS ingress ready; private Next/backend and trusted native TLS configuration are required.',
    ),
  );
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch {
  console.error(
    'Staff HTTPS configuration invalid or unavailable. No credentials logged.',
  );
  process.exitCode = 1;
}
