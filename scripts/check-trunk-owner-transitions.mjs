// Only invoked inside the exact fresh PostgreSQL namespace by the owner harness.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const name = process.env.TRUNK_OWNER_FIXTURE_DATABASE;
assert.match(name ?? '', /^myims_trunk_fixture_[0-9a-f]{32}$/);
const backend = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/db/trunk-reservation-transitions.js',
);
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
  connectionString: `postgresql://postgres@127.0.0.1:5432/${name}`,
  max: 2,
});
const runtime = new Pool({
  connectionString: `postgresql://myims_runtime@127.0.0.1:5432/${name}`,
  max: 1,
});
const scope = {
  nodeId: '00000000-0000-4000-8000-000000000101',
  installationId: '00000000-0000-4000-8000-000000000201',
  bindingId: '00000000-0000-4000-8000-000000000401',
  generationId: '00000000-0000-4000-8000-000000000502',
  operationId: '00000000-0000-4000-8000-000000000602',
};
const context = {
  actor: {
    kind: 'platform_operator',
    reference: '00000000-0000-4000-8000-000000000001',
    plane: 'platform',
    tenantId: null,
  },
  target: {
    type: 'trunk_credential_operation',
    reference: scope.operationId,
    tenantId: null,
  },
  correlationId: 'trunk-fixture-transition',
};
const logger = new SafeLogger('deployment', () => {});
const adapter = new TrunkReservationTransitions(new AuditRepository());
const checks = [];
const tx = (action, ctx = context, db = pool) =>
  Transaction.run(db, ctx, 'trunk-transition-fixture', logger, async (t) => {
    if (db === pool) await t.query('SET LOCAL ROLE myims_trunk_owner');
    await t.query("SET LOCAL lock_timeout='2s'");
    return action(t);
  });
try {
  await tx(async (t) => {
    await t.query(
      `INSERT INTO public.trunk_credential_generations(id,binding_id,node_id,installation_id,peer_id,ordinal,operation_id) VALUES($1,$2,$3,$4,'00000000-0000-4000-8000-000000000301',2,$5)`,
      [
        scope.generationId,
        scope.bindingId,
        scope.nodeId,
        scope.installationId,
        scope.operationId,
      ],
    );
    await t.query(
      `INSERT INTO public.trunk_credential_reservations(id,binding_id,generation_id,request_id,operator_id,authentication_version,node_version,peer_revision,expected_owner_revision,correlation_id) VALUES($1,$2,$3,'00000000-0000-4000-8000-000000000702',$4,1,1,1,1,$5)`,
      [
        scope.operationId,
        scope.bindingId,
        scope.generationId,
        context.actor.reference,
        context.correlationId,
      ],
    );
    await t.query(
      "INSERT INTO public.trunk_credential_reservation_history(operation_id,state) VALUES($1,'reserved')",
      [scope.operationId],
    );
    await new AuditRepository().append(
      t,
      {
        type: 'trunk.credential.reserved',
        version: 1,
        fields: { bindingId: { kind: 'uuid' }, generationId: { kind: 'uuid' } },
      },
      { bindingId: scope.bindingId, generationId: scope.generationId },
    );
  });
  // Real deferred DB gate catches an accidentally omitted audit implementation.
  const missingAudit = new TrunkReservationTransitions({
    append: async () => 'synthetic-no-write',
  });
  await assert.rejects(
    () => tx((t) => missingAudit.terminal(t, scope, 'cancelled')),
    { code: '23514' },
  );
  assert.equal(
    (
      await pool.query(
        'SELECT state FROM public.trunk_credential_reservations WHERE id=$1',
        [scope.operationId],
      )
    ).rows[0].state,
    'reserved',
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM public.trunk_credential_reservation_history WHERE operation_id=$1 AND state='cancelled'",
        [scope.operationId],
      )
    ).rows[0].n,
    0,
  );
  checks.push(
    'actual_adapter_missing_audit_rolls_back_transition_and_history_at_commit',
  );
  const wrong = '00000000-0000-4000-8000-000000000999';
  for (const field of ['nodeId', 'installationId', 'bindingId', 'generationId'])
    assert.equal(
      await tx((t) =>
        adapter.terminal(t, { ...scope, [field]: wrong }, 'cancelled'),
      ),
      null,
    );
  assert.equal(
    await tx((t) => adapter.terminal(t, scope, 'cancelled'), {
      ...context,
      actor: { ...context.actor, reference: wrong },
    }),
    null,
  );
  assert.equal(
    await tx((t) => adapter.terminal(t, scope, 'cancelled'), {
      ...context,
      correlationId: 'wrong-correlation',
    }),
    null,
  );
  await assert.rejects(() =>
    tx((t) => adapter.terminal(t, scope, 'cancelled'), {
      ...context,
      target: { ...context.target, reference: wrong },
    }),
  );
  await assert.rejects(
    () => tx((t) => adapter.terminal(t, scope, 'cancelled'), context, runtime),
    { code: '42501' },
  );
  checks.push('exact_scope_actor_context_and_runtime_grants_deny_transition');
  assert.deepEqual(
    await Promise.all([
      tx((t) => adapter.terminal(t, scope, 'cancelled')),
      tx((t) => adapter.terminal(t, scope, 'cancelled')),
    ]).then((v) => v.sort()),
    ['changed', 'replayed'],
  );
  assert.equal(
    await tx((t) => adapter.terminal(t, scope, 'cancelled')),
    'replayed',
  );
  await assert.rejects(
    () => tx((t) => adapter.terminal(t, scope, 'failed')),
    /Terminal trunk reservation conflict/,
  );
  const evidence = await pool.query(
    "SELECT (SELECT count(*)::int FROM public.trunk_credential_reservation_history WHERE operation_id=$1 AND state='cancelled') AS history,(SELECT count(*)::int FROM public.audit_events WHERE target_reference=$1::text AND event_type='trunk.credential.cancelled') AS audit",
    [scope.operationId],
  );
  assert.deepEqual(evidence.rows[0], { history: 1, audit: 1 });
  assert.equal(
    (
      await pool.query(
        'SELECT state FROM public.trunk_credential_reservations WHERE id=$1',
        [scope.operationId],
      )
    ).rows[0].state,
    'cancelled',
  );
  checks.push(
    'two_concurrent_adapter_calls_change_once_replay_without_duplicate_audit_terminal_conflict_denied',
  );
  console.log(JSON.stringify({ status: 'passed', checks }));
} catch (error) {
  console.error(
    `TRUNK_ADAPTER_FAILURE_${error?.code ?? error?.name ?? 'unknown'}_${checks.length}`,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
  await runtime.end();
}
