// Real canonical mutations and native retirement in the owned SIP fixture only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
export async function checkTenantRoutingTransfer({
  metadata,
  http,
  p,
  store,
  monitor,
  client,
  token,
  material,
  finished,
  expect,
  addCase,
  root,
  baseline,
  initialArtifact,
  maintain,
}) {
  const node = metadata.nodeId,
    [oldTenant, newTenant] = metadata.tenants;
  let current = initialArtifact;
  const artifacts = [initialArtifact];
  const mutation = (r) => {
    assert.ok(['edited', 'created'].includes(r.kind), JSON.stringify(r));
    return r.value.extension;
  };
  const tenantVersions = (t) => ({
    expectedTenantVersion: t.version,
    expectedAuthorityVersion: t.authorityVersion,
  });
  async function applyCurrent() {
    const revision = expect(
      await http.revisions.write(
        p,
        node,
        null,
        { requestId: randomUUID() },
        randomUUID(),
      ),
      201,
    ).revision;
    const validation = expect(
      await http.revisions.write(p, node, revision.id, {}, randomUUID()),
      201,
    ).validation;
    assert.equal(validation.applicable, true, JSON.stringify(validation));
    assert.equal(validation.local, 'passed');
    const op = expect(
      await http.live.accept(
        p,
        node,
        'apply',
        {
          requestId: randomUUID(),
          revisionId: revision.id,
          expectedBaselineId: current,
        },
        randomUUID(),
      ),
      202,
    ).operation;
    await client.execute(token, op.id, { material });
    await finished(op.id, 'verified');
    current = revision.id;
    await monitor.tick();
    return current;
  }
  async function bind(t, kind, resourceId) {
    const review = expect(
      await http.bindings.preview(
        p,
        t.id,
        node,
        { kind, resourceId, scope: 'owned' },
        randomUUID(),
      ),
      200,
    );
    assert.equal(review.compatible, true, JSON.stringify(review));
    const r = await http.bindings.write(
      p,
      t.id,
      node,
      null,
      {
        requestId: randomUUID(),
        ...tenantVersions(t),
        kind,
        resourceId,
        scope: 'owned',
        evaluated: review.evaluated,
        expectedVersion: review.currentVersion,
      },
      randomUUID(),
    );
    assert.ok([200, 201].includes(r.status), JSON.stringify(r));
    return r.value.items[0];
  }
  async function revoke(t, kind, resourceId) {
    const a = (
      await store.pool.query(
        "SELECT id,version FROM public.tenant_route_authorizations WHERE tenant_id=$1 AND node_id=$2 AND kind=$3 AND resource_id=$4 AND state='active'",
        [t.id, node, kind, resourceId],
      )
    ).rows[0];
    assert.ok(a);
    expect(
      await http.bindings.write(
        p,
        t.id,
        node,
        a.id,
        {
          requestId: randomUUID(),
          ...tenantVersions(t),
          expectedVersion: a.version,
        },
        randomUUID(),
      ),
      200,
    );
  }
  async function grantAndTest(t, caseIds) {
    await monitor.tick();
    const g =
      t.status === 'active'
        ? null
        : expect(
            await http.verification.write(
              p,
              t.id,
              node,
              'grant',
              { requestId: randomUUID(), artifactId: current, caseIds },
              randomUUID(),
            ),
            201,
          );
    for (const caseId of caseIds) {
      const i = expect(
        await http.verification.write(
          p,
          t.id,
          node,
          'test',
          {
            requestId: randomUUID(),
            artifactId: current,
            caseId,
            grantId: g?.id ?? null,
          },
          randomUUID(),
        ),
        202,
      );
      await monitor.tick();
      const result = (
        await store.pool.query(
          'SELECT c.expected_outcome,r.outcome FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_cases c ON c.id=i.case_id LEFT JOIN public.tenant_route_test_results r ON r.intent_id=i.id WHERE i.id=$1',
          [i.id],
        )
      ).rows[0];
      assert.equal(
        result.outcome,
        result.expected_outcome,
        JSON.stringify({ caseId, result }),
      );
    }
  }
  // Revoke permission through b's canonical owner; apply its exact deny revision.
  await revoke(oldTenant, 'permission', metadata.trunk.id);
  artifacts.push(await applyCurrent());
  const unpermitted = await addCase({
    tenantId: oldTenant.id,
    direction: 'outbound',
    routeId: metadata.outbound[0].id,
    sourceId: metadata.extensions[0].id,
    dialled: '5551000',
    kind: 'unpermitted',
  });
  await grantAndTest(oldTenant, [unpermitted]);
  console.log(
    'PASS tenant-routing actual SIP unpermitted source denied ' +
      JSON.stringify({ caseId: unpermitted, artifactId: current }),
  );
  await bind(oldTenant, 'permission', metadata.trunk.id);
  await bind(oldTenant, 'outbound', metadata.outbound[0].id);
  let extension = mutation(
    await http.service.edit(
      p,
      node,
      metadata.extensions[0].id,
      {
        expectedVersion: metadata.extensions[0].version,
        administrativeStatus: 'disabled',
      },
      randomUUID(),
      true,
    ),
  );
  await applyCurrent();
  const replacement = current,
    claim = metadata.claims[0];
  const release = () =>
    http.allocation.write(
      p,
      oldTenant.id,
      node,
      claim.id,
      'release',
      {
        requestId: randomUUID(),
        ...tenantVersions(oldTenant),
        expectedVersion: claim.version,
      },
      randomUUID(),
    );
  assert.equal((await release()).status, 409);
  for (const target of [baseline, replacement])
    assert.equal(
      (
        await http.retirement.write(
          p,
          node,
          {
            requestId: randomUUID(),
            artifactId: target,
            replacementId: replacement,
            resourceId: extension.id,
          },
          randomUUID(),
        )
      ).status,
      409,
    );
  // A real ongoing SIP call blocks retirement intent and release before native work.
  await monitor.tick();
  const otherCase = metadata.cases.find(
    (c) => c.tenantId === newTenant.id && c.direction === 'outbound',
  );
  const activeGrant =
    newTenant.status === 'active'
      ? null
      : expect(
          await http.verification.write(
            p,
            newTenant.id,
            node,
            'grant',
            {
              requestId: randomUUID(),
              artifactId: current,
              caseIds: [otherCase.id],
            },
            randomUUID(),
          ),
          201,
        );
  const active = expect(
    await http.verification.write(
      p,
      newTenant.id,
      node,
      'test',
      {
        requestId: randomUUID(),
        artifactId: current,
        caseId: otherCase.id,
        grantId: activeGrant?.id ?? null,
      },
      randomUUID(),
    ),
    202,
  );
  // Keep the same real local sink call alive naturally for five seconds so
  // canonical conflict checks can run under loaded CI. No hangup/control API.
  const schedule = globalThis.setTimeout;
  globalThis.setTimeout = (callback, milliseconds, ...args) =>
    schedule(
      callback,
      milliseconds === 1200
        ? 5000
        : milliseconds === 4000
          ? 8000
          : milliseconds,
      ...args,
    );
  const running = monitor.tick();
  try {
    const until = Date.now() + 15000;
    let admitted = false;
    while (Date.now() < until) {
      const state = (
        await store.pool.query(
          'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
          [active.id],
        )
      ).rows[0].state;
      if (state === 'admitted') {
        admitted = true;
        break;
      }
      await delay(10);
    }
    assert.ok(admitted, 'Actual call admission must be observed');
    const retirementBody = {
      requestId: randomUUID(),
      artifactId: artifacts[0],
      replacementId: replacement,
      resourceId: extension.id,
    };
    assert.equal(
      (await http.retirement.write(p, node, retirementBody, randomUUID()))
        .status,
      409,
    );
    assert.equal((await release()).status, 409);
    await running;
  } finally {
    globalThis.setTimeout = schedule;
  }
  assert.equal(
    (
      await store.pool.query(
        'SELECT state FROM public.tenant_route_test_progress WHERE intent_id=$1',
        [active.id],
      )
    ).rows[0].state,
    'passed',
  );
  console.log(
    'PASS tenant-routing actual active SIP call defers retirement and release',
  );
  for (const [index, artifactId] of artifacts.entries()) {
    const body = {
      requestId: randomUUID(),
      artifactId,
      replacementId: replacement,
      resourceId: extension.id,
    };
    const intent = expect(
      await http.retirement.write(p, node, body, randomUUID()),
      202,
    );
    expect(await http.retirement.write(p, node, body, randomUUID()), 200);
    const before = (
      await store.pool.query(
        'SELECT count(*)::integer AS n FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
        [artifactId],
      )
    ).rows[0].n;
    assert.ok(before > 0);
    if (index === 0) {
      // Inject only the final SQL write failure, after a real durable native tombstone.
      const connect = store.pool.connect.bind(store.pool);
      let injected = false;
      store.pool.connect = async (...args) => {
        if (args.length) return connect(...args);
        const sql = await connect(...args),
          query = sql.query.bind(sql);
        sql.query = (...values) => {
          if (
            !injected &&
            typeof values[0] === 'string' &&
            values[0].startsWith('INSERT INTO public.pbx_artifact_retirements(')
          ) {
            injected = true;
            return Promise.reject(new Error('Owned final SQL outage'));
          }
          return query(...values);
        };
        return sql;
      };
      try {
        await monitor.tick();
      } finally {
        store.pool.connect = connect;
      }
      assert.ok(injected);
      assert.ok(existsSync(root + '/retired/' + artifactId + '.json'));
      assert.equal(
        (
          await store.pool.query(
            'SELECT state FROM public.pbx_artifact_retirement_progress WHERE intent_id=$1',
            [intent.id],
          )
        ).rows[0].state,
        'unknown',
      );
      assert.equal(
        (
          await store.pool.query(
            'SELECT count(*)::integer AS n FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
            [artifactId],
          )
        ).rows[0].n,
        before,
      );
      await monitor.tick();
      assert.equal((await release()).status, 409);
      assert.equal(
        (
          await http.live.accept(
            p,
            node,
            'recover',
            {
              requestId: randomUUID(),
              targetId: artifactId,
              expectedBaselineId: replacement,
            },
            randomUUID(),
          )
        ).status,
        409,
      );
      expect(await http.retirement.write(p, node, body, randomUUID()), 200);
      const reconciled = expect(
        await http.retirement.write(
          p,
          node,
          { ...body, requestId: randomUUID(), reconcileId: intent.id },
          randomUUID(),
        ),
        202,
      );
      await monitor.tick();
      assert.equal(
        (
          await store.pool.query(
            'SELECT state FROM public.pbx_artifact_retirement_progress WHERE intent_id=$1',
            [reconciled.id],
          )
        ).rows[0].state,
        'retired',
      );
    } else {
      writeFileSync(root + '/retirement-child.json', JSON.stringify(token), {
        mode: 0o600,
        flag: 'wx',
      });
      try {
        await maintain(replacement, async (guard) => {
          await guard();
          const result = await new Promise((resolve, reject) => {
            const child = spawn(
              process.execPath,
              ['/retirement-interruption.mjs'],
              { stdio: ['ignore', 'pipe', 'pipe', 3] },
            );
            let output = '',
              size = 0;
            const deadline = setTimeout(() => child.kill('SIGKILL'), 20000);
            child.stdout.on('data', (bytes) => {
              output += bytes;
              size += bytes.length;
              if (size > 65536) child.kill('SIGKILL');
            });
            child.stderr.on('data', (bytes) => {
              size += bytes.length;
              if (size > 65536) child.kill('SIGKILL');
            });
            child.on('error', (error) => {
              clearTimeout(deadline);
              reject(error);
            });
            child.on('close', (code) => {
              clearTimeout(deadline);
              resolve({ code, output });
            });
          });
          assert.equal(
            result.code,
            73,
            'Actual native retirement child must exit at the durable tombstone boundary',
          );
          assert.ok(
            result.output.includes(
              'RETIREMENT_NATIVE_INTERRUPTED_AFTER_DURABLE_TOMBSTONE',
            ),
          );
          await guard();
        });
      } finally {
        unlinkSync(root + '/retirement-child.json');
      }
      const interrupted = (
        await store.pool.query(
          'SELECT state,owner_epoch FROM public.pbx_artifact_retirement_progress WHERE intent_id=$1',
          [intent.id],
        )
      ).rows[0];
      assert.equal(interrupted.state, 'queued');
      assert.ok(interrupted.owner_epoch);
      assert.ok(existsSync(root + '/retired/' + artifactId + '.json'));
      assert.equal(
        (
          await store.pool.query(
            'SELECT count(*)::integer AS n FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
            [artifactId],
          )
        ).rows[0].n,
        before,
      );
      await monitor.tick();
      assert.equal(
        (
          await store.pool.query(
            'SELECT state FROM public.pbx_artifact_retirement_progress WHERE intent_id=$1',
            [intent.id],
          )
        ).rows[0].state,
        'unknown',
      );
      const conflicting = await Promise.all([
        release(),
        http.live.accept(
          p,
          node,
          'recover',
          {
            requestId: randomUUID(),
            targetId: baseline,
            expectedBaselineId: replacement,
          },
          randomUUID(),
        ),
        http.live.accept(
          p,
          node,
          'apply',
          {
            requestId: randomUUID(),
            revisionId: replacement,
            expectedBaselineId: replacement,
          },
          randomUUID(),
        ),
      ]);
      assert.ok(
        conflicting.every((r) => r.status === 409),
        JSON.stringify(conflicting),
      );
      expect(await http.retirement.write(p, node, body, randomUUID()), 200);
      const reviewed = expect(
        await http.retirement.write(
          p,
          node,
          { ...body, requestId: randomUUID(), reconcileId: intent.id },
          randomUUID(),
        ),
        202,
      );
      await monitor.tick();
      assert.equal(
        (
          await store.pool.query(
            'SELECT state FROM public.pbx_artifact_retirement_progress WHERE intent_id=$1',
            [reviewed.id],
          )
        ).rows[0].state,
        'retired',
      );
      console.log(
        'PASS tenant-routing actual native retirement executor exit after durable tombstone: dispatched intent becomes unknown, pins remain, concurrent apply/recovery/release defer, exact retry never redispatches and explicit reconciliation completes ' +
          JSON.stringify({
            intentId: intent.id,
            reconciliationId: reviewed.id,
            artifactId,
            replacementId: replacement,
          }),
      );
    }
    assert.equal(
      (
        await store.pool.query(
          'SELECT state FROM public.pbx_artifact_retirement_progress WHERE intent_id=$1',
          [intent.id],
        )
      ).rows[0].state,
      'retired',
    );
    assert.equal(
      (
        await store.pool.query(
          'SELECT count(*)::integer AS n FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
          [artifactId],
        )
      ).rows[0].n,
      0,
    );
    assert.ok(existsSync(root + '/plans/' + artifactId + '.json'));
    assert.equal(
      (
        await http.live.accept(
          p,
          node,
          'recover',
          {
            requestId: randomUUID(),
            targetId: artifactId,
            expectedBaselineId: replacement,
          },
          randomUUID(),
        )
      ).status,
      409,
    );
  }
  // Desired references remain independently blocking after all old pins retire.
  assert.equal((await release()).status, 409);
  const inbound = metadata.inbound[0],
    groupId = inbound.destination.id;
  await revoke(oldTenant, 'inbound', inbound.id);
  expect(
    await http.routing.write(
      p,
      'inbound',
      node,
      inbound.id,
      'remove',
      { expectedVersion: inbound.version },
      randomUUID(),
    ),
    200,
  );
  await revoke(oldTenant, 'groups', groupId);
  const group = await http.routing.read('groups', node, groupId, {});
  assert.equal(group.status, 200, JSON.stringify(group));
  expect(
    await http.routing.write(
      p,
      'groups',
      node,
      groupId,
      'remove',
      { expectedVersion: group.value.resource.version },
      randomUUID(),
    ),
    200,
  );
  const released = expect(await release(), 200).items[0];
  assert.equal(released.state, 'released');
  extension = mutation(
    await http.service.edit(
      p,
      node,
      extension.id,
      { expectedVersion: extension.version, administrativeStatus: 'enabled' },
      randomUUID(),
      true,
    ),
  );
  const next = expect(
    await http.allocation.write(
      p,
      newTenant.id,
      node,
      null,
      'create',
      {
        requestId: randomUUID(),
        ...tenantVersions(newTenant),
        state: 'allocated',
        items: [
          { extensionId: extension.id, expectedVersion: extension.version },
        ],
      },
      randomUUID(),
    ),
    201,
  ).items[0];
  assert.notEqual(next.id, claim.id);
  assert.equal(next.tenantId, newTenant.id);
  let did = expect(
    await http.peers.write(
      p,
      'dids',
      node,
      null,
      'create',
      {
        requestId: randomUUID(),
        name: 'Transferred owner DID',
        number: '5550002',
        gatewayId: metadata.gateway.id,
      },
      randomUUID(),
    ),
    201,
  ).resource;
  did = expect(
    await http.peers.write(
      p,
      'dids',
      node,
      did.id,
      'status',
      { expectedVersion: did.version, enabled: true },
      randomUUID(),
    ),
    200,
  ).resource;
  let rule = expect(
    await http.routing.write(
      p,
      'inbound',
      node,
      null,
      'create',
      {
        requestId: randomUUID(),
        name: 'Transferred owner ingress',
        gatewayId: metadata.gateway.id,
        didId: did.id,
        destination: { kind: 'extension', id: extension.id },
      },
      randomUUID(),
    ),
    201,
  ).resource;
  rule = expect(
    await http.routing.write(
      p,
      'inbound',
      node,
      rule.id,
      'status',
      { expectedVersion: rule.version, enabled: true },
      randomUUID(),
    ),
    200,
  ).resource;
  await bind(newTenant, 'dids', did.id);
  await bind(newTenant, 'inbound', rule.id);
  const inboundCase = await addCase({
    tenantId: newTenant.id,
    direction: 'inbound',
    routeId: rule.id,
    sourceId: metadata.gateway.id,
    dialled: did.number,
    expectedDestinationId: extension.id,
    expectedOutcome: 'permitted',
    kind: 'routing',
  });
  const outboundCase = await addCase({
    tenantId: newTenant.id,
    direction: 'outbound',
    routeId: metadata.outbound[1].id,
    sourceId: extension.id,
    dialled: '5551001',
    expectedDestinationId: metadata.trunk.id,
    expectedOutcome: 'permitted',
    kind: 'routing',
  });
  const staleCase = await addCase({
    tenantId: oldTenant.id,
    direction: 'outbound',
    routeId: metadata.outbound[0].id,
    sourceId: extension.id,
    dialled: '5551000',
    kind: 'stale-source',
  });
  await applyCurrent();
  await grantAndTest(newTenant, [
    ...metadata.cases
      .filter((c) => c.tenantId === newTenant.id)
      .map((c) => c.id),
    inboundCase,
    outboundCase,
  ]);
  await grantAndTest(oldTenant, [staleCase]);
  const evidence = await http.evidence.snapshot(newTenant.id, node);
  assert.equal(evidence.readiness.state, 'ready', JSON.stringify(evidence));
  assert.ok(
    evidence.verifiedExtensions.some(
      (e) => e.extensionId === extension.id && e.allocationId === next.id,
    ),
  );
  const original = (
    await store.pool.query(
      "SELECT snapshot->'tenantRouting'->'allocations' AS claims FROM public.pbx_revisions WHERE id=$1",
      [initialArtifact],
    )
  ).rows[0].claims;
  assert.ok(
    original.some((c) => c.id === claim.id && c.tenantId === oldTenant.id),
  );
  assert.equal(
    (
      await store.pool.query(
        'SELECT tenant_id FROM public.tenant_inventory_claims WHERE id=$1',
        [claim.id],
      )
    ).rows[0].tenant_id,
    oldTenant.id,
  );
  console.log(
    'PASS tenant-routing actual native retirement: active/unknown deferral, retained bytes, native tombstone/final SQL interruption with pins held, exact replay and explicit reconciliation, retired recovery denial, desired blockers, canonical release/new claim, new-owner inbound/outbound SIP/RTP and stale old-owner denial ' +
      JSON.stringify({
        retiredArtifactIds: artifacts,
        replacementId: replacement,
        artifactId: current,
        oldClaimId: claim.id,
        newClaimId: next.id,
        extensionId: extension.id,
        oldTenantId: oldTenant.id,
        newTenantId: newTenant.id,
        verifiedExtensions: evidence.verifiedExtensions,
      }),
  );
  return current;
}
