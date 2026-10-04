import assert from 'node:assert/strict';
import { once } from 'node:events';

export async function verifyProcessRecovery({
  pool,
  pending,
  exhausted,
  insert,
  state,
  worker,
  barrier,
  kill,
  terminal,
}) {
  async function attribution(id) {
    return (
      await pool.query(
        `SELECT a.actor_reference,a.actor_kind,a.actor_tenant_id,a.tenant_id,a.correlation_id,a.metadata,a.recorded_at
         FROM public.audit_events a JOIN public.outbox_work w
         ON a.target_reference=w.target_reference WHERE w.id=$1`,
        [id],
      )
    ).rows;
  }
  async function snapshot(scenario, id) {
    const result = await state(id);
    console.log(
      JSON.stringify({
        scenario,
        workId: id,
        ...result,
        attribution: await attribution(id),
      }),
    );
    return result;
  }
  const retainedSuccess = await state(pending);
  const retainedFailure = await state(exhausted);
  const retainedAudit = await attribution(pending);
  const retainedFailureAudit = await attribution(exhausted);
  console.log(
    JSON.stringify({
      scenario: 'terminal-before-restart',
      succeeded: retainedSuccess,
      exhausted: retainedFailure,
      attribution: {
        succeeded: retainedAudit,
        exhausted: retainedFailureAudit,
      },
    }),
  );
  const activeId = await insert();
  const active = worker('before_sink', activeId);
  await barrier(active, 'before_sink');
  const originalAudit = await attribution(activeId);
  assert.equal((await snapshot('active-before-kill', activeId)).effects, 0);
  await kill(active);
  const restarted = worker();
  await barrier(restarted, 'ready');
  assert.ok((await terminal(activeId)).attempts >= 2);
  await snapshot('active-after-restart', activeId);
  assert.deepEqual(await attribution(activeId), originalAudit);
  assert.deepEqual(await state(pending), retainedSuccess);
  assert.deepEqual(await state(exhausted), retainedFailure);
  assert.deepEqual(await attribution(pending), retainedAudit);
  assert.deepEqual(await attribution(exhausted), retainedFailureAudit);
  console.log(
    JSON.stringify({
      scenario: 'terminal-after-restart',
      succeeded: await state(pending),
      exhausted: await state(exhausted),
      attribution: {
        succeeded: await attribution(pending),
        exhausted: await attribution(exhausted),
      },
    }),
  );
  await kill(restarted, 'SIGTERM');
  console.log(
    'PASS: active handler SIGKILL/restart recovers from shared state; completed and exhausted outcomes/audit survive restart',
  );

  const drainId = await insert();
  const draining = worker('before_sink', drainId);
  await barrier(draining, 'before_sink');
  const drainExit = once(draining, 'exit');
  const drainStart = Date.now();
  draining.kill('SIGTERM');
  await barrier(draining, 'stopping');
  const afterStop = await insert();
  draining.send({ release: true });
  const [drainCode, drainSignal] = await drainExit;
  const drainElapsed = Date.now() - drainStart;
  assert.equal(drainCode, 0);
  assert.equal(drainSignal, null);
  assert.ok(drainElapsed < 7500);
  await terminal(drainId);
  assert.equal((await state(afterStop)).handoff_status, 'pending');
  assert.equal((await state(afterStop)).effects, 0);
  assert.match(draining.captured, /"state":"stopped"/);
  console.log(
    JSON.stringify({
      scenario: 'graceful-drain',
      exitCode: drainCode,
      elapsedMs: drainElapsed,
      newWork: await state(afterStop),
    }),
  );

  const stalledId = await insert();
  const stalled = worker('before_sink', stalledId);
  await barrier(stalled, 'before_sink');
  const stalledExit = once(stalled, 'exit');
  const stalledStart = Date.now();
  stalled.kill('SIGTERM');
  await barrier(stalled, 'stopping');
  const [stalledCode, stalledSignal] = await stalledExit;
  const stalledElapsed = Date.now() - stalledStart;
  assert.equal(stalledCode, 1);
  assert.equal(stalledSignal, null);
  assert.ok(stalledElapsed < 8500);
  assert.equal(stalled.errors, '');
  assert.match(stalled.captured, /"failureCode":"shutdown_timeout"/);
  assert.ok(
    stalledElapsed >= 6500,
    `Shutdown exited early after ${stalledElapsed}ms: ${stalled.captured}`,
  );
  assert.equal((await state(stalledId)).effects, 0);
  const next = worker();
  await barrier(next, 'ready');
  await terminal(afterStop);
  await terminal(stalledId);
  await kill(next, 'SIGTERM');
  console.log(
    JSON.stringify({
      scenario: 'bounded-drain-deadline',
      exitCode: stalledCode,
      elapsedMs: stalledElapsed,
      recovered: await state(stalledId),
    }),
  );
  console.log(
    'PASS: SIGTERM stops new dispatch, finishes in-flight effect or exits within shared deadline leaving recoverable work',
  );
}

export async function verifyDatabaseRecovery({
  pool,
  insert,
  state,
  worker,
  proxied,
  barrier,
  poll,
  terminal,
  kill,
  disable,
  restore,
}) {
  for (const stage of ['before_enqueue', 'before_sink', 'after_sink']) {
    const id = await insert();
    const fault = worker(stage, id, false, proxied.href);
    try {
      await barrier(fault, stage);
      const before = await state(id);
      const attribution = (
        await pool.query(
          'SELECT actor_reference,correlation_id,metadata FROM public.audit_events WHERE target_reference=(SELECT target_reference FROM public.outbox_work WHERE id=$1)',
          [id],
        )
      ).rows;
      disable();
      fault.send({ release: true });
      await poll(
        async () =>
          fault.captured
            .split('\n')
            .filter(
              (line) =>
                line.includes('"state":"degraded"') &&
                line.includes('"component":"dispatch"'),
            ).length,
        (count) => count >= 3,
      );
      const during = await state(id);
      assert.equal(during.outcome, null);
      assert.equal(during.effects, stage === 'after_sink' ? 1 : 0);
      assert.equal(during.receipts, 0);
      if (stage === 'before_enqueue')
        assert.equal(during.handoff_status, 'pending');
      assert.ok(
        !fault.captured
          .split('\n')
          .some(
            (line) =>
              line.includes(id) &&
              line.includes('"operation":"work.execute"') &&
              line.includes('"outcome":"committed"'),
          ),
      );
      restore();
      const after = await terminal(id);
      assert.deepEqual(
        (
          await pool.query(
            'SELECT actor_reference,correlation_id,metadata FROM public.audit_events WHERE target_reference=(SELECT target_reference FROM public.outbox_work WHERE id=$1)',
            [id],
          )
        ).rows,
        attribution,
      );
      await kill(fault, 'SIGTERM');
      console.log(
        JSON.stringify({
          scenario: `postgres-interruption-${stage}`,
          workId: id,
          before,
          during,
          after,
          attribution,
          exitCode: fault.exitCode,
        }),
      );
    } finally {
      restore();
      await kill(fault);
    }
  }
}
