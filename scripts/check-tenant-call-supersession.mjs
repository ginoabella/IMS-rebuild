// Owned database copy only. SQL custody/lease refresh below is explicitly injected.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import {
  PreparationStore,
  manifest,
  fingerprint,
} from './tenant-call-preparation-store.mjs';
import {
  currentSuccessorFacts,
  publishSuccessor,
} from './tenant-call-preparation-supersession.mjs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
if (process.argv[2] === '--fixture') {
  const database = process.argv[3];
  assert.match(database ?? '', /^myims_session_[a-f0-9]{12}$/);
  assert.equal(process.argv.length, 4);
  const { Client } = load('pg');
  const url = new URL(
    load('./dist/infrastructure/configuration.js').loadMigrationConfig()
      .adminUrl,
  );
  url.pathname = '/' + database;
  const connect = async () => {
    const client = new Client({
      connectionString: url.href,
      statement_timeout: 5000,
    });
    await client.connect();
    assert.equal(
      (await client.query('SELECT current_database() AS name')).rows[0].name,
      database,
    );
    return client;
  };
  const clients = [];
  let ownership, token, renewal;
  let renewing = false;
  try {
    const client = await connect();
    clients.push(client);
    const p = manifest(
      JSON.parse(
        readFileSync('docs/planning/p4-u2-dev-b-manifest.json', 'utf8'),
      ),
    );
    const store = new PreparationStore(client, p);
    assert.ok(await store.verifyExisting());
    // Acquire only this copied database's real bounded lease. No native/provider exists.
    const { ObservationRepository } = load(
      './dist/modules/telephony/adapters/db/observation-repository.js',
    );
    const { observationSettings } = load(
      './dist/modules/telephony/domain/observation-settings.js',
    );
    const runtimeUrl = new URL(
      load('./dist/infrastructure/configuration.js').loadMigrationConfig()
        .runtimeUrl,
    );
    runtimeUrl.pathname = '/' + database;
    ownership = new ObservationRepository(
      runtimeUrl.href,
      observationSettings(),
    );
    const incarnation = randomUUID();
    for (let i = 0; i < 20 && !token; i++) {
      token = await ownership.acquire(p.nodeId, incarnation);
      if (!token) await delay(1000);
    }
    assert.ok(token);
    renewal = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try {
        const next = await ownership.renew(token);
        if (next) token = next;
      } finally {
        renewing = false;
      }
    }, 1000);
    // Explicitly injected runtime binding in the owned copy, no installed proof claim.
    await client.query(
      'UPDATE public.pbx_live_runtime SET boundary_epoch=$2 WHERE node_id=$1',
      [p.nodeId, token.epoch],
    );
    await client.query(
      'UPDATE public.tenant_call_custody_proofs SET owner_epoch=$2 WHERE node_id=$1',
      [p.nodeId, token.epoch],
    );
    const originalGeneration = (
      await client.query(
        'SELECT coalesce(max(generation),0)::integer AS n FROM public.tenant_call_preparation_fact_sets WHERE preparation_id=$1',
        [p.requestId],
      )
    ).rows[0].n;
    const originalDisabled = (
      await client.query(
        'SELECT count(*)::integer AS n FROM public.tenant_route_case_disables WHERE preparation_id=$1',
        [p.requestId],
      )
    ).rows[0].n;
    await client.query(
      'UPDATE public.pbx_live_runtime SET executor_seen_at=clock_timestamp() WHERE node_id=$1',
      [p.nodeId],
    );
    await client.query(
      'UPDATE public.tenant_runtime_proofs f SET owner_epoch=$2,runtime_generation=r.routing_generation,checked_at=clock_timestamp(),valid=true FROM public.pbx_live_runtime r WHERE f.node_id=$1 AND r.node_id=f.node_id',
      [p.nodeId, token.epoch],
    );
    let status = await store.status();
    const stop = await store.locked(() =>
      store.lifecycle('stop', randomUUID(), status.event.version),
    );
    const before = (
      await client.query(
        'SELECT (SELECT jsonb_agg(to_jsonb(f) ORDER BY kind,resource_id) FROM public.tenant_call_preparation_facts f WHERE preparation_id=$1) AS facts,(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.tenant_route_test_cases c JOIN public.tenant_call_preparation_cases p ON p.case_id=c.id WHERE p.preparation_id=$1) AS cases,(SELECT count(*)::integer FROM public.tenant_route_test_intents WHERE node_id=$2) AS tests',
        [p.requestId, p.nodeId],
      )
    ).rows[0];
    const current = await store.transaction(
      () => currentSuccessorFacts(client, p),
      true,
    );
    const runtime = (
      await client.query(
        'SELECT verified_id FROM public.pbx_live_runtime WHERE node_id=$1',
        [p.nodeId],
      )
    ).rows[0];
    const old = (
      await client.query(
        'SELECT c.* FROM public.tenant_route_test_cases c JOIN public.tenant_call_preparation_cases p ON p.case_id=c.id WHERE p.preparation_id=$1 AND NOT EXISTS(SELECT 1 FROM public.tenant_route_case_disables d WHERE d.case_id=c.id) ORDER BY c.id',
        [p.requestId],
      )
    ).rows;
    assert.ok(old.length > 0 && old.length <= 32);
    const plan = {
      version: 1,
      requestId: randomUUID(),
      expectedGeneration: originalGeneration,
      expectedLifecycleVersion: stop.version,
      expectedArtifactId: runtime.verified_id,
      expectedSourceDigest: fingerprint(current.snapshot),
      facts: current.facts,
      cases: old.map((c, i) => ({
        key: 'retained-' + i,
        tenantId: c.tenant_id,
        direction: c.direction,
        routeId: c.route_id,
        sourceId: c.source_id,
        dialled: c.dialled,
        expectedDestinationId: c.expected_destination_id,
        expectedOutcome: c.expected_outcome,
        readinessRequired: c.readiness_required,
        kind: c.test_kind,
      })),
    };
    const other = await connect();
    clients.push(other);
    const { LiveExecutionStore } = load(
      './dist/modules/telephony/adapters/live/execution-store.js',
    );
    const { LiveOwnerExecutor } = load(
      './dist/modules/telephony/adapters/live/owner-executor.js',
    );
    const { LiveMaterialResolver } = load(
      './dist/modules/telephony/adapters/live/material-resolver.js',
    );
    const live = new LiveExecutionStore(url.href);
    let arrived, release;
    const reached = new Promise((resolve) => {
      arrived = resolve;
    });
    const released = new Promise((resolve) => {
      release = resolve;
    });
    let first = true;
    const resolver = new LiveMaterialResolver(live.pool, {
      access: async () => {},
      endpoint: async () => {
        if (first) {
          first = false;
          arrived();
          await released;
        }
        return {}; // Explicitly synthetic exact-GET transport in this owned database.
      },
      trunk: async () => ({}),
    });
    const stale = new LiveOwnerExecutor(
      p.installationId,
      p.nodeId,
      live,
      resolver,
      {},
    );
    const pending = stale.checkPreparationCustody(
      token,
      new globalThis.AbortController().signal,
    );
    let results;
    try {
      await Promise.race([
        reached,
        delay(10000).then(() => {
          throw new Error('Owned custody gate unavailable');
        }),
      ]);
      results = await Promise.all([
        publishSuccessor(store, plan),
        publishSuccessor(new PreparationStore(other, p), plan),
      ]);
      release();
      await pending;
      assert.equal(
        (
          await client.query(
            'SELECT valid FROM public.tenant_call_custody_proofs WHERE node_id=$1',
            [p.nodeId],
          )
        ).rows[0].valid,
        false,
      );
      const fresh = new LiveOwnerExecutor(
        p.installationId,
        p.nodeId,
        live,
        resolver,
        {},
      );
      await fresh.checkPreparationCustody(
        token,
        new globalThis.AbortController().signal,
      );
      assert.equal(
        (
          await client.query(
            'SELECT valid FROM public.tenant_call_custody_proofs WHERE node_id=$1',
            [p.nodeId],
          )
        ).rows[0].valid,
        true,
      );
    } finally {
      release();
      await pending;
      await live.close();
    }
    assert.equal(results.filter((r) => r.replayed).length, 1);
    assert.deepEqual(results[0].caseIds, results[1].caseIds);
    assert.equal(results[0].generation, originalGeneration + 1);
    await assert.rejects(
      publishSuccessor(store, {
        ...plan,
        expectedGeneration: originalGeneration + 1,
      }),
    );
    const oldFacts = (
      await client.query(
        'SELECT jsonb_agg(to_jsonb(f) ORDER BY kind,resource_id) AS facts FROM public.tenant_call_preparation_facts f WHERE preparation_id=$1',
        [p.requestId],
      )
    ).rows[0].facts;
    assert.deepEqual(oldFacts, before.facts);
    const oldCases = (
      await client.query(
        'SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) AS cases FROM public.tenant_route_test_cases c WHERE id=ANY($1::uuid[])',
        [before.cases.map((c) => c.id)],
      )
    ).rows[0].cases;
    assert.deepEqual(oldCases, before.cases);
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::integer AS n FROM public.tenant_route_test_intents WHERE node_id=$1',
          [p.nodeId],
        )
      ).rows[0].n,
      before.tests,
    );
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::integer AS n FROM public.tenant_route_case_disables WHERE preparation_id=$1',
          [p.requestId],
        )
      ).rows[0].n,
      originalDisabled + old.length,
    );
    const grant = (
      await client.query(
        "SELECT has_table_privilege('myims_runtime','public.tenant_call_preparation_fact_sets','INSERT') AS runtime,has_table_privilege('myims_pbx_executor','public.tenant_call_preparation_fact_sets','UPDATE') AS executor",
      )
    ).rows[0];
    assert.deepEqual(grant, { runtime: false, executor: false });
    await assert.rejects(
      client.query(
        'UPDATE public.tenant_call_preparation_fact_sets SET generation=2 WHERE preparation_id=$1',
        [p.requestId],
      ),
      { code: '23514' },
    );
    // Inject custody freshness only in this exact owned database, then start normally.
    await client.query(
      'UPDATE public.tenant_call_custody_proofs SET valid=true,checked_at=clock_timestamp() WHERE node_id=$1',
      [p.nodeId],
    );
    await store.locked(() =>
      store.lifecycle('start', randomUUID(), stop.version),
    );
    status = await store.status();
    assert.equal(
      status.cases.filter((c) => c.disabled).length,
      originalDisabled + old.length,
    );
    assert.equal(
      status.cases.filter((c) => !c.disabled && c.available).length,
      11,
    );
    assert.ok(
      !status.blockers.includes('resource_versions_or_authority_stale'),
    );
    const stopped = await store.locked(() =>
      store.lifecycle('stop', randomUUID(), stop.version + 1),
    );
    const next = {
      ...plan,
      requestId: randomUUID(),
      expectedGeneration: originalGeneration + 1,
      expectedLifecycleVersion: stopped.version,
    };
    await assert.rejects(
      publishSuccessor(store, { ...next, facts: next.facts.slice(1) }),
    );
    await assert.rejects(
      publishSuccessor(store, {
        ...next,
        cases: [{ ...next.cases[0], sourceId: randomUUID() }],
      }),
    );
    await assert.rejects(
      publishSuccessor(store, {
        ...next,
        cases: Array.from({ length: 17 }, (_, i) => ({
          ...next.cases[0],
          key: 'excess-' + i,
        })),
      }),
    );
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::integer AS n FROM public.tenant_call_preparation_fact_sets WHERE preparation_id=$1',
          [p.requestId],
        )
      ).rows[0].n,
      originalGeneration + 1,
    );
    console.log(
      JSON.stringify({
        state: 'successor_owned_copy_passed',
        database,
        concurrentExactReplay: true,
        immutableOriginals: true,
        canonicalFactsAndScopeGuards: true,
        preSupersessionConsumerCannotRestoreProof: true,
        disabledHistoryDoesNotBlockSuccessorStart: true,
        lease: 'canonical_owned_copy',
        custody: 'sql_injected_owned_copy_only',
        ordinaryEffects: 0,
        sipCalls: 0,
      }),
    );
  } finally {
    clearInterval(renewal);
    if (token) await ownership.release(token);
    await ownership?.close();
    await Promise.all(clients.map((c) => c.end()));
  }
} else {
  assert.equal(process.argv.length, 2);
  const database = 'myims_session_' + randomBytes(6).toString('hex');
  let created = false;
  const docker = (args, input) => {
    const r = spawnSync('docker', args, {
      input,
      timeout: 120000,
      maxBuffer: 67108864,
    });
    if (r.status !== 0) {
      if (
        args.includes('/workspace/scripts/check-tenant-call-supersession.mjs')
      )
        process.stderr.write(r.stderr);
      throw new Error('Owned successor check failed');
    }
    return r.stdout;
  };
  try {
    const dump = docker([
      'exec',
      'myims-rebuild-dev-postgres-1',
      'pg_dump',
      '-U',
      'myims',
      '-d',
      'myims',
      '--format=custom',
      '--no-owner',
    ]);
    docker([
      'exec',
      'myims-rebuild-dev-postgres-1',
      'createdb',
      '-U',
      'myims',
      database,
    ]);
    created = true;
    docker(
      [
        'exec',
        '-i',
        'myims-rebuild-dev-postgres-1',
        'pg_restore',
        '-U',
        'myims',
        '-d',
        database,
        '--no-owner',
      ],
      dump,
    );
    docker([
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'env',
      `MIGRATION_DATABASE_URL=postgresql://myims@postgres:5432/${database}`,
      `DATABASE_URL=postgresql://myims_runtime@postgres:5432/${database}`,
      'node',
      '/workspace/services/backend/dist/entrypoints/deployment/main.js',
      'migrate',
    ]);
    process.stdout.write(
      docker([
        'exec',
        '--user',
        'node',
        'myims-rebuild-dev-workspace-1',
        'node',
        '/workspace/scripts/check-tenant-call-supersession.mjs',
        '--fixture',
        database,
      ]),
    );
  } finally {
    if (created)
      docker([
        'exec',
        'myims-rebuild-dev-postgres-1',
        'dropdb',
        '-U',
        'myims',
        '--force',
        database,
      ]);
  }
}
