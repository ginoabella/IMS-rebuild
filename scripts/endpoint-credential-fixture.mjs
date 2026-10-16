// Trusted isolated acceptance process. Never returns credential material.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { request } from 'node:https';
import { createServer, connect } from 'node:net';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const require = createRequire('/workspace/services/backend/package.json');
const load = (p) => require(`/workspace/services/backend/dist/${p}.js`);
const { resolveConnection } = load('infrastructure/configuration');
const { parseDatabaseConfig } = require('@myims/config');
const { Pool } = require('pg');
const { CredentialMaintenance } = load(
  'modules/telephony/adapters/credentials/maintenance',
);
const { OpenBaoEndpointProvider, openBaoSettings } = load(
  'modules/telephony/adapters/credentials/openbao',
);
const { CredentialHandler } = load(
  'modules/telephony/adapters/jobs/credential-handler',
);
const { CredentialProviderError } = load(
  'modules/telephony/application/credential-ports',
);
const { binding, CredentialRepository } = load(
  'modules/telephony/adapters/db/credential-repository',
);
const { AuditRepository } = load('modules/audit/adapters/db/audit-repository');
const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
const { PlatformAuthorityRepository } = load(
  'modules/platform/adapters/db/authority-read',
);
const { TransactionAuthority } = load(
  'modules/identity/application/transaction-authority',
);
const { InventoryRuntime } = load(
  'modules/telephony/adapters/db/inventory-runtime',
);
const { SafeLogger } = load('infrastructure/execution/logging');
const input = JSON.parse(readFileSync(0, 'utf8'));
if (!/^myims_session_[a-f0-9]{12}$/.test(input.database))
  throw new Error('Invalid fixture database');
const direct = new URL(
  resolveConnection(parseDatabaseConfig(process.env), 'DATABASE'),
);
direct.pathname = `/${input.database}`;
async function dbProxy(pattern) {
  const sockets = new Set();
  let dropped = false,
    interrupted = false;
  const server = createServer((down) => {
    if (interrupted) {
      down.destroy();
      return;
    }
    const up = connect({
      host: direct.hostname,
      port: Number(direct.port || 5432),
    });
    for (const s of [up, down]) {
      sockets.add(s);
      s.on('error', () => {});
      s.on('close', () => sockets.delete(s));
    }
    let mutation = false,
      tail = '',
      received = Buffer.alloc(0);
    down.on('data', (bytes) => {
      tail = (tail + bytes.toString()).slice(-8192);
      if (pattern?.test(tail)) mutation = true;
      up.write(bytes);
    });
    up.on('data', (bytes) => {
      received = Buffer.concat([received, bytes]);
      while (received.length >= 5) {
        const size = received.readUInt32BE(1) + 1;
        if (size < 5 || size > 1048576) {
          up.destroy();
          down.destroy();
          return;
        }
        if (received.length < size) break;
        const frame = received.subarray(0, size);
        received = received.subarray(size);
        if (
          !dropped &&
          mutation &&
          frame[0] === 67 &&
          frame.subarray(5).toString() === 'COMMIT\0'
        ) {
          dropped = true;
          down.destroy();
          up.destroy();
          return;
        }
        down.write(frame);
      }
    });
    down.on('close', () => up.destroy());
    up.on('close', () => down.destroy());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(direct);
  url.hostname = '127.0.0.1';
  url.port = String(server.address().port);
  url.searchParams.delete('sslmode');
  return {
    url: url.href,
    interrupt: () => {
      interrupted = true;
      for (const s of sockets) s.destroy();
    },
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise((r) => server.close(r));
    },
  };
}
const proxy = [
  'final_commit',
  'cleanup_commit',
  'database_after_prepare',
].includes(input.fault)
  ? await dbProxy(
      input.fault === 'final_commit'
        ? /UPDATE public\.extensions SET credential_generation_id/
        : input.fault === 'cleanup_commit'
          ? /UPDATE public\.endpoint_credential_operations SET cleanup_state/
          : undefined,
    )
  : undefined;
const url = proxy?.url ?? direct.href;
const pool = new Pool({
  connectionString: url,
  max: 4,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
  application_name: `endpoint-fixture-${input.operationId}`,
});
pool.on('connect', (c) => c.on('error', () => {}));
pool.on('error', () => {});
const database = new SnapshotDatabase(url);
const authority = new TransactionAuthority(
  { lockedById: async () => ({ kind: 'denied' }) },
  new PlatformAuthorityRepository(database),
);
const inventory = new InventoryRuntime(
  url,
  authority,
  new SafeLogger('worker'),
);
const settings = openBaoSettings(process.env),
  provider = new OpenBaoEndpointProvider(settings);
function location(b) {
  return `installations/${b.installationId}/extensions/${b.extensionId}/operations/${b.operationId}`;
}
async function raw(path, body, method = body === undefined ? 'GET' : 'POST') {
  return new Promise((resolve, reject) => {
    const req = request(
      `${settings.endpoint}/v1/${path}`,
      {
        method,
        ca: readFileSync(settings.caFile),
        headers: {
          'X-Vault-Token': readFileSync(settings.tokenFile, 'utf8'),
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let bytes = '';
        res.on('data', (b) => {
          bytes += b;
          if (bytes.length > 65536) req.destroy();
        });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              value: bytes ? JSON.parse(bytes) : {},
            });
          } catch {
            reject(new Error('Invalid fixture provider response'));
          }
        });
      },
    );
    const timer = setTimeout(() => req.destroy(), 5000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', () => reject(new Error('Fixture provider unavailable')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
let result;
try {
  const row = await new CredentialRepository().operation(
    pool,
    input.operationId,
  );
  if (!row || row.installation_id !== settings.installationId)
    throw new Error('Invalid fixture operation');
  console.log(
    JSON.stringify({ fixture: 'endpoint-reservation', binding: binding(row) }),
  );
  async function barrier() {
    await pool.query(
      'UPDATE public.endpoint_fixture_barriers SET ready=true WHERE operation_id=$1',
      [row.id],
    );
    for (let i = 0; i < 2000; i++) {
      const r = await pool.query(
        'SELECT released FROM public.endpoint_fixture_barriers WHERE operation_id=$1',
        [row.id],
      );
      if (r.rows[0]?.released) return;
      await delay(25);
    }
    throw new Error('Fixture barrier deadline');
  }
  const hooks = {
    barrier: async (stage) => {
      if (input.fault === 'restart' && stage === 'after_prepare')
        process.exit(74);
      if (input.fault === 'database_after_prepare' && stage === 'after_prepare')
        proxy.interrupt();
      if (input.fault === 'final_barrier' && stage === 'after_prepare')
        await barrier();
    },
  };
  let effective = provider;
  if (input.fault === 'outage')
    effective = {
      prepare: async () => {
        throw new CredentialProviderError('provider_unavailable', true);
      },
      verify: (b) => provider.verify(b),
    };
  if (input.fault === 'lost_provider')
    effective = {
      prepare: async (b) => {
        await provider.prepare(b);
        throw new CredentialProviderError('provider_unavailable', true);
      },
      verify: (b) => provider.verify(b),
    };
  if (input.fault === 'invalid')
    effective = {
      prepare: async () => {
        throw new CredentialProviderError('material_invalid', false);
      },
      verify: (b) => provider.verify(b),
    };
  if (input.fault === 'late')
    effective = {
      prepare: async (b) => {
        await barrier();
        await provider.prepare(b);
      },
      verify: (b) => provider.verify(b),
    };
  if (input.action === 'execute') {
    await new CredentialHandler(
      pool,
      authority,
      inventory.service,
      new AuditRepository(),
      effective,
      hooks,
    ).execute(row.id, row.work_id, input.attempt ?? 1);
    result = {
      state: (await new CredentialRepository().operation(pool, row.id)).state,
    };
  } else if (input.action === 'queue') {
    await pool.query(
      "INSERT INTO pgboss.job(name,data,retry_limit,retry_delay,retry_backoff,expire_in) VALUES('committed-work-v1',jsonb_build_object('workId',$1::text),5,5,true,interval '60 seconds')",
      [row.work_id],
    );
    const children = Array.from({ length: 2 }, () =>
      spawn(
        process.execPath,
        ['/workspace/services/backend/dist/entrypoints/worker/main.js'],
        {
          env: {
            ...process.env,
            DATABASE_URL: direct.href,
            DATABASE_PASSWORD_FILE: undefined,
            WORKER_CONSUMER: 'endpoint-credentials',
            WORKER_POLL_MS: '100',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      ),
    );
    for (const c of children) {
      c.stdout.on('data', (b) => process.stdout.write(b));
      c.stderr.on('data', (b) => process.stdout.write(b));
    }
    try {
      for (let i = 0; i < 600; i++) {
        if (
          (await new CredentialRepository().operation(pool, row.id)).state ===
          'associated'
        )
          break;
        await delay(25);
      }
      result = {
        state: (await new CredentialRepository().operation(pool, row.id)).state,
        productionWorkers: 2,
      };
    } finally {
      await Promise.all(
        children.map(async (c) => {
          if (c.exitCode === null) {
            c.kill('SIGTERM');
            await once(c, 'exit');
          }
        }),
      );
    }
  } else if (input.action === 'fixture-destroy') {
    result = { outcome: await provider.destroy(binding(row)) };
  } else if (input.action === 'prepare') {
    await provider.prepare(binding(row));
    result = { prepared: true };
  } else if (input.action === 'verify') {
    await new CredentialHandler(
      pool,
      authority,
      inventory.service,
      new AuditRepository(),
      provider,
    ).verify(row.id);
    const health = (await new CredentialRepository().operation(pool, row.id))
      .material_health;
    result = { verified: health === 'verified', health };
  } else if (input.action === 'cleanup') {
    let destroyed = false;
    const cleanup = ['lost_destroy', 'cleanup_restart'].includes(input.fault)
      ? {
          destroy: async (b) => {
            const out = await provider.destroy(b);
            if (!destroyed) {
              destroyed = true;
              if (input.fault === 'cleanup_restart') process.exit(74);
              throw new CredentialProviderError('provider_unavailable', true);
            }
            return out;
          },
        }
      : provider;
    result = await new CredentialMaintenance(pool, cleanup, {
      neverAssociatedMayDestroy: async () => input.dependency !== 'unknown',
    }).run('cleanup', row.installation_id, [row.id]);
  } else if (['requeue', 'cleanup-retry'].includes(input.action))
    result = await new CredentialMaintenance(pool).run(
      input.action,
      row.installation_id,
      [row.id],
    );
  else if (input.action === 'acl' || input.action === 'acl-cleanup') {
    const p = location(binding(row)),
      foreign = location({ ...binding(row), installationId: randomUUID() });
    const statuses = [
      (await raw(`myims-endpoint/data/${foreign}`)).status,
      (
        await raw('sys/policies/acl/endpoint-forbidden', {
          policy: 'path "*" {capabilities=["read"]}',
        })
      ).status,
      (await raw(`myims-endpoint/metadata/${p}`, undefined, 'DELETE')).status,
      (await raw('sys/generate-root/attempt')).status === 405 ? 403 : 0,
    ];
    if (input.action === 'acl')
      statuses.push(
        (await raw(`myims-endpoint/destroy/${p}`, { versions: [1] })).status,
        (
          await raw(`myims-endpoint/data/${p}`, {
            options: { cas: 1 },
            data: {
              ...binding(row),
              password: randomBytes(32).toString('hex'),
            },
          })
        ).status,
      );
    else
      statuses.push(
        (
          await raw(`myims-endpoint/data/${p}`, {
            options: { cas: 0 },
            data: {
              ...binding(row),
              password: randomBytes(32).toString('hex'),
            },
          })
        ).status,
      );
    const self = await raw('auth/token/lookup-self');
    await provider.renew();
    result = {
      denied: statuses.every((s) => s === 403),
      denials: statuses.length,
      renewed: true,
      ttlBound: self.value.data.ttl <= 3600,
      maxTtl: self.value.data.explicit_max_ttl,
    };
  } else if (input.action === 'scan') {
    const rows = (
      await pool.query(
        'SELECT * FROM public.endpoint_credential_operations WHERE installation_id=$1',
        [row.installation_id],
      )
    ).rows;
    const passwords = [];
    for (const r of rows) {
      const secret = await raw(
        `myims-endpoint/data/${location(binding(r))}?version=1`,
      );
      if (secret.status === 200)
        passwords.push(secret.value.data.data.password);
    }
    const persisted = (
      await pool.query(
        'SELECT row_to_json(o) AS data FROM public.endpoint_credential_operations o UNION ALL SELECT row_to_json(e) FROM public.extensions e UNION ALL SELECT row_to_json(p) FROM public.endpoint_profile_versions p UNION ALL SELECT row_to_json(w) FROM public.outbox_work w UNION ALL SELECT row_to_json(a) FROM public.audit_events a UNION ALL SELECT row_to_json(j) FROM pgboss.job j UNION ALL SELECT row_to_json(r) FROM public.work_results r UNION ALL SELECT row_to_json(r) FROM public.work_receipts r UNION ALL SELECT row_to_json(r) FROM public.inventory_receipts r',
      )
    ).rows;
    const all =
      JSON.stringify(persisted) +
      (input.capturedLogs ?? '') +
      (input.httpOutput ?? '') +
      readFileSync('/provider-audit/endpoint.json', 'utf8');
    result = {
      scanned: passwords.length,
      materialExcluded: passwords.every(
        (p) =>
          typeof p === 'string' && /^[a-f0-9]{64}$/.test(p) && !all.includes(p),
      ),
      unique: new Set(passwords).size === passwords.length,
    };
  } else throw new Error('Invalid fixture action');
  console.log(JSON.stringify({ fixture: 'endpoint-credential', result }));
} catch {
  console.log(
    JSON.stringify({
      fixture: 'endpoint-credential',
      result: { failed: true },
    }),
  );
} finally {
  await Promise.all([
    pool.end(),
    database.close(),
    inventory.onApplicationShutdown(),
  ]);
  await proxy?.close();
}
