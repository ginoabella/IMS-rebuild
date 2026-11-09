// Actual ordinary PostgreSQL reads only; no fixture credentials or SIP traffic.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import {
  inspectPreparation,
  inspectionTarget,
} from './tenant-call-preparation-inspect.mjs';

test('inspection rejects missing, excessive and injected target input before connecting', () => {
  const id = '00000000-0000-0000-0000-000000000001';
  for (const args of [
    [],
    [id],
    [id, id, id],
    [id, id + '\n'],
    [id, "'; UPDATE public.pbx_nodes SET version=2; --"],
  ])
    assert.throws(() => inspectionTarget(args));
  assert.deepEqual(inspectionTarget([id, id]), {
    nodeId: id,
    installationId: id,
  });
});

test('actual primary inspection enforces read-only transactions and wrong-target isolation', async () => {
  const load = createRequire(
    new URL('../services/backend/package.json', import.meta.url),
  );
  const { Client } = load('pg');
  const { loadMigrationConfig } = load(
    './dist/infrastructure/configuration.js',
  );
  const client = new Client({
    connectionString: loadMigrationConfig().runtimeUrl,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
  client.on('error', () => {});
  await client.connect();
  try {
    const target = (
      await client.query(
        'SELECT id AS "nodeId",installation_id AS "installationId" FROM public.pbx_nodes ORDER BY id LIMIT 1',
      )
    ).rows[0];
    assert.ok(target, 'requires an existing canonical node');
    let readonlySnapshots = 0;
    const guarded = {
      async query(sql, params) {
        const result = await client.query(sql, params);
        if (sql.startsWith('BEGIN')) {
          assert.equal(
            (await client.query('SHOW transaction_read_only')).rows[0]
              .transaction_read_only,
            'on',
          );
          readonlySnapshots++;
        }
        return result;
      },
    };
    const observed = await inspectPreparation(guarded, target);
    assert.equal(observed.effectAuthorization, false);
    assert.equal(observed.materialVerified, false);
    assert.equal(observed.dispatchAvailability, 'unestablished');
    assert.ok(!observed.blockers.includes('wrong_target'));
    assert.ok(
      observed.extensions.every((e) =>
        Object.keys(e).every(
          (k) => !['password', 'material', 'token', 'settings'].includes(k),
        ),
      ),
    );
    const second = await inspectPreparation(guarded, target);
    // Reads preserve canonical cases and evidence timestamps exactly.
    assert.deepEqual(second.cases, observed.cases);
    assert.deepEqual(second.extensions, observed.extensions);
    const wrong = await inspectPreparation(guarded, {
      ...target,
      installationId: '00000000-0000-0000-0000-000000000000',
    });
    assert.deepEqual(wrong.blockers, ['wrong_target']);
    assert.equal(wrong.tenants, undefined);
    assert.equal(wrong.extensions, undefined);
    assert.equal(readonlySnapshots, 3);
    // PostgreSQL itself rejects even a zero-row write under the chosen mode.
    await client.query('BEGIN READ ONLY');
    await assert.rejects(
      client.query(
        'UPDATE public.tenant_route_test_cases SET enabled=enabled WHERE false',
      ),
      { code: '25006' },
    );
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
});
