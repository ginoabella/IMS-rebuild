// Actual PostgreSQL owned-copy rehearsal. No native owner, provider or SIP effects.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import {
  PreparationStore,
  manifest,
  stepId,
  fingerprint,
} from './tenant-call-preparation-store.mjs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
if (process.argv[2] === '--fixture') {
  const database = process.argv[3];
  if (!/^myims_session_[a-f0-9]{12}$/.test(database ?? ''))
    throw new Error('Owned database required');
  const { Client } = load('pg');
  const { loadMigrationConfig } = load(
    './dist/infrastructure/configuration.js',
  );
  const url = new URL(loadMigrationConfig().adminUrl);
  url.pathname = '/' + database;
  const client = new Client({
    connectionString: url.href,
    statement_timeout: 5000,
  });
  await client.connect();
  const file = '/tmp/preparation-' + database + '.json';
  let fixtureOwnership,
    fixtureToken,
    renewalTimer,
    renewing = false;
  try {
    const base = (
      await client.query(
        `SELECT n.id,n.installation_id,n.version,r.verified_id,a.digest FROM public.pbx_nodes n JOIN public.pbx_live_runtime r ON r.node_id=n.id JOIN public.pbx_artifact_profiles a ON a.artifact_id=r.verified_id ORDER BY n.id LIMIT 1`,
      )
    ).rows[0];
    assert.ok(base);
    const operator = (
      await client.query(
        "SELECT id,authentication_version FROM public.platform_operators WHERE status='active' AND credential_state='ready' ORDER BY id LIMIT 1",
      )
    ).rows[0];
    // Isolated SQL-only capability declaration, not ordinary/runtime capability proof.
    const capability = (
      await client.query(
        'UPDATE public.endpoint_capabilities SET revision=revision+1,credential_auth_max=128,credential_hex_max=64 WHERE installation_id=$1 RETURNING revision',
        [base.installation_id],
      )
    ).rows[0];
    const input = manifest({
      version: 1,
      requestId: randomUUID(),
      nodeId: base.id,
      installationId: base.installation_id,
      operatorId: operator.id,
      authenticationVersion: operator.authentication_version,
      expectedNodeVersion: base.version,
      expectedCapabilityRevision: capability.revision,
      expectedArtifactId: base.verified_id,
      expectedProfileDigest: base.digest,
      tenants: [
        {
          tenantCode: 'p4-dev-a',
          displayName: 'P4 controlled development A',
          extensionNumber: '7701',
          inboundNumber: '5557701',
          outboundNumber: '5558701',
        },
        {
          tenantCode: 'p4-dev-b',
          displayName: 'P4 controlled development B',
          extensionNumber: '7702',
          inboundNumber: '5557702',
          outboundNumber: '5558702',
        },
      ],
      unallocatedNumber: '7703',
    });
    assert.throws(() => manifest({ ...input, password: 'injected' }));
    const store = new PreparationStore(client, input);
    assert.equal((await store.preview()).state, 'preview');
    const wrong = new PreparationStore(client, {
      ...input,
      nodeId: randomUUID(),
    });
    await assert.rejects(wrong.preview());
    const stale = new PreparationStore(client, {
      ...input,
      expectedNodeVersion: base.version + 1,
    });
    await assert.rejects(stale.preview());
    writeFileSync(file, JSON.stringify(input), { mode: 0o600 });
    const run = () =>
      spawnSync(
        process.execPath,
        ['scripts/tenant-call-preparation.mjs', 'prepare', file],
        {
          env: {
            ...process.env,
            MIGRATION_DATABASE_URL:
              'postgresql://myims@postgres:5432/' + database,
            DATABASE_URL:
              'postgresql://myims_runtime@postgres:5432/' + database,
          },
          encoding: 'utf8',
          timeout: 30000,
        },
      );
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(
      JSON.parse(first.stdout).blocker,
      'credential_worker_required',
    );
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS n FROM public.tenant_call_preparations WHERE id=$1',
          [input.requestId],
        )
      ).rows[0].n,
      1,
    );
    const operations = await client.query(
      'SELECT id FROM public.endpoint_credential_operations WHERE request_id=$1',
      [stepId(input.requestId, 'credential-0')],
    );
    assert.equal(operations.rows.length, 1);
    const { SnapshotDatabase } = load(
      './dist/infrastructure/database/read-snapshot.js',
    );
    const { TransactionAuthority } = load(
      './dist/modules/identity/application/transaction-authority.js',
    );
    const { PlatformAuthorityRepository } = load(
      './dist/modules/platform/adapters/db/authority-read.js',
    );
    const { DraftTenantRuntime } = load(
      './dist/modules/platform/adapters/db/draft-tenant-runtime.js',
    );
    const runtimeUrl = new URL(loadMigrationConfig().runtimeUrl);
    runtimeUrl.pathname = '/' + database;
    const snapshot = new SnapshotDatabase(runtimeUrl.href);
    const authority = new TransactionAuthority(
      { lockedById: async () => ({ kind: 'denied' }) },
      new PlatformAuthorityRepository(snapshot),
    );
    const drafts = new DraftTenantRuntime(runtimeUrl.href, authority);
    const actor = {
      plane: 'platform',
      operatorId: input.operatorId,
      authenticationVersion: input.authenticationVersion,
      grants: ['platform_operator'],
    };
    const otherClient = new Client({
      connectionString: url.href,
      statement_timeout: 5000,
    });
    await otherClient.connect();
    const otherStore = new PreparationStore(otherClient, input);
    try {
      const body = {
        requestId: stepId(input.requestId, 'lost-ack'),
        tenantCode: 'p4-recovery-' + randomBytes(4).toString('hex'),
        displayName: 'Isolated preparation lost acknowledgement',
        administratorUsername: 'recovery-admin',
      };
      const create = async (values) => {
        const r = await drafts.service.create(actor, values, input.requestId);
        assert.ok(['created', 'replayed'].includes(r.kind));
        return r.value;
      };
      await assert.rejects(
        store.locked(() =>
          store.step('lost-ack', body, async (values) => {
            await create(values);
            throw new Error(
              'Injected lost acknowledgement after canonical commit',
            );
          }),
        ),
      );
      const recoveredStep = await otherStore.locked(() =>
        otherStore.step('lost-ack', body, create),
      );
      assert.ok(recoveredStep.tenant.id);
      assert.equal(
        (
          await client.query(
            'SELECT count(*)::int AS n FROM public.tenants WHERE normalized_code=$1',
            [body.tenantCode],
          )
        ).rows[0].n,
        1,
      );
      let invocations = 0;
      const repeat = {
        ...body,
        requestId: stepId(input.requestId, 'concurrent'),
        tenantCode: 'p4-concurrent-' + randomBytes(4).toString('hex'),
      };
      const concurrent = async (values) => {
        invocations++;
        return create(values);
      };
      const repeated = await Promise.all([
        store.locked(() => store.step('concurrent', repeat, concurrent)),
        otherStore.locked(() =>
          otherStore.step('concurrent', repeat, concurrent),
        ),
      ]);
      assert.equal(repeated[0].tenant.id, repeated[1].tenant.id);
      assert.equal(invocations, 1);
    } finally {
      await otherClient.end();
      await drafts.onApplicationShutdown();
      await snapshot.close();
    }
    const changed = new PreparationStore(client, {
      ...input,
      unallocatedNumber: '7799',
    });
    await assert.rejects(changed.verifyExisting());
    // Exact unsupported write is denied even to ordinary HTTP runtime authority.
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE myims_runtime');
    await assert.rejects(
      client.query(
        "INSERT INTO public.tenant_call_preparation_events(request_id,preparation_id,version,action,owner_epoch) VALUES($1,$2,1,'start',1)",
        [randomUUID(), input.requestId],
      ),
      { code: '42501' },
    );
    await client.query('ROLLBACK');
    const noCases = await store
      .locked(() => store.lifecycle('start', randomUUID(), 0))
      .then(
        () => false,
        () => true,
      );
    assert.equal(noCases, true);
    // Canonical full-flow SQL rehearsal with an explicitly synthetic provider.
    // The exact owned-copy guard above prevents ordinary metadata seeding.
    const { Pool } = load('pg');
    const { InventoryRuntime } = load(
      './dist/modules/telephony/adapters/db/inventory-runtime.js',
    );
    const { CredentialHandler } = load(
      './dist/modules/telephony/adapters/jobs/credential-handler.js',
    );
    const { AuditRepository } = load(
      './dist/modules/audit/adapters/db/audit-repository.js',
    );
    const fullSnapshot = new SnapshotDatabase(runtimeUrl.href);
    const fullAuthority = new TransactionAuthority(
      { lockedById: async () => ({ kind: 'denied' }) },
      new PlatformAuthorityRepository(fullSnapshot),
    );
    const fullInventory = new InventoryRuntime(runtimeUrl.href, fullAuthority);
    const fullPool = new Pool({ connectionString: runtimeUrl.href, max: 2 });
    const handler = new CredentialHandler(
      fullPool,
      fullAuthority,
      fullInventory.service,
      new AuditRepository(),
      { prepare: async () => {}, verify: async () => 'verified' },
    );
    await client.query(
      `INSERT INTO public.tenant_call_custody_proofs(node_id,owner_epoch,source_digest,valid) SELECT o.node_id,o.epoch,v.source_digest,true FROM public.pbx_ownership o JOIN public.pbx_live_runtime r ON r.node_id=o.node_id JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE o.node_id=$1`,
      [input.nodeId],
    );
    try {
      for (let i = 0; i < 3; i++) {
        const queued = (
          await client.query(
            "SELECT o.id,o.work_id FROM public.endpoint_credential_operations o JOIN public.tenant_call_preparation_steps s ON s.result->>'operationId'=o.id::text AND s.phase='outcome' AND s.step IN ('credential-0','credential-1','credential-2') WHERE s.preparation_id=$1 AND o.state IN ('queued','retrying')",
            [input.requestId],
          )
        ).rows;
        assert.equal(queued.length, 1);
        await handler.execute(queued[0].id, queued[0].work_id, 1);
        const continued = run();
        assert.equal(continued.status, 0, continued.stderr);
        const report = JSON.parse(continued.stdout);
        assert.equal(
          i === 2 ? report.state : report.blocker,
          i === 2 ? 'prepared' : 'credential_worker_required',
        );
      }
      assert.equal((await store.status()).inventory.extensionIds.length, 3);
      assert.equal((await store.status()).cases.length, 11);
      assert.equal(
        (
          await client.query(
            'SELECT valid FROM public.tenant_call_custody_proofs WHERE node_id=$1',
            [input.nodeId],
          )
        ).rows[0].valid,
        false,
      );
      assert.equal(run().status, 0);
    } finally {
      await fullPool.end();
      await fullInventory.onApplicationShutdown();
      await fullSnapshot.close();
    }
    const stopRequest = randomUUID(),
      stop = await store.locked(() => store.lifecycle('stop', stopRequest, 0));
    assert.equal(stop.action, 'stop');
    assert.equal(
      (await store.locked(() => store.lifecycle('stop', stopRequest, 0)))
        .version,
      1,
    );
    await assert.rejects(
      store.locked(() => store.lifecycle('start', stopRequest, 0)),
    );
    await assert.rejects(
      store.locked(() => store.lifecycle('stop', randomUUID(), 0)),
    );
    // SQL-only availability proof injection is confined to this copied database.
    const caseId = (await store.status()).cases[0].case_id;
    const available = async () =>
      (
        await client.query(
          'SELECT public.tenant_case_preparation_available($1) AS available',
          [caseId],
        )
      ).rows[0].available;
    assert.equal(await available(), false);
    const { ObservationRepository } = load(
      './dist/modules/telephony/adapters/db/observation-repository.js',
    );
    const { observationSettings } = load(
      './dist/modules/telephony/domain/observation-settings.js',
    );
    fixtureOwnership = new ObservationRepository(
      runtimeUrl.href,
      observationSettings(),
    );
    fixtureToken = await fixtureOwnership.acquire(input.nodeId, randomUUID());
    assert.ok(fixtureToken);
    renewalTimer = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try {
        const next = await fixtureOwnership.renew(fixtureToken);
        if (next) fixtureToken = next;
      } catch {
        /* The assertions expose unavailable ownership. */
      } finally {
        renewing = false;
      }
    }, 1000);
    await client.query(
      'INSERT INTO public.tenant_call_participant_instances(node_id,instance_id) VALUES($1,$2)',
      [input.nodeId, randomUUID()],
    );
    const { LiveExecutionStore } = load(
      './dist/modules/telephony/adapters/live/execution-store.js',
    );
    const { LiveOwnerExecutor } = load(
      './dist/modules/telephony/adapters/live/owner-executor.js',
    );
    const { LiveMaterialResolver } = load(
      './dist/modules/telephony/adapters/live/material-resolver.js',
    );
    const liveStore = new LiveExecutionStore(url.href);
    try {
      await liveStore.heartbeat(fixtureToken);
      // Simulate a successful GET sequence started before this publication.
      // Invoke the actual protected consumer commit against real PostgreSQL.
      const staleConsumer = new LiveOwnerExecutor(
        input.installationId,
        input.nodeId,
        liveStore,
        {
          preparationCustody: async () => [],
          resolve: async () => ({ endpoints: new Map(), trunks: new Map() }),
        },
        {},
      );
      await staleConsumer.checkPreparationCustody(
        fixtureToken,
        new globalThis.AbortController().signal,
      );
      assert.equal(
        (
          await client.query(
            'SELECT valid FROM public.tenant_call_custody_proofs WHERE node_id=$1',
            [input.nodeId],
          )
        ).rows[0].valid,
        false,
      );
      // Test-only second catalog publication races the actual consumer's node
      // lock. No resource or synthetic provider data leaves this owned database.
      const extra = { ...input, requestId: randomUUID() };
      const racing = new LiveOwnerExecutor(
        input.installationId,
        input.nodeId,
        liveStore,
        {
          preparationCustody: async () => [input.requestId],
          resolve: async () => ({ endpoints: new Map(), trunks: new Map() }),
        },
        {},
      );
      let pending;
      try {
        await client.query('BEGIN');
        await client.query(
          'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
          [input.nodeId],
        );
        pending = racing
          .checkPreparationCustody(
            fixtureToken,
            new globalThis.AbortController().signal,
          )
          .then(
            () => true,
            () => false,
          );
        let blocked = false;
        const deadline = Date.now() + 1200;
        while (Date.now() < deadline) {
          await client.query('SELECT pg_stat_clear_snapshot()');
          blocked = (
            await client.query(
              "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT id FROM public.pbx_nodes WHERE id=$1 FOR SHARE') AS blocked",
            )
          ).rows[0].blocked;
          if (blocked) break;
          await delay(20);
        }
        assert.equal(blocked, true);
        await client.query(
          'INSERT INTO public.tenant_call_preparations(id,node_id,installation_id,operator_id,authentication_version,fingerprint,definition) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            extra.requestId,
            extra.nodeId,
            extra.installationId,
            extra.operatorId,
            extra.authenticationVersion,
            fingerprint(extra),
            extra,
          ],
        );
        await client.query(
          "INSERT INTO public.tenant_call_preparation_steps(preparation_id,step,phase,result) VALUES($1,'cases','outcome','{}')",
          [extra.requestId],
        );
        await client.query(
          'UPDATE public.tenant_call_custody_proofs SET valid=false WHERE node_id=$1',
          [input.nodeId],
        );
        await client.query('COMMIT');
        assert.equal(await pending, true);
        assert.equal(
          (
            await client.query(
              'SELECT valid FROM public.tenant_call_custody_proofs WHERE node_id=$1',
              [input.nodeId],
            )
          ).rows[0].valid,
          false,
        );
      } finally {
        await client.query('ROLLBACK');
        await pending;
      }
      const extraStore = new PreparationStore(client, extra);
      await extraStore.locked(() =>
        extraStore.lifecycle('disable', randomUUID(), 0),
      );
      let materialReads = 0;
      const resolver = new LiveMaterialResolver(liveStore.pool, {
        access: async () => {},
        endpoint: async () => {
          materialReads++;
          return {};
        },
        trunk: async () => ({}),
      });
      const currentConsumer = new LiveOwnerExecutor(
        input.installationId,
        input.nodeId,
        liveStore,
        resolver,
        {},
      );
      await currentConsumer.checkPreparationCustody(
        fixtureToken,
        new globalThis.AbortController().signal,
      );
      assert.equal(materialReads, 3);
      assert.equal((await store.status()).custody.current, true);
    } finally {
      await liveStore.close();
    }
    await store.locked(() => store.lifecycle('start', randomUUID(), 1));
    assert.equal(await available(), true);
    const instance = (
      await client.query(
        'SELECT instance_id FROM public.tenant_call_participant_instances WHERE node_id=$1',
        [input.nodeId],
      )
    ).rows[0].instance_id;
    await client.query(
      'UPDATE public.tenant_call_participant_instances SET instance_id=$2 WHERE node_id=$1',
      [input.nodeId, randomUUID()],
    );
    assert.equal(await available(), false);
    await client.query(
      'UPDATE public.tenant_call_participant_instances SET instance_id=$2 WHERE node_id=$1',
      [input.nodeId, instance],
    );
    assert.equal(await available(), true);
    await client.query(
      'UPDATE public.tenant_call_custody_proofs SET valid=false WHERE node_id=$1',
      [input.nodeId],
    );
    assert.equal(await available(), false);
    await client.query(
      "UPDATE public.tenant_call_custody_proofs SET valid=true,checked_at=clock_timestamp()-interval '16 seconds' WHERE node_id=$1",
      [input.nodeId],
    );
    assert.equal(await available(), false);
    await client.query(
      'UPDATE public.tenant_call_custody_proofs SET checked_at=clock_timestamp() WHERE node_id=$1',
      [input.nodeId],
    );
    assert.equal(await available(), true);
    await store.locked(() => store.lifecycle('stop', randomUUID(), 2));
    assert.equal(await available(), false);
    await store.locked(() => store.lifecycle('disable', randomUUID(), 3));
    await assert.rejects(
      store.locked(() => store.lifecycle('start', randomUUID(), 4)),
    );
    await assert.rejects(
      client.query(
        'UPDATE public.tenant_call_preparations SET fingerprint=$2 WHERE id=$1',
        [input.requestId, '0'.repeat(64)],
      ),
      { code: '23514' },
    );
    // A committed outcome lost before acknowledgement is inspected on next process.
    const recovered = new PreparationStore(client, input);
    assert.equal((await recovered.status()).event.action, 'disable');
    assert.equal((await recovered.status()).state, 'prepared');
    assert.equal(await available(), false);
    console.log(
      JSON.stringify({
        state: 'passed',
        databaseBoundary: 'isolated_copy',
        ordinaryEffects: 0,
        providerEffects: 0,
        calls: 0,
        checks: [
          'manifest_secret_injection',
          'wrong_target',
          'stale_version',
          'interrupted_setup',
          'exact_process_retry',
          'one_credential_intent',
          'changed_payload_conflict',
          'runtime_write_denial',
          'incomplete_start_denial',
          'stop_exact_retry',
          'lifecycle_conflict',
          'disable_is_terminal',
          'immutable_provenance',
          'new_process_status_recovery',
          'actual_canonical_commit_ack_loss',
          'concurrent_exact_repeats',
          'stopped_case_denial',
          'fresh_custody_requirement',
          'custody_failure_denial',
          'custody_expiry_denial',
          'permanent_case_disablement',
          'full_canonical_prerequisite_flow_with_synthetic_fixture_provider',
          'eleven_persistent_cases_and_exact_inventory',
          'publication_invalidates_previous_custody',
          'inflight_prepublication_consumer_cannot_restore_old_proof',
          'current_catalog_requires_three_exact_material_reads',
          'publication_blocks_inflight_consumer_and_uses_fresh_snapshot',
        ],
      }),
    );
  } finally {
    clearInterval(renewalTimer);
    if (fixtureToken) await fixtureOwnership.release(fixtureToken);
    await fixtureOwnership?.close();
    if (existsSync(file)) unlinkSync(file);
    await client.end();
  }
} else {
  if (process.argv.length !== 2)
    throw new Error('No ordinary target accepted by rehearsal');
  function docker(args, input) {
    const r = spawnSync('docker', args, {
      input,
      timeout: 120000,
      maxBuffer: 67108864,
    });
    if (r.status !== 0) {
      if (args.includes('/workspace/scripts/check-tenant-call-preparation.mjs'))
        process.stderr.write(r.stderr);
      throw new Error('Owned preparation rehearsal failed');
    }
    return r.stdout;
  }
  const database = 'myims_session_' + randomBytes(6).toString('hex');
  let created = false;
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
    const env = [
      'MIGRATION_DATABASE_URL=postgresql://myims@postgres:5432/' + database,
      'DATABASE_URL=postgresql://myims_runtime@postgres:5432/' + database,
    ];
    docker([
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'env',
      ...env,
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
        '/workspace/scripts/check-tenant-call-preparation.mjs',
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
