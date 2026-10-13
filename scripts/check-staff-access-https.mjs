// Read-only readiness for the separately configured native ingress. No sign-in.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { request } from 'node:https';
import {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
} from 'node:crypto';

let phase = 'private configuration';
try {
  const file = process.argv[2] ?? process.env.STAFF_ACCESS_CONFIG_FILE;
  const caFile = process.argv[3] ?? process.env.STAFF_ACCESS_CA_FILE;
  assert.ok(file && caFile, 'Configuration and public CA file required');
  assert.equal(statSync(file).mode & 0o077, 0);
  const c = JSON.parse(readFileSync(file, 'utf8'));
  const origin = new URL(c.origin);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.origin, c.origin);
  assert.equal(statSync(c.keyFile).mode & 0o077, 0);
  const cert = new X509Certificate(readFileSync(c.certFile));
  assert.ok(cert.checkHost(origin.hostname));
  assert.ok(Date.parse(cert.validFrom) <= Date.now());
  assert.ok(Date.parse(cert.validTo) > Date.now());
  assert.ok(
    cert.publicKey.export({ type: 'spki', format: 'der' }).equals(
      createPublicKey(createPrivateKey(readFileSync(c.keyFile))).export({
        type: 'spki',
        format: 'der',
      }),
    ),
  );
  const ca = readFileSync(caFile);
  // A local loopback client is itself a trusted proxy in the development graph.
  // Use the container interface for a socket-derived, unambiguous client source.
  const host =
    process.env.STAFF_ACCESS_PROBE_HOST ??
    (['0.0.0.0', '::'].includes(c.bind)
      ? Object.values(networkInterfaces())
          .flat()
          .find((entry) => entry && !entry.internal && entry.family === 'IPv4')
          ?.address
      : c.bind);
  assert.ok(host);
  function probe(path, browser = false) {
    return new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: host,
          port: c.port,
          servername: origin.hostname,
          ca,
          path,
          timeout: 8000,
          headers: {
            host: origin.host,
            ...(browser ? { 'sec-fetch-site': 'same-origin' } : {}),
          },
        },
        (res) => {
          const result = {
            status: res.statusCode,
            authorized: res.socket.authorized,
            cache: res.headers['cache-control'],
          };
          res.on('error', reject);
          res.resume(); // Never print proof/cookies or response bodies.
          res.on('end', () => resolve(result));
        },
      );
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('Readiness timeout')));
      req.end();
    });
  }
  for (const [path, browser, status] of [
    ['/sign-in', true, 200],
    ['/staff/auth/browser/csrf', true, 200],
    ['/staff/auth/mobile/session', false, 401],
    ['/staff/auth/mobile/session', true, 403],
  ]) {
    phase = path;
    const r = await probe(path, browser);
    assert.equal(r.authorized, true);
    assert.equal(r.status, status);
    assert.match(r.cache ?? '', /no-store/);
    console.log(`PASS ${path}: ${status}, verified TLS, no-store`);
  }
  console.log(
    'PASS configured staff ingress readiness; device trust, sign-in and OS storage require native acceptance.',
  );
} catch {
  console.error(
    `FAIL configured staff ingress during ${phase}; check CA, routing, private transport configuration and socket-source attribution. No secrets logged.`,
  );
  process.exitCode = 1;
}
