import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
export async function checkEndpointCredentials({
  processDiagnostics = () => '',
  replica,
  proxy,
  commitProxy,
  key,
  sessions,
  patch,
  apiOnly,
  otherNode,
  issue,
  redis,
  owner,
  runtime,
  appUrl,
  node,
  a,
  b,
  s,
  other,
  post,
  get,
  request,
  operator,
  output,
  secrets,
}) {
  const database = new URL(appUrl).pathname.slice(1);
  const directory = '/tmp/myims-endpoint-responses';
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const responses = [];
  async function remote(operationId, action = 'execute', extra = {}) {
    const controlId = randomUUID();
    const file = `${directory}/${controlId}.json`;
    responses.push(file);
    console.log(
      `ENDPOINT_FIXTURE_REQUEST ${JSON.stringify({ database, operationId, action, controlId, ...extra })}`,
    );
    for (let i = 0; i < 1200; i++) {
      try {
        const result = JSON.parse(await readFile(file, 'utf8'));
        await rm(file);
        return result;
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      await delay(50);
    }
    throw new Error('Endpoint isolated worker deadline');
  }
  const suffix = (e) => `extensions/${e.id}/credentials`;
  const opSuffix = (e, id) => `extensions/${e.id}/credential-operations/${id}`;
  const intent = (e, g = null) => ({
    operationId: randomUUID(),
    expectedVersion: e.version,
    expectedGenerationId: g,
  });
  const accept = (replica, session, e, action, body) =>
    post(replica, session, node, `${suffix(e)}/${action}`, body);
  const row = async (id) =>
    (
      await runtime.query(
        'SELECT * FROM public.endpoint_credential_operations WHERE id=$1',
        [id],
      )
    ).rows[0];
  const auditCount = async (id) =>
    (
      await runtime.query(
        "SELECT count(*)::int AS n FROM public.audit_events WHERE event_type='endpoint.credential.associated' AND target_reference=$1",
        [id],
      )
    ).rows[0].n;
  try {
    // Format declarations are explicitly deployment-owned, not inferred from AMI.
    await owner.query(
      'UPDATE public.endpoint_capabilities SET revision=revision+1,credential_auth_max=71,credential_hex_max=64 WHERE installation_id=$1',
      [node.installationId],
    );
    // The inventory fixture finishes at revision 3; retain that dependency for creates.
    const cap = (
      await owner.query(
        'SELECT revision FROM public.endpoint_capabilities WHERE installation_id=$1',
        [node.installationId],
      )
    ).rows[0];
    const e = (
      await runtime.query(
        'SELECT id,version FROM public.extensions WHERE node_id=$1 ORDER BY id LIMIT 1',
        [node.id],
      )
    ).rows[0];
    let initial = await get(a, s, node, suffix(e));
    assert.equal(initial.status, 200);
    assert.equal(initial.data.credential.kind, 'unset');
    const body = intent(e);
    const pair = await Promise.all([
      accept(a, s, e, 'setup', body),
      accept(b, s, e, 'setup', body),
    ]);
    assert.ok(pair.every((r) => r.status === 202));
    assert.deepEqual(pair[0].data, pair[1].data);
    const op = pair[0].data.operationId;
    assert.equal(
      (
        await accept(b, s, e, 'setup', {
          ...body,
          expectedVersion: e.version + 1,
        })
      ).data.reason,
      'request_conflict',
    );
    assert.equal(
      (await accept(b, s, e, 'setup', intent(e))).data.reason,
      'credential_operation_pending',
    );
    assert.equal((await get(b, other, node, opSuffix(e, op))).status, 404);
    if (apiOnly) {
      for (const c of [a, b]) {
        for (const extra of [
          { password: 'ENDPOINT_MATERIAL_SENTINEL' },
          { providerPath: 'untrusted' },
          { operatorId: randomUUID() },
        ])
          assert.equal(
            (await accept(c, s, e, 'setup', { ...body, ...extra })).status,
            400,
          );
        assert.equal(
          (await request(c, `/platform/pbx-nodes/${node.id}/${suffix(e)}`))
            .status,
          401,
        );
        for (const headers of [
          { origin: 'https://evil.invalid' },
          { 'x-platform-csrf': 'bad' },
          { 'x-platform-proxy': 'bad' },
        ])
          assert.equal(
            (await post(c, s, node, `${suffix(e)}/setup`, body, { headers }))
              .status,
            403,
          );
        assert.equal(
          (await get(c, s, node, suffix(e))).headers['cache-control'],
          'no-store',
        );
        const staff = (
          await owner.query(
            'SELECT id,tenant_id,authentication_version FROM public.staff_users LIMIT 1',
          )
        ).rows[0];
        const session = await issue(c, {
          plane: 'tenant',
          identityId: staff.id,
          tenantId: staff.tenant_id,
          authenticationVersion: staff.authentication_version,
          tenantAuthorityVersion: 1,
        });
        try {
          assert.equal((await get(c, session, node, suffix(e))).status, 403);
        } finally {
          const { createHash } = await import('node:crypto');
          await redis.del(
            `myims:session:v1:${createHash('sha256').update(session.token).digest('hex')}`,
          );
        }
      }
      assert.equal(
        (await get(a, s, node, suffix(e))).data.credential.kind,
        'unset',
      );
      assert.equal(await auditCount(op), 0);
      assert.equal((await row(op)).state, 'queued');
      // Named consumer-port fixture proves real queue selection, without
      // claiming provider integration or finalizing desired credentials.
      const require = createRequire(
        new URL('../services/backend/package.json', import.meta.url),
      );
      const {
        DeliveryWorker,
      } = require('./dist/infrastructure/worker/delivery.js');
      const { parseWorkerConfig } = require('@myims/config');
      await owner.query(
        'UPDATE public.endpoint_capabilities SET revision=revision+1,credential_auth_max=71,credential_hex_max=64 WHERE installation_id=$1',
        [otherNode.installationId],
      );
      const foreign = (
        await runtime.query(
          'SELECT id,version FROM public.extensions WHERE node_id=$1 ORDER BY id LIMIT 1',
          [otherNode.id],
        )
      ).rows[0];
      assert.ok(foreign, 'Second installation inventory fixture required');
      const foreignAccepted = await post(
        a,
        s,
        otherNode,
        `extensions/${foreign.id}/credentials/setup`,
        intent(foreign),
      );
      assert.equal(foreignAccepted.status, 202);
      const foreignOp = foreignAccepted.data.operationId;
      const selectedA = [],
        selectedB = [];
      const settings = parseWorkerConfig({
        WORKER_POLL_MS: '100',
        WORKER_CONCURRENCY: '2',
      });
      const consumer = (installationId, selected) => ({
        installationId,
        execute: async (id) => {
          selected.push(id);
        },
        reconcileExhausted: async () => {},
      });
      const ordinary = new DeliveryWorker(appUrl, settings),
        selectedWorkerA = new DeliveryWorker(
          appUrl,
          settings,
          {},
          consumer(node.installationId, selectedA),
        ),
        selectedWorkerB = new DeliveryWorker(
          appUrl,
          settings,
          {},
          consumer(otherNode.installationId, selectedB),
        );
      async function selected(list) {
        for (let i = 0; i < 240; i++) {
          if (list.length) return;
          await delay(25);
        }
        throw new Error('Queue consumer selection deadline');
      }
      try {
        await ordinary.start();
        await selectedWorkerA.start();
        await selected(selectedA);
        assert.deepEqual(selectedA, [op]);
        const pending = (
          await runtime.query(
            "SELECT state,retry_count FROM pgboss.job WHERE data->>'workId'=$1",
            [(await row(foreignOp)).work_id],
          )
        ).rows[0];
        assert.equal(pending.state, 'created');
        assert.equal(pending.retry_count, 0);
        await selectedWorkerB.start();
        await selected(selectedB);
        assert.deepEqual(selectedA, [op]);
        assert.deepEqual(selectedB, [foreignOp]);
        assert.equal(
          (
            await runtime.query(
              "SELECT count(*)::int AS n FROM public.work_results WHERE handler='sample.deliver'",
            )
          ).rows[0].n,
          0,
        );
        assert.equal((await row(op)).state, 'queued');
        assert.equal((await row(foreignOp)).state, 'queued');
        console.log(
          'PASS credential queue selection contract: real pg-boss standard queue, ordinary worker excludes credential intent, installation A/B consumers claim only their canonical installation; injected no-effect consumer port, no provider proof',
        );
      } finally {
        await Promise.all(
          [ordinary, selectedWorkerA, selectedWorkerB].map((w) =>
            w.stop().catch(() => {}),
          ),
        );
      }
      console.log(
        'PASS credential API boundary (partial B-02/03/05/06): real PostgreSQL/Redis/HTTP A/B enqueue, replay/conflict, pending arbitration, staff/forged-channel/CSRF/origin/no-store and no premature configured state; provider execution NOT checked',
      );
      return;
    }
    const queued = await remote(op, 'queue');
    assert.equal(queued.state, 'associated', JSON.stringify(queued));
    assert.equal(await auditCount(op), 1);
    let status = (await get(b, s, node, suffix(e))).data;
    assert.equal(status.credential.kind, 'configured');
    assert.equal(status.credential.materialHealth, 'verified');
    assert.equal(status.desiredVersion, e.version + 1);
    const replay = await accept(a, s, e, 'setup', body);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.operationId, op);
    assert.equal((await remote(op)).state, 'associated');
    assert.equal(await auditCount(op), 1);
    console.log(
      'PASS credentials B-02/03: real OpenBao setup, exact generation, atomic desired version/audit, HTTP A/B replay and active-operation arbitration',
    );
    for (const action of ['acl', 'acl-cleanup']) {
      const acl = await remote(op, action);
      assert.equal(acl.denied, true, JSON.stringify(acl));
      assert.equal(acl.renewed, true);
      assert.equal(acl.ttlBound, true);
      assert.equal(acl.maxTtl, 86400);
    }
    console.log(
      'PASS credentials B-06: real scoped worker/cleanup ACL denials, root-generation protection, bounded renewable token TTL',
    );
    // Reset race from one expected generation/version: exactly one accepted intent.
    const resetE = { ...e, version: status.desiredVersion },
      generation = status.credential.generationId;
    const race = await Promise.all([
      accept(a, s, resetE, 'reset', intent(resetE, generation)),
      accept(b, s, resetE, 'reset', intent(resetE, generation)),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [202, 409]);
    const reset = race.find((r) => r.status === 202).data;
    assert.equal(
      (await remote(reset.operationId, 'execute', { fault: 'lost_provider' }))
        .failed,
      true,
    );
    assert.equal((await row(reset.operationId)).state, 'retrying');
    assert.equal((await remote(reset.operationId)).state, 'associated');
    assert.equal(await auditCount(reset.operationId), 1);
    assert.notEqual(reset.generationId, generation);
    assert.equal((await row(op)).state, 'associated');
    assert.equal(
      (await accept(a, s, resetE, 'reset', intent(resetE, generation))).data
        .reason,
      'stale_version',
    );
    console.log(
      'PASS credentials B-03: reset race, lost real provider acknowledgement, same-key recovery, stale-version fence and retained predecessor',
    );
    // Use separately created extensions for interruption/revocation/permanent faults.
    async function fresh() {
      const p = (
        await runtime.query(
          'SELECT * FROM public.endpoint_profiles WHERE node_id=$1 ORDER BY id LIMIT 1',
          [node.id],
        )
      ).rows[0];
      const n = (
        await runtime.query(
          'SELECT (max(number::int)+1)::text AS n FROM public.extensions WHERE node_id=$1',
          [node.id],
        )
      ).rows[0].n;
      const r = await post(a, s, node, 'extensions', {
        requestId: randomUUID(),
        kind: p.kind,
        number: n,
        profileId: p.id,
        profileVersion: p.head_version,
        expectedProfileHead: p.head_version,
        expectedNodeVersion: 1,
        expectedCapabilityRevision: cap.revision,
      });
      assert.equal(r.status, 201);
      return r.data.extension;
    }
    async function acceptedFresh(session = s) {
      const extension = await fresh(),
        input = intent(extension);
      const accepted = await accept(a, session, extension, 'setup', input);
      assert.equal(accepted.status, 202, JSON.stringify(accepted.data));
      return { extension, input, ...accepted.data };
    }
    async function age(id) {
      await owner.query(
        'ALTER TABLE public.endpoint_credential_operations DISABLE TRIGGER endpoint_credential_protection',
      );
      try {
        await owner.query(
          "UPDATE public.endpoint_credential_operations SET terminal_at=clock_timestamp()-interval '25 hours' WHERE id=$1",
          [id],
        );
      } finally {
        await owner.query(
          'ALTER TABLE public.endpoint_credential_operations ENABLE TRIGGER endpoint_credential_protection',
        );
      }
    }
    const realOutage = await acceptedFresh();
    await remote(realOutage.operationId, 'provider_stop');
    assert.equal(
      (await get(a, s, node, suffix(realOutage.extension))).data.credential
        .kind,
      'unset',
    );
    assert.equal((await remote(realOutage.operationId)).failed, true);
    await remote(realOutage.operationId, 'provider_restart');
    assert.equal((await remote(realOutage.operationId)).failed, true);
    await remote(realOutage.operationId, 'provider_unseal');
    assert.equal((await remote(realOutage.operationId)).state, 'associated');
    const expiredToken = await acceptedFresh();
    assert.equal(
      (
        await remote(expiredToken.operationId, 'execute', {
          tokenExpired: true,
        })
      ).state,
      'failed',
    );
    assert.equal(
      (await get(a, s, node, suffix(expiredToken.extension))).data.credential
        .kind,
      'unset',
    );
    const nextToken = await accept(
      a,
      s,
      expiredToken.extension,
      'setup',
      intent(expiredToken.extension),
    );
    assert.equal(nextToken.status, 202);
    assert.equal(
      (await remote(nextToken.data.operationId)).state,
      'associated',
    );
    const rollback = await acceptedFresh();
    await owner.query(
      `ALTER TABLE public.audit_events ADD CONSTRAINT fixture_credential_audit CHECK (NOT (event_type='endpoint.credential.associated' AND target_reference='${rollback.operationId}')) NOT VALID`,
    );
    try {
      assert.equal((await remote(rollback.operationId)).failed, true);
      assert.equal(
        (await get(a, s, node, suffix(rollback.extension))).data.credential
          .kind,
        'unset',
      );
      assert.equal(await auditCount(rollback.operationId), 0);
    } finally {
      await owner.query(
        'ALTER TABLE public.audit_events DROP CONSTRAINT fixture_credential_audit',
      );
    }
    assert.equal((await remote(rollback.operationId)).state, 'associated');
    const dbLost = await acceptedFresh();
    assert.equal(
      (
        await remote(dbLost.operationId, 'execute', {
          fault: 'database_after_prepare',
        })
      ).failed,
      true,
    );
    assert.equal(
      (await get(a, s, node, suffix(dbLost.extension))).data.credential.kind,
      'unset',
    );
    assert.equal((await remote(dbLost.operationId)).state, 'associated');
    const commitLost = await acceptedFresh();
    assert.equal(
      (
        await remote(commitLost.operationId, 'execute', {
          fault: 'final_commit',
        })
      ).failed,
      true,
    );
    assert.equal((await row(commitLost.operationId)).state, 'associated');
    assert.equal((await remote(commitLost.operationId)).state, 'associated');
    assert.equal(await auditCount(commitLost.operationId), 1);
    const lostE = await fresh(),
      lostInput = intent(lostE);
    assert.equal(
      (
        await post(a, s, node, `${suffix(lostE)}/setup`, lostInput, {
          drop: true,
        })
      ).lost,
      true,
    );
    const recovered = await accept(b, s, lostE, 'setup', lostInput);
    assert.equal(recovered.status, 202);
    assert.equal(
      (await remote(recovered.data.operationId)).state,
      'associated',
    );
    console.log(
      'PASS credentials B-03/04: real outage/sealed restart/unseal, expired scoped token, audit rollback, PostgreSQL interruption and lost final COMMIT/HTTP acknowledgements',
    );
    const uncertain = await commitProxy(
      /INSERT INTO public\.endpoint_credential_operations/,
    );
    const uncertainReplica = await replica({ runtimeUrl: uncertain.url });
    const uncertainE = await fresh(),
      uncertainInput = intent(uncertainE);
    assert.equal(
      (await accept(uncertainReplica, s, uncertainE, 'setup', uncertainInput))
        .status,
      503,
    );
    const recoveredCommit = await accept(
      b,
      s,
      uncertainE,
      'setup',
      uncertainInput,
    );
    assert.equal(recoveredCommit.status, 202);
    assert.equal(
      (await remote(recoveredCommit.data.operationId)).state,
      'associated',
    );
    for (const sessionEnd of ['logout', 'expiry']) {
      const origin = await operator(a),
        continuation = await acceptedFresh(origin);
      if (sessionEnd === 'logout')
        await a('revoke', origin.token, {
          lifecycleId: origin.record.lifecycleId,
          generation: origin.record.generation,
        });
      else
        await redis.set(
          key(origin.token),
          JSON.stringify({
            ...origin.record,
            idleExpiresAt: Date.now() - 1,
            lastActivityAt: Date.now() - 2,
          }),
        );
      assert.equal(
        (
          await get(
            b,
            origin,
            node,
            opSuffix(continuation.extension, continuation.operationId),
          )
        ).status,
        401,
      );
      assert.equal(
        (await remote(continuation.operationId)).state,
        'associated',
      );
      const resumed = await issue(b, {
        plane: 'platform',
        identityId: origin.record.identityId,
        authenticationVersion: 1,
      });
      sessions.push(resumed);
      assert.equal(
        (
          await get(
            b,
            resumed,
            node,
            opSuffix(continuation.extension, continuation.operationId),
          )
        ).status,
        200,
      );
    }
    await owner.query(
      'CREATE TABLE public.endpoint_fixture_barriers(operation_id uuid PRIMARY KEY,ready boolean DEFAULT false,released boolean DEFAULT false)',
    );
    await owner.query(
      'GRANT SELECT,UPDATE ON public.endpoint_fixture_barriers TO myims_runtime',
    );
    async function ready(id) {
      for (let i = 0; i < 1000; i++) {
        if (
          (
            await owner.query(
              'SELECT ready FROM public.endpoint_fixture_barriers WHERE operation_id=$1',
              [id],
            )
          ).rows[0]?.ready
        )
          return;
        await delay(25);
      }
      throw new Error('Credential barrier deadline');
    }
    async function release(id) {
      await owner.query(
        'UPDATE public.endpoint_fixture_barriers SET released=true WHERE operation_id=$1',
        [id],
      );
    }
    const finalOrigin = await operator(a),
      finalFence = await acceptedFresh(finalOrigin);
    await owner.query(
      'INSERT INTO public.endpoint_fixture_barriers(operation_id) VALUES($1)',
      [finalFence.operationId],
    );
    const pendingFinal = remote(finalFence.operationId, 'execute', {
      fault: 'final_barrier',
    });
    try {
      await ready(finalFence.operationId);
      await owner.query(
        "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
        [finalOrigin.record.identityId],
      );
    } finally {
      await release(finalFence.operationId);
    }
    assert.equal((await pendingFinal).state, 'cancelled');
    assert.equal(
      (await get(a, s, node, suffix(finalFence.extension))).data.credential
        .kind,
      'unset',
    );
    const stale = await acceptedFresh();
    await owner.query(
      'INSERT INTO public.endpoint_fixture_barriers(operation_id) VALUES($1)',
      [stale.operationId],
    );
    const stalePending = remote(stale.operationId, 'execute', {
      fault: 'final_barrier',
    });
    let successor;
    try {
      await ready(stale.operationId);
      const changed = await patch(
        b,
        s,
        node,
        `extensions/${stale.extension.id}/status`,
        {
          expectedVersion: stale.extension.version,
          administrativeStatus: 'enabled',
        },
      );
      assert.equal(changed.status, 200);
      successor = changed.data.extension;
    } finally {
      await release(stale.operationId);
    }
    assert.equal((await stalePending).state, 'conflict');
    const successorAccepted = await accept(
      b,
      s,
      successor,
      'setup',
      intent(successor),
    );
    assert.equal(successorAccepted.status, 202);
    assert.equal(
      (await remote(successorAccepted.data.operationId)).state,
      'associated',
    );
    assert.equal((await remote(stale.operationId)).state, 'conflict');
    assert.equal(await auditCount(stale.operationId), 0);
    const lateOrigin = await operator(a),
      late = await acceptedFresh(lateOrigin);
    await owner.query(
      'INSERT INTO public.endpoint_fixture_barriers(operation_id) VALUES($1)',
      [late.operationId],
    );
    const latePending = remote(late.operationId, 'execute', { fault: 'late' });
    let lateSuccessor;
    try {
      await ready(late.operationId);
      const killed = await owner.query(
        "SELECT pg_terminate_backend(a.pid) FROM pg_stat_activity a WHERE a.application_name=$1 AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.locktype='advisory' AND l.granted)",
        ['endpoint-fixture-' + late.operationId],
      );
      assert.equal(killed.rowCount, 1);
      await owner.query(
        "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
        [lateOrigin.record.identityId],
      );
      assert.equal((await remote(late.operationId)).state, 'cancelled');
      await age(late.operationId);
      assert.equal(
        (await remote(late.operationId, 'cleanup'))[0].outcome,
        'absent',
      );
      const next = await accept(
        b,
        s,
        late.extension,
        'setup',
        intent(late.extension),
      );
      assert.equal(next.status, 202);
      lateSuccessor = next.data.operationId;
      assert.equal((await remote(next.data.operationId)).state, 'associated');
    } finally {
      await release(late.operationId);
    }
    assert.equal((await latePending).failed, true);
    assert.equal(
      (await remote(late.operationId, 'cleanup'))[0].outcome,
      'destroyed',
    );
    assert.equal((await remote(lateSuccessor, 'verify')).verified, true);
    assert.equal(
      (await get(a, s, node, suffix(late.extension))).data.credential.kind,
      'configured',
    );
    await owner.query(
      'ALTER TABLE public.endpoint_credential_operations DISABLE TRIGGER endpoint_credential_protection',
    );
    try {
      await owner.query(
        "UPDATE public.endpoint_credential_operations SET terminal_at=clock_timestamp()-interval '31 days' WHERE id=$1",
        [op],
      );
    } finally {
      await owner.query(
        'ALTER TABLE public.endpoint_credential_operations ENABLE TRIGGER endpoint_credential_protection',
      );
    }
    assert.equal(
      (await accept(a, s, e, 'setup', body)).data.reason,
      'intent_expired',
    );
    await assert.rejects(
      runtime.query(
        'DELETE FROM public.endpoint_credential_operations WHERE id=$1',
        [op],
      ),
    );
    console.log(
      'PASS credentials B-03/04/05: acceptance COMMIT loss, receipt expiry, logout/expiry continuation, final authority/version fences and late real preparation after database connection death; successor retained',
    );
    const restartE = await fresh(),
      restart = (await accept(a, s, restartE, 'setup', intent(restartE))).data;
    assert.equal(
      (await remote(restart.operationId, 'execute', { fault: 'restart' }))
        .interrupted,
      true,
    );
    assert.equal((await remote(restart.operationId)).state, 'associated');
    assert.equal(await auditCount(restart.operationId), 1);
    const failE = await fresh(),
      fail = (await accept(a, s, failE, 'setup', intent(failE))).data;
    await remote(fail.operationId, 'prepare');
    assert.equal(
      (await remote(fail.operationId, 'execute', { fault: 'invalid' })).state,
      'failed',
    );
    assert.equal(
      (await get(a, s, node, suffix(failE))).data.credential.kind,
      'unset',
    );
    const revokedE = await fresh(),
      origin = await operator(a);
    const revoked = (
      await accept(a, origin, revokedE, 'setup', intent(revokedE))
    ).data;
    await remote(revoked.operationId, 'prepare');
    await owner.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
      [origin.record.identityId],
    );
    assert.equal((await remote(revoked.operationId)).state, 'cancelled');
    assert.equal(
      (await row(revoked.operationId)).failure_code,
      'originator_revoked',
    );
    await owner.query(
      "UPDATE public.platform_operators SET status='active',version=version+1,authentication_version=authentication_version+1 WHERE id=$1",
      [origin.record.identityId],
    );
    assert.equal((await remote(revoked.operationId)).state, 'cancelled');
    console.log(
      'PASS credentials B-04/05: real prepare/restart recovery, permanent failure, canonical originator revocation and no revival',
    );
    // Exhausted failures stay reserved until explicit same-operation reconciliation.
    const outageE = await fresh(),
      outage = (await accept(a, s, outageE, 'setup', intent(outageE))).data;
    for (let i = 1; i <= 6; i++)
      await remote(outage.operationId, 'execute', {
        fault: 'outage',
        attempt: i,
      });
    assert.equal((await row(outage.operationId)).state, 'needs_reconciliation');
    await remote(outage.operationId);
    assert.equal((await row(outage.operationId)).state, 'needs_reconciliation');
    await remote(outage.operationId, 'requeue');
    assert.equal((await remote(outage.operationId)).state, 'associated');
    // Current and ever-associated material deny destruction regardless of fixture age.
    assert.equal(
      (await remote(op, 'cleanup'))[0].outcome,
      'retained_dependency_unknown',
    );
    assert.equal(
      (await remote(fail.operationId, 'cleanup'))[0].outcome,
      'retained_dependency_unknown',
    );
    // Owner-only time fixture advances terminal age; runtime cannot edit this binding/outcome.
    await owner.query(
      'ALTER TABLE public.endpoint_credential_operations DISABLE TRIGGER endpoint_credential_protection',
    );
    try {
      await owner.query(
        "UPDATE public.endpoint_credential_operations SET terminal_at=clock_timestamp()-interval '25 hours' WHERE id=$1",
        [fail.operationId],
      );
    } finally {
      await owner.query(
        'ALTER TABLE public.endpoint_credential_operations ENABLE TRIGGER endpoint_credential_protection',
      );
    }
    assert.equal(
      (await remote(fail.operationId, 'cleanup', { dependency: 'unknown' }))[0]
        .outcome,
      'retained_dependency_unknown',
    );
    assert.equal(
      (await remote(fail.operationId, 'cleanup'))[0].outcome,
      'destroyed',
    );
    assert.equal(
      (await remote(fail.operationId, 'cleanup'))[0].outcome,
      'destroyed',
    );
    assert.equal((await remote(fail.operationId, 'prepare')).failed, true);
    console.log(
      'PASS credentials B-04: six-attempt exhaustion, explicit same-key requeue, age/dependency/current/history cleanup fences, idempotent destroy and CAS tombstone',
    );
    const cleanupBudget = await acceptedFresh();
    await remote(cleanupBudget.operationId, 'prepare');
    await remote(cleanupBudget.operationId, 'execute', { fault: 'invalid' });
    await age(cleanupBudget.operationId);
    // Named owner-port exhaustion fixture avoids waiting six provider backoffs.
    await owner.query(
      "UPDATE public.endpoint_credential_operations SET cleanup_attempts=6,cleanup_state='cleanup_required' WHERE id=$1",
      [cleanupBudget.operationId],
    );
    assert.equal(
      (await remote(cleanupBudget.operationId, 'cleanup'))[0].outcome,
      'cleanup_required',
    );
    assert.equal(
      (await remote(cleanupBudget.operationId, 'cleanup-retry'))[0].outcome,
      'cleanup_retry',
    );
    assert.equal(
      (await remote(cleanupBudget.operationId, 'cleanup'))[0].outcome,
      'destroyed',
    );
    for (const fault of ['lost_destroy', 'cleanup_restart', 'cleanup_commit']) {
      const abandoned = await acceptedFresh();
      await remote(abandoned.operationId, 'prepare');
      assert.equal(
        (await remote(abandoned.operationId, 'execute', { fault: 'invalid' }))
          .state,
        'failed',
      );
      await age(abandoned.operationId);
      const interrupted = await remote(abandoned.operationId, 'cleanup', {
        fault,
      });
      if (fault === 'cleanup_restart')
        assert.equal(interrupted.interrupted, true);
      else if (fault === 'cleanup_commit')
        assert.equal(interrupted.failed, true);
      else assert.equal(interrupted[0].outcome, 'destroyed');
      assert.equal(
        (await remote(abandoned.operationId, 'cleanup'))[0].outcome,
        'destroyed',
      );
    }
    assert.equal((await remote(op, 'verify')).verified, true);
    console.log(
      'PASS credentials B-04: real destruction with lost provider reply, process death and lost cleanup COMMIT; repeat cleanup preserves associated generations',
    );
    const active = await operator(a);
    const staff = (
      await owner.query(
        'SELECT id,tenant_id,authentication_version FROM public.staff_users LIMIT 1',
      )
    ).rows[0];
    const staffSession = await issue(a, {
      plane: 'tenant',
      identityId: staff.id,
      tenantId: staff.tenant_id,
      authenticationVersion: staff.authentication_version,
      tenantAuthorityVersion: 1,
    });
    sessions.push(staffSession);
    const expired = await operator(a);
    await redis.set(
      key(expired.token),
      JSON.stringify({
        ...expired.record,
        idleExpiresAt: Date.now() - 1,
        lastActivityAt: Date.now() - 2,
      }),
    );
    const revokedSession = await operator(a);
    await a('revoke', revokedSession.token, {
      lifecycleId: revokedSession.record.lifecycleId,
      generation: revokedSession.record.generation,
    });
    const routes = [
      ['GET', suffix(e)],
      ['GET', opSuffix(e, op)],
      ['POST', `${suffix(e)}/setup`, body],
      ['POST', `${suffix(e)}/reset`, intent(e, generation)],
    ];
    for (const c of [a, b])
      for (const [method, path, body] of routes) {
        for (const [session, status] of [
          [undefined, 401],
          [staffSession, 403],
          [expired, 401],
          [revokedSession, 401],
        ]) {
          const response = await request(
            c,
            `/platform/pbx-nodes/${node.id}/${path}`,
            { method, body, session },
          );
          assert.equal(response.status, status);
          assert.equal(response.headers['cache-control'], 'no-store');
        }
        for (const headers of [
          { origin: 'https://evil.invalid' },
          { 'x-platform-proxy': 'bad' },
          ...(method === 'GET' ? [] : [{ 'x-platform-csrf': 'bad' }]),
          { authorization: `Bearer ${active.token}` },
          {
            cookie: `__Host-myims-platform=${active.token}; __Host-myims-platform=${active.token}`,
          },
        ]) {
          const response = await request(
            c,
            `/platform/pbx-nodes/${node.id}/${path}`,
            { method, body, session: active, headers },
          );
          assert.equal(
            response.status,
            headers.authorization || headers.cookie ? 401 : 403,
          );
          assert.equal(response.headers['cache-control'], 'no-store');
        }
      }
    const fault = await proxy('pause'),
      redisDown = await replica({ redisUrl: fault.url });
    fault.arm();
    for (const [method, path, body] of routes) {
      const response = await request(
        redisDown,
        `/platform/pbx-nodes/${node.id}/${path}`,
        { method, body, session: active },
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers['retry-after'], '1');
      assert.equal(response.headers['cache-control'], 'no-store');
    }
    const pgDown = await replica({
      runtimeUrl: appUrl.replace(/@[^/]+\//, '@127.0.0.1:1/'),
    });
    assert.equal((await get(pgDown, active, node, suffix(e))).status, 503);
    console.log(
      'PASS credentials B-05: every credential route on HTTP A/B rejects staff, anonymous, revoked, expired, forged, CSRF/origin/channel failures; Redis/PostgreSQL outages deny safely',
    );
    const missing = await acceptedFresh();
    assert.equal((await remote(missing.operationId)).state, 'associated');
    // Explicit isolated fixture owner corruption, never application retirement.
    assert.equal(
      (await remote(missing.operationId, 'fixture-destroy')).outcome,
      'destroyed',
    );
    await remote(missing.operationId, 'verify');
    const missingStatus = (await get(a, s, node, suffix(missing.extension)))
      .data;
    assert.equal(missingStatus.credential.materialHealth, 'unavailable');
    assert.equal((await remote(missing.operationId)).state, 'associated');
    assert.equal((await remote(missing.operationId, 'prepare')).failed, true);
    console.log(
      'PASS credentials B-02/04: actual missing associated version degrades material health; no silent regeneration or live-revocation claim',
    );
    const scan = await remote(op, 'scan', {
      httpOutput: output.join('') + processDiagnostics(),
    });
    assert.ok(scan.scanned >= 5, JSON.stringify(scan));
    assert.equal(scan.materialExcluded, true);
    assert.equal(scan.unique, true);
    console.log(
      'PASS credentials B-06: actual generated passwords excluded from captured HTTP, worker/provider logs, HMAC audit and canonical persisted metadata; independent generations unique',
    );
    // Strict inputs and existing protected channel policy on both independent HTTP graphs.
    for (const c of [a, b]) {
      for (const extra of [
        { password: 'ENDPOINT_MATERIAL_SENTINEL' },
        { providerPath: 'untrusted' },
        { operatorId: randomUUID() },
      ])
        assert.equal(
          (await accept(c, s, e, 'setup', { ...body, ...extra })).status,
          400,
        );
      assert.equal(
        (await request(c, `/platform/pbx-nodes/${node.id}/${suffix(e)}`))
          .status,
        401,
      );
      assert.equal(
        (
          await post(c, s, node, `${suffix(e)}/reset`, intent(e, generation), {
            headers: { origin: 'https://evil.invalid' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await post(c, s, node, `${suffix(e)}/reset`, intent(e, generation), {
            headers: { 'x-platform-csrf': 'bad' },
          })
        ).status,
        403,
      );
      assert.equal(
        (await get(c, s, node, suffix(e))).headers['cache-control'],
        'no-store',
      );
    }
    const persisted = (
      await runtime.query(
        'SELECT row_to_json(o) AS data FROM public.endpoint_credential_operations o UNION ALL SELECT row_to_json(w) FROM public.outbox_work w UNION ALL SELECT row_to_json(a) FROM public.audit_events a UNION ALL SELECT row_to_json(j) FROM pgboss.job j',
      )
    ).rows;
    for (const sentinel of [...secrets, 'ENDPOINT_MATERIAL_SENTINEL'])
      assert.ok(
        !(JSON.stringify(persisted) + output.join('')).includes(sentinel),
        'Credential sentinel leaked',
      );
    console.log(
      'PASS credentials B-05/06: strict material exclusion, HTTP A/B channel/origin/CSRF/no-store and safe database/outbox/job/receipt DTO scans',
    );
  } finally {
    for (const file of responses) await rm(file, { force: true });
  }
}
