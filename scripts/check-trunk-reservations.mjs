// Exact disposable database only; actual compiled owner adapter and PostgreSQL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const database = process.env.TRUNK_OWNER_FIXTURE_DATABASE;
assert.match(database ?? '', /^myims_trunk_fixture_[0-9a-f]{32}$/);
const backend = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/db/trunk-reservations.js',
);
const { TrunkReservations } = backend('./trunk-reservations.js');
const { TrunkReservationTransitions } = backend(
  './trunk-reservation-transitions.js',
);
const { Transaction } = backend(
  '../../../../infrastructure/database/transaction.js',
);
const { SafeLogger } = backend(
  '../../../../infrastructure/execution/logging.js',
);
const { AuditRepository } = backend(
  '../../../audit/adapters/db/audit-repository.js',
);
const { Pool } = backend('pg');
const pool = new Pool({
  connectionString: `postgresql://postgres@127.0.0.1:5432/${database}`,
  max: 2,
});
const runtime = new Pool({
  connectionString: `postgresql://myims_runtime@127.0.0.1:5432/${database}`,
  max: 1,
});
const uuid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const request = {
  nodeId: uuid(101),
  installationId: uuid(201),
  peerId: uuid(301),
  bindingId: uuid(401),
  generationId: uuid(503),
  operationId: uuid(603),
  requestId: uuid(703),
  authenticationVersion: 1,
  nodeVersion: 1,
  peerRevision: 1,
  expectedOwnerRevision: 1,
};
const context = (data = request) => ({
  actor: {
    kind: 'platform_operator',
    reference: uuid(1),
    plane: 'platform',
    tenantId: null,
  },
  target: {
    type: 'trunk_credential_operation',
    reference: data.operationId,
    tenantId: null,
  },
  correlationId: 'trunk-reservation-fixture',
});
const logger = new SafeLogger('deployment', () => {});
const adapter = new TrunkReservations(new AuditRepository());
const terminal = new TrunkReservationTransitions(new AuditRepository());
const checks = [];
const tx = (action, data = request, db = pool, ctx = context(data)) =>
  Transaction.run(db, ctx, 'trunk-reservation-fixture', logger, async (t) => {
    if (db === pool) await t.query('SET LOCAL ROLE myims_trunk_owner');
    await t.query("SET LOCAL lock_timeout='3s'");
    return action(t);
  });
const reserve = (data = request, instance = adapter, db = pool) =>
  tx(
    async (t) => {
      await instance.lockIntent(t, data.requestId);
      return instance.reserve(t, data);
    },
    data,
    db,
  );
const count = async (table) =>
  Number(
    (await pool.query(`SELECT count(*) n FROM public.${table}`)).rows[0].n,
  );
try {
  await assert.rejects(() => tx((t) => adapter.reserve(t, request)), {
    code: 'intent_lock_required',
  });
  await assert.rejects(() => reserve(request, adapter, runtime), {
    code: '42501',
  });
  for (const field of ['nodeId', 'installationId', 'peerId', 'bindingId']) {
    await assert.rejects(() => reserve({ ...request, [field]: uuid(999) }), {
      code: 'scope_unavailable',
    });
  }
  for (const field of ['peerRevision', 'expectedOwnerRevision']) {
    await assert.rejects(() => reserve({ ...request, [field]: 2 }), {
      code: 'stale_owner',
    });
  }
  await assert.rejects(
    () => reserve({ ...request, password: 'synthetic-must-not-enter-sql' }),
    { code: 'invalid_request' },
  );
  await assert.rejects(
    () => reserve({ ...request, authenticationVersion: 2147483648 }),
    { code: 'invalid_request' },
  );
  const initial = await count('trunk_credential_generations');
  checks.push(
    'required_intent_lock_exact_scope_versions_no_extra_material_and_runtime_denials',
  );
  const noAudit = new TrunkReservations({
    append: async () => 'synthetic-omitted',
  });
  await assert.rejects(() => reserve(request, noAudit), { code: '23514' });
  assert.equal(await count('trunk_credential_generations'), initial);
  assert.equal(
    (
      await pool.query(
        'SELECT id FROM public.trunk_credential_reservations WHERE id=$1',
        [request.operationId],
      )
    ).rows.length,
    0,
  );
  checks.push('missing_audit_rolls_back_generation_reservation_and_history');
  const concurrent = await Promise.all([reserve(), reserve()]);
  assert.deepEqual(concurrent.map((r) => r.outcome).sort(), [
    'created',
    'replayed',
  ]);
  assert.equal(concurrent[0].generationOrdinal, 3);
  assert.equal(concurrent[1].generationOrdinal, 3);
  assert.equal(await count('trunk_credential_generations'), initial + 1);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM public.audit_events WHERE target_reference=$1 AND event_type='trunk.credential.reserved'",
        [request.operationId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM public.trunk_credential_reservation_history WHERE operation_id=$1 AND state='reserved'",
        [request.operationId],
      )
    ).rows[0].n,
    1,
  );
  checks.push(
    'concurrent_identical_intent_commits_one_generation_receipt_history_and_audit',
  );
  for (const field of [
    'generationId',
    'nodeId',
    'installationId',
    'peerId',
    'bindingId',
    'operationId',
    'authenticationVersion',
    'nodeVersion',
    'peerRevision',
    'expectedOwnerRevision',
  ]) {
    const changed = {
      ...request,
      [field]: typeof request[field] === 'number' ? 2 : uuid(999),
    };
    await assert.rejects(() => reserve(changed), { code: 'request_conflict' });
  }
  const competing = {
    ...request,
    generationId: uuid(504),
    operationId: uuid(604),
    requestId: uuid(704),
  };
  await assert.rejects(() => reserve(competing), {
    code: 'preparation_active',
  });
  checks.push(
    'changed_intent_and_second_active_preparation_rejected_without_effect',
  );
  await tx((t) =>
    terminal.terminal(
      t,
      {
        nodeId: request.nodeId,
        installationId: request.installationId,
        bindingId: request.bindingId,
        generationId: request.generationId,
        operationId: request.operationId,
      },
      'cancelled',
    ),
  );
  const replay = await reserve();
  assert.equal(replay.state, 'cancelled');
  assert.equal(replay.outcome, 'replayed');
  assert.equal(await count('trunk_credential_generations'), initial + 1);
  checks.push(
    'terminal_same_intent_replays_retained_state_without_new_generation',
  );
  const nextA = competing;
  const nextB = {
    ...request,
    generationId: uuid(505),
    operationId: uuid(605),
    requestId: uuid(705),
  };
  const race = await Promise.allSettled([reserve(nextA), reserve(nextB)]);
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
  const denied = race.find((r) => r.status === 'rejected');
  assert.equal(denied.reason.code, 'preparation_active');
  const winner = race.find((r) => r.status === 'fulfilled').value;
  assert.equal(winner.generationOrdinal, 4);
  assert.equal(await count('trunk_credential_generations'), initial + 2);
  checks.push(
    'distinct_concurrent_intents_serialize_binding_allocate_monotonic_ordinal_and_one_active',
  );
  const winnerData = winner.operationId === nextA.operationId ? nextA : nextB;
  await tx(
    (t) =>
      terminal.terminal(
        t,
        {
          nodeId: winnerData.nodeId,
          installationId: winnerData.installationId,
          bindingId: winnerData.bindingId,
          generationId: winnerData.generationId,
          operationId: winnerData.operationId,
        },
        'cancelled',
      ),
    winnerData,
  );
  const mutable = {
    ...request,
    generationId: uuid(506),
    operationId: uuid(606),
    requestId: uuid(706),
  };
  const changingCaller = new TrunkReservations({
    append: async (t, contract, metadata) => {
      const id = await new AuditRepository().append(t, contract, metadata);
      mutable.bindingId = uuid(999);
      mutable.generationId = uuid(999);
      return id;
    },
  });
  const captured = await reserve(mutable, changingCaller);
  assert.equal(captured.bindingId, request.bindingId);
  assert.equal(captured.generationId, uuid(506));
  assert.equal(captured.generationOrdinal, 5);
  checks.push(
    'caller_mutation_during_audit_cannot_change_committed_scope_or_receipt',
  );
  console.log(
    JSON.stringify({
      status: 'passed',
      checks,
      businessAuthorityAdmissionExercised: false,
      providerAccess: false,
    }),
  );
} catch (error) {
  console.error(
    `TRUNK_ADAPTER_FAILURE_${error?.code ?? error?.name ?? 'unknown'}_${checks.length}`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
  await runtime.end();
}
