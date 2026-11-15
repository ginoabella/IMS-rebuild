// Real ordinary HTTPS only. Uses the existing approved platform operator.
// The temporary canonical session is revoked on exit; no password sign-in claim.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, X509Certificate } from 'node:crypto';
import { createServer, createConnection } from 'node:net';
import { once } from 'node:events';
import { chromium } from '@playwright/test';
import { readMaterial, browserOrigin } from './platform-https-material.mjs';
import { fingerprint } from './tenant-call-preparation-store.mjs';
export async function withOrdinaryConsole(p, run) {
  const load = createRequire(
    new URL('../services/backend/package.json', import.meta.url),
  );
  const config = load(
    './dist/infrastructure/configuration.js',
  ).loadBackendConfig();
  const { SnapshotDatabase } = load(
    './dist/infrastructure/database/read-snapshot.js',
  );
  const { PlatformAuthorityRepository } = load(
    './dist/modules/platform/adapters/db/authority-read.js',
  );
  const { PostgresSessionFences } = load(
    './dist/modules/identity/adapters/db/session-fences.js',
  );
  const { RedisSessionRecords } = load(
    './dist/modules/identity/adapters/redis/session-records.js',
  );
  const { SharedSessionLifecycle } = load(
    './dist/modules/identity/application/session-lifecycle.js',
  );
  const db = new SnapshotDatabase(config.database.url);
  const authority = new PlatformAuthorityRepository(db);
  const fences = new PostgresSessionFences(
    config.database.url,
    config.sessions,
  );
  const records = new RedisSessionRecords(
    config.sessionRedis.url,
    config.sessions,
  );
  const lifecycle = new SharedSessionLifecycle(
    records,
    fences,
    {
      async current(a) {
        assert.equal(a.plane, 'platform');
        const r = await authority.byId({
          plane: 'platform',
          operatorId: a.identityId,
        });
        return r.kind === 'eligible'
          ? {
              kind: 'eligible',
              authority: {
                plane: 'platform',
                identityId: r.snapshot.operatorId,
                authenticationVersion: r.snapshot.authenticationVersion,
              },
            }
          : r;
      },
    },
    config.sessions,
  );
  let session, browser, tunnel;
  const sockets = new Set();
  try {
    const approved = await db.read(
      async (s) =>
        (
          await s.query(
            'SELECT fingerprint,operator_id,authentication_version,node_id,installation_id FROM public.tenant_call_preparations WHERE id=$1',
            [p.requestId],
          )
        ).rows[0],
    );
    assert.equal(approved?.fingerprint, fingerprint(p));
    assert.equal(approved.operator_id, p.operatorId);
    assert.equal(approved.authentication_version, p.authenticationVersion);
    assert.equal(approved.node_id, p.nodeId);
    assert.equal(approved.installation_id, p.installationId);
    await records.connect();
    session = await lifecycle.issue(
      {
        plane: 'platform',
        identityId: p.operatorId,
        authenticationVersion: p.authenticationVersion,
      },
      'web',
    );
    assert.equal(session.kind, 'issued');
    const material = readMaterial();
    const pin = createHash('sha256')
      .update(
        new X509Certificate(material.cert).publicKey.export({
          type: 'spki',
          format: 'der',
        }),
      )
      .digest('base64');
    tunnel = createServer((socket) => {
      const upstream = createConnection({ host: '::1', port: 3001 });
      for (const s of [socket, upstream]) sockets.add(s);
      socket.on('close', () => {
        sockets.delete(socket);
        upstream.destroy();
      });
      upstream.on('close', () => {
        sockets.delete(upstream);
        socket.destroy();
      });
      socket.on('error', () => upstream.destroy());
      upstream.on('error', () => socket.destroy());
      socket.pipe(upstream).pipe(socket);
    });
    tunnel.listen(3443, '::1');
    await once(tunnel, 'listening');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--host-resolver-rules=MAP localhost [::1]',
        `--ignore-certificate-errors-spki-list=${pin}`,
      ],
    });
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: '__Host-myims-platform',
        value: session.token,
        url: browserOrigin,
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    const page = await context.newPage();
    return await run({ page, context, db, origin: browserOrigin });
  } finally {
    await browser?.close();
    for (const socket of sockets) socket.destroy();
    tunnel?.close();
    if (session?.kind === 'issued') {
      const result = await lifecycle.revoke(session.token, {
        lifecycleId: session.record.lifecycleId,
        generation: session.record.generation,
      });
      if (result.kind !== 'revoked') {
        console.error('Temporary canonical session revocation unavailable');
        process.exitCode = 1;
      }
    }
    records.close();
    await fences.close();
    await db.close();
  }
}
