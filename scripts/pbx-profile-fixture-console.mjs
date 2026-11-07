// Actual console application/authority, confined to an owned copied database.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const [database, nodeId, action, target] = process.argv.slice(2);
if (
  !/^myims_session_[a-f0-9]{12}$/.test(database ?? '') ||
  !/^[a-f0-9-]{36}$/.test(nodeId ?? '')
)
  throw new Error('Owned console fixture required');
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/' + database;
url.password = readFileSync(process.env.DATABASE_PASSWORD_FILE, 'utf8').trim();
const { Pool } = load('pg');
const pool = new Pool({ connectionString: url.href, max: 2 });
const { SnapshotDatabase } = load(
  './dist/infrastructure/database/read-snapshot.js',
);
const { TransactionAuthority } = load(
  './dist/modules/identity/application/transaction-authority.js',
);
const { PlatformAuthorityRepository } = load(
  './dist/modules/platform/adapters/db/authority-read.js',
);
const { InventoryRuntime } = load(
  './dist/modules/telephony/adapters/db/inventory-runtime.js',
);
const snapshot = new SnapshotDatabase(url.href);
const runtime = new InventoryRuntime(
  url.href,
  new TransactionAuthority(
    {
      lockedById: async () => {
        throw new Error('Unexpected tenant authority');
      },
    },
    new PlatformAuthorityRepository(snapshot),
  ),
);
try {
  const operator = (
    await pool.query(
      "SELECT id,authentication_version FROM public.platform_operators WHERE status='active' AND credential_state='ready' ORDER BY id LIMIT 1",
    )
  ).rows[0];
  if (!operator) throw new Error('Copied authority unavailable');
  const principal = {
    plane: 'platform',
    operatorId: operator.id,
    authenticationVersion: operator.authentication_version,
    grants: ['platform_operator'],
  };
  const current = (
    await pool.query(
      'SELECT verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
      [nodeId],
    )
  ).rows[0].verified_id;
  let results;
  if (action === 'recover')
    results = [
      await runtime.live.accept(
        principal,
        nodeId,
        'recover',
        {
          requestId: randomUUID(),
          expectedBaselineId: current,
          targetId: target,
        },
        randomUUID(),
      ),
    ];
  else if (action === 'races') {
    const revision = (
      await pool.query(
        'SELECT revision_id FROM public.pbx_live_artifacts WHERE id=$1',
        [current],
      )
    ).rows[0].revision_id;
    const before = (
      await pool.query(
        'SELECT (SELECT count(*) FROM public.pbx_live_operations)::text AS live,(SELECT count(*) FROM public.pbx_artifact_retirement_intents)::text AS retire',
      )
    ).rows[0];
    results = await Promise.all([
      runtime.live.accept(
        principal,
        nodeId,
        'apply',
        {
          requestId: randomUUID(),
          expectedBaselineId: current,
          revisionId: revision,
        },
        randomUUID(),
      ),
      runtime.live.accept(
        principal,
        nodeId,
        'recover',
        {
          requestId: randomUUID(),
          expectedBaselineId: current,
          targetId: current,
        },
        randomUUID(),
      ),
      runtime.live.accept(
        principal,
        nodeId,
        'reconcile',
        {
          requestId: randomUUID(),
          expectedBaselineId: current,
          targetId: current,
        },
        randomUUID(),
      ),
      runtime.retirement.write(
        principal,
        nodeId,
        {
          requestId: randomUUID(),
          artifactId: current,
          replacementId: target,
          resourceId: randomUUID(),
        },
        randomUUID(),
      ),
    ]);
    if (results.some((r) => r.status !== 409))
      throw new Error('Competing console effect was accepted');
    if (
      results.slice(0, 3).some((r) => r.value.reason !== 'operation_unresolved')
    )
      throw new Error('Console did not reach the shared profile barrier');
    // The same runtime constraint fences retirement/revision writers even if an
    // alternate caller omits the application predicate. BEFORE UPDATE rejects
    // these changes before their deliberately uncommitted target FKs are checked.
    for (const column of ['active_operation_id', 'active_retirement_id']) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let rejected = false;
        try {
          await client.query(
            `UPDATE public.pbx_live_runtime SET ${column}=$2 WHERE node_id=$1`,
            [nodeId, randomUUID()],
          );
        } catch (error) {
          if (error.code !== '23514') throw error;
          rejected = true;
        }
        if (!rejected)
          throw new Error(
            'Canonical profile constraint did not fence competing writer',
          );
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    }
    const after = (
      await pool.query(
        'SELECT (SELECT count(*) FROM public.pbx_live_operations)::text AS live,(SELECT count(*) FROM public.pbx_artifact_retirement_intents)::text AS retire',
      )
    ).rows[0];
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Rejected console intent committed');
    const projection = await runtime.live.read(
      principal,
      nodeId,
      null,
      null,
      {},
    );
    if (projection.status !== 200 || projection.value.available !== false)
      throw new Error('Console pending profile projection is untruthful');
  } else throw new Error('Unknown console fixture action');
  console.log(
    JSON.stringify({
      action,
      results: results.map((r) => ({
        status: r.status,
        reason: r.value.reason ?? null,
        operationId: r.value.operation?.id ?? null,
      })),
    }),
  );
} finally {
  await runtime.onApplicationShutdown();
  await snapshot.close();
  await pool.end();
}
