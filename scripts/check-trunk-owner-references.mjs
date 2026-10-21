// Only launched by check-trunk-owner-foundation.py inside its fresh isolated DB
// network namespace. No inherited runtime environment or retained service mounts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const fixtureDatabase = process.env.TRUNK_OWNER_FIXTURE_DATABASE;
assert.match(fixtureDatabase ?? '', /^myims_trunk_fixture_[0-9a-f]{32}$/);
const backend = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/db/trunk-owner-references.js',
);
const { TrunkOwnerReferences } = backend('./trunk-owner-references.js');
const { SnapshotDatabase } = backend(
  '../../../../infrastructure/database/read-snapshot.js',
);
const scope = {
  nodeId: '00000000-0000-4000-8000-000000000101',
  installationId: '00000000-0000-4000-8000-000000000201',
  bindingId: '00000000-0000-4000-8000-000000000401',
  generationId: '00000000-0000-4000-8000-000000000501',
};
const missing = '00000000-0000-4000-8000-000000000999';
const store = new TrunkOwnerReferences();
const database = new SnapshotDatabase(
  `postgresql://myims_runtime@127.0.0.1:5432/${fixtureDatabase}`,
);
const checks = [];
try {
  let completedSnapshot;
  const reference = await database.read(async (snapshot) => {
    completedSnapshot = snapshot;
    assert.equal(
      (await snapshot.query('SELECT current_user AS identity')).rows[0]
        .identity,
      'myims_runtime',
    );
    return store.exactReference(snapshot, scope);
  });
  assert.deepEqual(reference, {
    ...scope,
    peerId: '00000000-0000-4000-8000-000000000301',
    purposes: ['outbound-request'],
    ownerRevision: 1,
    generationOrdinal: 1,
    materialVersion: 1,
    operationId: '00000000-0000-4000-8000-000000000601',
    reservationState: 'cancelled',
  });
  checks.push('actual_runtime_adapter_returns_exact_terminal_reference');
  for (const field of Object.keys(scope)) {
    assert.equal(
      await database.read((snapshot) =>
        store.exactReference(snapshot, { ...scope, [field]: missing }),
      ),
      null,
    );
  }
  checks.push('wrong_node_installation_binding_generation_return_absent');
  await assert.rejects(
    () => store.exactReference(completedSnapshot, scope),
    /Read snapshot is no longer active/,
  );
  await assert.rejects(
    () =>
      database.read((snapshot) =>
        snapshot.query('SELECT * FROM public.trunk_credential_generations'),
      ),
    { code: '42501' },
  );
  assert.deepEqual(
    await database.read((snapshot) => store.exactReference(snapshot, scope)),
    reference,
  );
  checks.push('expired_snapshot_and_base_table_denied_pool_recovers');

  // Driver/view drift checks complement SQL; they do not prove database grants.
  const readRows = (rows) => ({ query: async () => ({ rows }) });
  const sentinel = 'synthetic-secret-must-not-leave-reference';
  const projected = await store.exactReference(
    readRows([{ ...reference, unexpected: sentinel }]),
    scope,
  );
  assert.deepEqual(projected, reference);
  assert.ok(!JSON.stringify(projected).includes(sentinel));
  projected.purposes.push('registration');
  assert.deepEqual(reference.purposes, ['outbound-request']);
  for (const bad of [
    { ...reference, nodeId: missing },
    { ...reference, installationId: missing },
    { ...reference, bindingId: missing },
    { ...reference, generationId: missing },
    { ...reference, peerId: sentinel },
    { ...reference, operationId: null },
    { ...reference, ownerRevision: '1' },
    { ...reference, generationOrdinal: 0 },
    { ...reference, generationOrdinal: Number.MAX_SAFE_INTEGER + 1 },
    { ...reference, materialVersion: 2 },
    { ...reference, purposes: [] },
    { ...reference, purposes: ['registration', 'outbound-request'] },
    { ...reference, purposes: ['outbound-request', 'outbound-request'] },
    { ...reference, reservationState: 'qualified' },
  ]) {
    await assert.rejects(
      () => store.exactReference(readRows([bad]), scope),
      /^Error: Invalid trunk owner reference$/,
    );
  }
  await assert.rejects(
    () => store.exactReference(readRows([reference, reference]), scope),
    /^Error: Invalid trunk owner reference$/,
  );
  const unavailable = new Error('synthetic database interruption');
  await assert.rejects(
    () =>
      store.exactReference(
        {
          query: async () => {
            throw unavailable;
          },
        },
        scope,
      ),
    (error) => error === unavailable,
  );
  checks.push(
    'malformed_ambiguous_scope_mismatched_rows_rejected_safe_projection',
  );
  console.log(JSON.stringify({ checks, status: 'passed' }));
} catch (error) {
  // Only bounded codes/stage counts leave this isolated runner, never SQL rows.
  const code = error?.code ?? error?.name ?? 'unknown';
  console.error(`TRUNK_ADAPTER_FAILURE_${code}_${checks.length}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
