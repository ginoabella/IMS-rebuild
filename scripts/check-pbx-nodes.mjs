import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { mkdtemp, writeFile, rm, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { parseLimiterConfig, parseSessionConfig } = backend('@myims/config');
const { PlatformBrowser } = load(
  'modules/identity/adapters/http/platform-browser',
);
const { FilePbxCatalog } = load(
  'modules/telephony/adapters/connectivity/catalog',
);
const { SecretFileCredentials } = load(
  'modules/telephony/adapters/connectivity/secret-files',
);
const { ExactPbxDestinationPolicy } = load(
  'modules/telephony/adapters/connectivity/destination',
);
const { PbxRuntime } = load('modules/telephony/adapters/db/pbx-runtime');
const { TransactionAuthority } = load(
  'modules/identity/application/transaction-authority',
);
const { OutboxRepository } = load('infrastructure/outbox/outbox-repository');
const { SafeLogger } = load('infrastructure/execution/logging');
export async function checkPbxNodes({
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  secrets,
  appUrl,
  commitProxy,
  proxy,
}) {
  const directory = await mkdtemp(join(tmpdir(), 'myims-pbx-'));
  const catalogFile = join(directory, 'catalog.json');
  const profiles = Array.from({ length: 42 }, (_, i) => ({
    installationId: randomUUID(),
    targetAlias: `fixture-pbx-${i}`,
    aliases: [`equivalent-pbx-${i}`],
    host: `pbx-${i}.fixture.invalid`,
    transport: 'ami-tls',
    port: 5039 + i,
    tlsServerName: `pbx-${i}.fixture.invalid`,
    addresses: [`192.0.2.${i + 1}`],
    credentialAliases: ['fixture-observer', 'fixture-rotated'],
  }));
  await writeFile(catalogFile, JSON.stringify(profiles), { mode: 0o600 });
  const config = {
    origin: 'https://localhost:9443',
    proxyPeers: ['127.0.0.1'],
    proxySecret: randomBytes(32).toString('hex'),
    csrfSecret: randomBytes(32).toString('hex'),
  };
  const browser = new PlatformBrowser(config),
    calls = [],
    sessions = [],
    output = [];
  secrets.push(
    config.proxySecret,
    config.csrfSecret,
    'PBX_SECRET_SENTINEL',
    'PBX_USER_SENTINEL',
  );
  async function replica(override = {}) {
    const c = await worker({
      http: true,
      productionHttp: true,
      pbxCatalogFile: catalogFile,
      config: parseSessionConfig({ SESSION_TIMEOUT_MS: '1000' }),
      browserConfig: config,
      limiterConfig: parseLimiterConfig({
        LIMITER_TRUSTED_PROXIES: '127.0.0.1',
      }),
      ...override,
    });
    calls.push(c);
    return c;
  }
  async function operator(c) {
    const id = randomUUID();
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready','pbx-verifier',clock_timestamp())",
      [id, `pbx.${id}`],
    );
    const s = await issue(c, {
      plane: 'platform',
      identityId: id,
      authenticationVersion: 1,
    });
    sessions.push(s);
    return s;
  }
  function request(
    c,
    path,
    { method = 'GET', session, body, headers = {}, drop = false } = {},
  ) {
    return new Promise((resolve, reject) => {
      const payload =
        body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body);
      const req = httpRequest(
        `${c.url}${path}`,
        {
          method,
          headers: {
            origin: config.origin,
            'x-platform-proxy': config.proxySecret,
            'x-forwarded-for': '192.0.2.112',
            ...(session
              ? {
                  cookie: `__Host-myims-platform=${session.token}`,
                  'x-platform-csrf': browser.sessionProof(session.token),
                }
              : {}),
            ...(payload === undefined
              ? {}
              : { 'content-type': 'application/json' }),
            ...headers,
          },
        },
        (res) => {
          if (drop) {
            res.destroy();
            req.destroy();
            resolve({ lost: true });
            return;
          }
          let text = '';
          res.on('data', (d) => (text += d));
          res.on('end', () => {
            output.push(text);
            resolve({
              status: res.statusCode,
              data: JSON.parse(text),
              headers: res.headers,
            });
          });
          res.on('error', reject);
        },
      );
      req.setTimeout(15000, () => req.destroy(new Error('PBX API deadline')));
      req.on('error', reject);
      req.end(payload);
    });
  }
  const create = (c, s, body, extra = {}) =>
    request(c, '/platform/pbx-nodes', {
      method: 'POST',
      session: s,
      body,
      ...extra,
    });
  const edit = (c, s, id, body, extra = {}) =>
    request(c, `/platform/pbx-nodes/${id}`, {
      method: 'PATCH',
      session: s,
      body,
      ...extra,
    });
  const desired = (i) => ({
    displayName: ' Controlled PBX ',
    management: {
      targetAlias: profiles[i].targetAlias,
      transport: profiles[i].transport,
      port: profiles[i].port,
    },
    credentialAlias: 'fixture-observer',
  });
  const data = (i) => ({ requestId: randomUUID(), ...desired(i) });
  async function counts() {
    return (
      await owner.query(
        "SELECT (SELECT count(*)::int FROM public.pbx_nodes) AS nodes,(SELECT count(*)::int FROM public.pbx_create_receipts) AS receipts,(SELECT count(*)::int FROM public.audit_events WHERE event_type='telephony.pbx.desired-changed') AS audit,(SELECT count(*)::int FROM public.outbox_work WHERE work_type='fixture.pbx-reconcile') AS intents",
      )
    ).rows[0];
  }
  async function barrier(pattern, n = 1) {
    for (let i = 0; i < 180; i++) {
      await owner.query('SELECT pg_stat_clear_snapshot()');
      const { rows } = await owner.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
        [pattern],
      );
      if (rows[0].n >= n) return;
      await delay(5);
    }
    throw new Error('PBX database barrier not reached');
  }
  let handoffRuntime, handoffDatabase;
  try {
    const a = await replica(),
      b = await replica(),
      s = await operator(a),
      foreign = await operator(b);
    const attempt = data(0),
      before = await counts();
    const created = await create(a, s, attempt);
    assert.equal(created.status, 201);
    const node = created.data.node;
    assert.equal(node.installationId, profiles[0].installationId);
    assert.equal(node.displayName, 'Controlled PBX');
    assert.equal(node.version, 1);
    assert.equal(node.createdBy, s.record.identityId);
    assert.deepEqual(node.observation, { kind: 'not_available' });
    assert.deepEqual(await counts(), {
      nodes: before.nodes + 1,
      receipts: before.receipts + 1,
      audit: before.audit + 1,
      intents: before.intents,
    });
    const detail = await request(b, `/platform/pbx-nodes/${node.id}`, {
      session: s,
    });
    assert.deepEqual(detail.data, created.data);
    assert.equal(detail.headers['cache-control'], 'no-store');
    const passive = await redis.get(key(s.token));
    await request(a, '/platform/pbx-nodes', { session: s });
    assert.equal(await redis.get(key(s.token)), passive);
    const replay = await create(b, s, {
      ...attempt,
      displayName: 'Controlled PBX',
      management: { ...attempt.management, targetAlias: ' EQUIVALENT-PBX-0 ' },
    });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.data, created.data);
    assert.equal(
      (await create(b, s, { ...attempt, displayName: 'Other' })).data.reason,
      'request_conflict',
    );
    assert.equal(
      (await create(b, foreign, attempt)).data.reason,
      'target_conflict',
    );
    const audits = (
      await runtime.query(
        'SELECT * FROM public.audit_events WHERE target_reference=$1',
        [node.id],
      )
    ).rows;
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actor_reference, s.record.identityId);
    assert.equal(audits[0].tenant_id, null);
    console.log(
      'PASS PBX A-01/02: safe desired DTO, distinct installation identity, cross-replica reads/replay and single attributed atomic audit',
    );

    const invalids = [
      null,
      [],
      {},
      ...[
        'password',
        'username',
        'tenantId',
        'actorId',
        'roles',
        'installationId',
        'ownershipKey',
      ].map((k) => ({ ...data(1), [k]: 'PBX_SECRET_SENTINEL' })),
      { ...data(1), displayName: '\ud800' },
      { ...data(1), displayName: 'x\n' },
      { ...data(1), displayName: 'x'.repeat(201) },
      { ...data(1), displayName: ' '.repeat(801) },
      { ...data(1), requestId: 'bad' },
      { ...data(1), credentialAlias: '/run/secrets/pbx' },
      {
        ...data(1),
        credentialAlias: 'https://user:PBX_SECRET_SENTINEL@provider/',
      },
      { ...data(1), credentialAlias: 'unapproved' },
      ...['host', 'password', 'providerPath'].map((k) => ({
        ...data(1),
        management: { ...desired(1).management, [k]: 'PBX_SECRET_SENTINEL' },
      })),
      {
        ...data(1),
        management: { ...desired(1).management, targetAlias: 'unknown' },
      },
      {
        ...data(1),
        management: { ...desired(1).management, transport: 'http' },
      },
      { ...data(1), management: { ...desired(1).management, port: 80 } },
    ];
    const invalidBefore = await counts();
    for (const body of invalids)
      assert.equal((await create(a, s, body)).status, 400);
    assert.equal((await create(a, s, '{broken')).status, 400);
    assert.equal((await create(a, s, ' '.repeat(5000))).status, 400);
    assert.deepEqual(await counts(), invalidBefore);
    for (const [table, condition] of [
      ['audit_events', "event_type<>'telephony.pbx.desired-changed'"],
      ['pbx_create_receipts', 'false'],
    ]) {
      const old = await counts(),
        body = data(1);
      await owner.query(
        `ALTER TABLE public.${table} ADD CONSTRAINT pbx_fault CHECK (${condition}) NOT VALID`,
      );
      try {
        assert.equal((await create(a, s, body)).status, 503);
        assert.deepEqual(await counts(), old);
      } finally {
        await owner.query(
          `ALTER TABLE public.${table} DROP CONSTRAINT pbx_fault`,
        );
      }
    }
    for (const sql of [
      'DELETE FROM public.pbx_nodes',
      'TRUNCATE public.pbx_nodes',
      'DELETE FROM public.pbx_create_receipts',
      'UPDATE public.pbx_create_receipts SET fingerprint=fingerprint',
      'ALTER TABLE public.pbx_nodes DISABLE TRIGGER ALL',
      'CREATE TABLE public.pbx_forbidden(id int)',
    ])
      await assert.rejects(runtime.query(sql), (e) => e.code === '42501');
    await assert.rejects(
      runtime.query('UPDATE public.pbx_nodes SET id=$2 WHERE id=$1', [
        node.id,
        randomUUID(),
      ]),
      (e) => e.code === '42501',
    );
    await assert.rejects(
      runtime.query('UPDATE public.pbx_nodes SET display_name=$2 WHERE id=$1', [
        node.id,
        'No version',
      ]),
      (e) => e.code === '23514',
    );
    await assert.rejects(
      owner.query('DELETE FROM public.pbx_nodes WHERE id=$1', [node.id]),
      (e) => e.code === '23514',
    );
    console.log(
      'PASS PBX A-02/06: bounded/forged input rejection, audit/receipt rollback and deployment-only DDL/protected runtime grants',
    );

    async function race(left, right) {
      const old = await counts();
      await owner.query('BEGIN');
      await owner.query('LOCK TABLE public.pbx_create_receipts IN SHARE MODE');
      const x = create(a, s, left),
        y = create(b, s, right);
      try {
        await barrier('INSERT INTO public.pbx_create_receipts%');
        await barrier('%', 2);
      } finally {
        await owner.query('COMMIT');
      }
      const results = await Promise.all([x, y]);
      assert.deepEqual(await counts(), {
        nodes: old.nodes + 1,
        receipts: old.receipts + 1,
        audit: old.audit + 1,
        intents: old.intents,
      });
      return results;
    }
    const same = data(1);
    const identical = await race(same, {
      ...same,
      management: { ...same.management, targetAlias: profiles[1].aliases[0] },
    });
    assert.deepEqual(identical.map((r) => r.status).sort(), [200, 201]);
    assert.deepEqual(identical[0].data, identical[1].data);
    const competing = data(2);
    const different = await race(competing, {
      ...competing,
      requestId: randomUUID(),
      management: {
        ...competing.management,
        targetAlias: profiles[2].aliases[0],
      },
    });
    assert.deepEqual(different.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      different.find((r) => r.status === 409).data.reason,
      'target_conflict',
    );
    const conflict = data(3);
    const conflicting = await race(conflict, {
      ...conflict,
      displayName: 'Another',
    });
    assert.deepEqual(conflicting.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      conflicting.find((r) => r.status === 409).data.reason,
      'request_conflict',
    );
    const lost = data(4),
      lostCount = await counts();
    assert.equal((await create(a, s, lost, { drop: true })).lost, true);
    assert.equal((await counts()).nodes, lostCount.nodes + 1);
    assert.equal((await create(b, s, lost)).status, 200);
    const uncertainProxy = await commitProxy(
      /INSERT INTO public\.pbx_create_receipts/,
    );
    const uncertainReplica = await replica({ runtimeUrl: uncertainProxy.url });
    const uncertain = data(5),
      uncertainCount = await counts();
    assert.equal((await create(uncertainReplica, s, uncertain)).status, 503);
    assert.equal(uncertainProxy.dropped(), true);
    assert.equal((await counts()).nodes, uncertainCount.nodes + 1);
    await uncertainReplica('close');
    const restarted = await replica();
    assert.equal((await create(restarted, s, uncertain)).status, 200);
    assert.equal((await counts()).nodes, uncertainCount.nodes + 1);
    console.log(
      'PASS PBX A-03: barrier-controlled alias/intent races and real HTTP/COMMIT acknowledgment loss recovered by explicit same-intent retry',
    );

    const edited = await edit(b, s, node.id, {
      ...desired(0),
      credentialAlias: 'fixture-rotated',
      expectedVersion: 1,
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.node.version, 2);
    assert.equal(edited.data.node.installationId, node.installationId);
    assert.equal(edited.data.node.id, node.id);
    assert.deepEqual(edited.data.node.observation, { kind: 'not_available' });
    assert.equal(
      (await edit(a, s, node.id, { ...desired(0), expectedVersion: 1 })).data
        .reason,
      'stale_version',
    );
    assert.deepEqual((await create(a, s, attempt)).data, created.data);
    assert.deepEqual(
      (await request(a, `/platform/pbx-nodes/${node.id}`, { session: s })).data,
      edited.data,
    );
    const noChangeCount = await counts();
    assert.equal(
      (
        await edit(a, s, node.id, {
          ...desired(0),
          credentialAlias: 'fixture-rotated',
          expectedVersion: 2,
        })
      ).data.node.version,
      2,
    );
    assert.deepEqual(await counts(), noChangeCount);
    assert.equal(
      (await edit(a, s, node.id, { ...desired(1), expectedVersion: 2 })).data
        .reason,
      'target_conflict',
    );
    await owner.query('BEGIN');
    await owner.query('LOCK TABLE public.pbx_nodes IN SHARE MODE');
    const ex = edit(a, s, node.id, { ...desired(0), expectedVersion: 2 }),
      ey = edit(b, s, node.id, {
        ...desired(0),
        displayName: 'Concurrent',
        expectedVersion: 2,
      });
    try {
      await barrier('%', 2);
    } finally {
      await owner.query('COMMIT');
    }
    assert.deepEqual(
      (await Promise.all([ex, ey])).map((r) => r.status).sort(),
      [200, 409],
    );

    // b handoff fixture owns its projection, no observation schema in migrations.
    await owner.query(
      'CREATE TABLE public.pbx_handoff_fixture(node_id uuid PRIMARY KEY, version int NOT NULL, generation int NOT NULL, current boolean NOT NULL)',
    );
    await owner.query(
      'GRANT SELECT,INSERT,UPDATE ON public.pbx_handoff_fixture TO myims_runtime',
    );
    const { PlatformAuthorityRepository } = load(
      'modules/platform/adapters/db/authority-read',
    );
    const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
    handoffDatabase = new SnapshotDatabase(appUrl);
    const authority = new TransactionAuthority(
      { lockedById: async () => ({ kind: 'denied' }) },
      new PlatformAuthorityRepository(handoffDatabase),
    );
    let fail = false,
      failIntent = false;
    const changes = {
      async onCreate(tx, n) {
        await tx.query(
          'INSERT INTO public.pbx_handoff_fixture VALUES($1,$2,1,true)',
          [n.id, n.version],
        );
        await intent(tx, n.version);
      },
      async onChange(tx, c) {
        await tx.query(
          'UPDATE public.pbx_handoff_fixture SET version=$2,generation=generation+$3,current=CASE WHEN $3=1 THEN false ELSE current END WHERE node_id=$1',
          [c.nodeId, c.nextVersion, c.connectivityChanged ? 1 : 0],
        );
        if (fail) throw new Error('PBX_SECRET_SENTINEL');
        await intent(tx, c.nextVersion);
      },
    };
    async function intent(tx, version) {
      await new OutboxRepository().insert(
        tx,
        {
          type: 'fixture.pbx-reconcile',
          version: 1,
          fields: { version: { kind: 'integer', min: 1, max: 1000 } },
        },
        `${tx.context.target.reference}:${version}`,
        { version },
      );
      if (failIntent) throw new Error('PBX_SECRET_SENTINEL');
    }
    handoffRuntime = new PbxRuntime(
      appUrl,
      authority,
      catalogFile,
      changes,
      new SafeLogger('http', (line) => output.push(line)),
    );
    const p = {
      plane: 'platform',
      operatorId: s.record.identityId,
      authenticationVersion: 1,
      grants: ['platform_operator'],
    };
    const handoff = await handoffRuntime.service.create(
      p,
      data(6),
      randomUUID(),
    );
    assert.equal(handoff.kind, 'created');
    const hn = handoff.value.node;
    const pidBefore = await counts();
    fail = true;
    assert.equal(
      (
        await handoffRuntime.service.edit(
          p,
          hn.id,
          {
            ...desired(6),
            credentialAlias: 'fixture-rotated',
            expectedVersion: 1,
          },
          randomUUID(),
        )
      ).kind,
      'unavailable',
    );
    assert.deepEqual(await counts(), pidBefore);
    assert.equal(
      (
        await runtime.query(
          'SELECT * FROM public.pbx_handoff_fixture WHERE node_id=$1',
          [hn.id],
        )
      ).rows[0].generation,
      1,
    );
    fail = false;
    failIntent = true;
    assert.equal(
      (
        await handoffRuntime.service.edit(
          p,
          hn.id,
          {
            ...desired(6),
            credentialAlias: 'fixture-rotated',
            expectedVersion: 1,
          },
          randomUUID(),
        )
      ).kind,
      'unavailable',
    );
    assert.deepEqual(await counts(), pidBefore);
    const createFaultCount = await counts();
    assert.equal(
      (await handoffRuntime.service.create(p, data(7), randomUUID())).kind,
      'unavailable',
    );
    assert.deepEqual(await counts(), createFaultCount);
    failIntent = false;
    const intentFaultCount = await counts();
    await owner.query(
      "ALTER TABLE public.outbox_work ADD CONSTRAINT pbx_intent_fault CHECK (work_type <> 'fixture.pbx-reconcile') NOT VALID",
    );
    try {
      assert.equal(
        (await handoffRuntime.service.create(p, data(7), randomUUID())).kind,
        'unavailable',
      );
      assert.deepEqual(await counts(), intentFaultCount);
    } finally {
      await owner.query(
        'ALTER TABLE public.outbox_work DROP CONSTRAINT pbx_intent_fault',
      );
    }
    const changed = await handoffRuntime.service.edit(
      p,
      hn.id,
      { ...desired(6), credentialAlias: 'fixture-rotated', expectedVersion: 1 },
      randomUUID(),
    );
    assert.equal(changed.kind, 'edited');
    const projection = (
      await runtime.query(
        'SELECT * FROM public.pbx_handoff_fixture WHERE node_id=$1',
        [hn.id],
      )
    ).rows[0];
    assert.equal(projection.version, 2);
    assert.equal(projection.generation, 2);
    assert.equal(projection.current, false);
    assert.equal(
      (
        await handoffRuntime.service.edit(
          p,
          hn.id,
          {
            ...desired(6),
            displayName: 'Renamed',
            credentialAlias: 'fixture-rotated',
            expectedVersion: 2,
          },
          randomUUID(),
        )
      ).kind,
      'edited',
    );
    assert.equal(
      (
        await runtime.query(
          'SELECT * FROM public.pbx_handoff_fixture WHERE node_id=$1',
          [hn.id],
        )
      ).rows[0].generation,
      2,
    );
    console.log(
      'PASS PBX A-04: version races, rotation keeps permanent identity, original replay and same-transaction invalidation/intent success/total rollback',
    );

    // Backdate only the fixture receipt under trusted owner control to prove expiry.
    await owner.query(
      'ALTER TABLE public.pbx_create_receipts DISABLE TRIGGER pbx_receipt_protection',
    );
    try {
      await owner.query(
        "UPDATE public.pbx_create_receipts SET created_at=clock_timestamp()-interval '31 days' WHERE request_id=$1",
        [lost.requestId],
      );
    } finally {
      await owner.query(
        'ALTER TABLE public.pbx_create_receipts ENABLE TRIGGER pbx_receipt_protection',
      );
    }
    assert.equal((await create(b, s, lost)).data.reason, 'intent_expired');
    await assert.rejects(
      owner.query(
        'DELETE FROM public.pbx_create_receipts WHERE request_id=$1',
        [attempt.requestId],
      ),
      (e) => e.code === '23514',
    );
    await owner.query(
      'DELETE FROM public.pbx_create_receipts WHERE request_id=$1',
      [lost.requestId],
    );
    assert.equal((await create(b, s, lost)).data.reason, 'target_conflict');

    const active = await operator(b);
    for (const path of [
      '/platform/pbx-nodes',
      `/platform/pbx-nodes/${node.id}`,
    ])
      assert.equal((await request(b, path)).status, 401);
    for (const headers of [
      { origin: 'https://evil.invalid' },
      { 'x-platform-proxy': 'bad' },
      { 'x-platform-csrf': 'bad' },
      { 'x-forwarded-for': 'bad' },
      { authorization: `Bearer ${active.token}` },
      {
        cookie: `__Host-myims-platform=${active.token}; __Host-myims-platform=${active.token}`,
      },
    ]) {
      const expected = headers.authorization || headers.cookie ? 401 : 403;
      assert.equal(
        (await create(b, active, data(7), { headers })).status,
        expected,
      );
      assert.equal(
        (
          await edit(
            b,
            active,
            node.id,
            { ...desired(0), expectedVersion: 3 },
            { headers },
          )
        ).status,
        expected,
      );
    }
    const expired = await operator(b);
    await redis.set(
      key(expired.token),
      JSON.stringify({
        ...expired.record,
        idleExpiresAt: Date.now() - 1,
        lastActivityAt: Date.now() - 2,
      }),
    );
    assert.equal((await create(b, expired, data(7))).status, 401);
    const revoked = await operator(a);
    assert.equal(
      (
        await a('revoke', revoked.token, {
          lifecycleId: revoked.record.lifecycleId,
          generation: revoked.record.generation,
        })
      ).kind,
      'revoked',
    );
    assert.equal((await create(b, revoked, data(7))).status, 401);
    const staff = (
      await owner.query(
        "SELECT id,tenant_id FROM public.staff_users WHERE normalized_username='session.staff'",
      )
    ).rows[0];
    const ss = await issue(b, {
      plane: 'tenant',
      identityId: staff.id,
      tenantId: staff.tenant_id,
      authenticationVersion: 1,
      tenantAuthorityVersion: 1,
    });
    sessions.push(ss);
    assert.equal((await create(b, ss, data(7))).status, 403);
    assert.equal(
      (await request(a, '/platform/pbx-nodes', { session: ss })).status,
      403,
    );
    const pgDown = await replica({
      runtimeUrl: appUrl.replace(/@[^/]+\//, '@127.0.0.1:1/'),
    });
    assert.equal(
      (await request(pgDown, '/platform/pbx-nodes', { session: active }))
        .status,
      503,
    );
    const fault = await proxy('pause');
    const redisDown = await replica({ redisUrl: fault.url });
    fault.arm();
    assert.equal((await create(redisDown, active, data(7))).status, 503);
    const stale = await operator(b),
      staleCount = await counts();
    await owner.query('BEGIN');
    await owner.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1",
      [stale.record.identityId],
    );
    const pending = create(b, stale, data(7));
    try {
      await barrier('%public.platform_operators%FOR SHARE');
    } finally {
      await owner.query('COMMIT');
    }
    assert.equal((await pending).status, 403);
    assert.deepEqual(await counts(), staleCount);
    console.log(
      'PASS PBX A-05: shared A/B platform sessions, passive reads, cookie/channel/CSRF/Origin, staff/revocation/expiry/current-authority and backing-service outage denial',
    );

    const file = join(directory, 'credential.json');
    await writeFile(
      file,
      JSON.stringify({
        username: 'PBX_USER_SENTINEL',
        password: 'PBX_SECRET_SENTINEL',
      }),
      { mode: 0o600 },
    );
    const resolver = new SecretFileCredentials(
      new Map([
        ['fixture-observer', file],
        ['missing', join(directory, 'missing')],
        ['directory', directory],
      ]),
    );
    assert.equal((await resolver.resolve('fixture-observer')).kind, 'resolved');
    assert.equal((await resolver.resolve('missing')).kind, 'secret_missing');
    assert.equal((await resolver.resolve('unknown')).kind, 'secret_missing');
    assert.equal(
      (await resolver.resolve('directory')).kind,
      'secret_unavailable',
    );
    await chmod(file, 0o644);
    assert.deepEqual(await resolver.resolve('fixture-observer'), {
      kind: 'secret_unavailable',
    });
    const inaccessibleDesired = await request(
      b,
      `/platform/pbx-nodes/${node.id}`,
      { session: active },
    );
    assert.equal(inaccessibleDesired.status, 200);
    assert.equal(
      inaccessibleDesired.data.node.credentialAlias,
      'fixture-observer',
    );
    assert.deepEqual(inaccessibleDesired.data.node.observation, {
      kind: 'not_available',
    });
    await chmod(file, 0o600);
    await symlink(file, join(directory, 'link'));
    assert.deepEqual(
      await new SecretFileCredentials(
        new Map([['link', join(directory, 'link')]]),
      ).resolve('link'),
      { kind: 'secret_unavailable' },
    );
    await writeFile(file, 'PBX_SECRET_SENTINEL');
    assert.deepEqual(await resolver.resolve('fixture-observer'), {
      kind: 'secret_unavailable',
    });
    await writeFile(
      file,
      JSON.stringify({
        username: 'PBX_USER_SENTINEL',
        password: 'rotated-material',
      }),
    );
    assert.equal(
      (await resolver.resolve('fixture-observer')).password,
      'rotated-material',
    );
    let answers = ['192.0.2.1'];
    const profile = profiles[0];
    let approvedProfile = profile;
    const approvedCatalog = {
      resolve: (a) => (a === profile.targetAlias ? approvedProfile : null),
    };
    const policy = new ExactPbxDestinationPolicy(
      approvedCatalog,
      async () => answers,
      20,
    );
    assert.equal((await policy.destination(profile)).kind, 'approved');
    for (const address of [
      '127.0.0.1',
      '169.254.169.254',
      '100.100.100.200',
      '168.63.129.16',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '::',
      'fe80::1',
      '::ffff:192.0.2.1',
      '::ffff:c000:201',
      'ff02::1',
      '192.0.2.2',
    ]) {
      answers = [address];
      assert.equal(
        (await policy.destination(profile)).kind,
        'destination_denied',
      );
    }
    answers = ['192.0.2.1', '169.254.169.254'];
    assert.equal(
      (await policy.destination(profile)).kind,
      'destination_denied',
    );
    answers = ['10.30.0.5'];
    approvedProfile = { ...profile, addresses: ['10.30.0.5'] };
    assert.equal(
      (await policy.destination({ ...profile, addresses: ['10.30.0.5'] })).kind,
      'approved',
    );
    answers = ['2001:db8::1'];
    approvedProfile = { ...profile, addresses: ['2001:db8::1'] };
    assert.equal(
      (
        await policy.destination({
          ...profile,
          addresses: ['2001:0db8:0:0:0:0:0:1'],
        })
      ).kind,
      'approved',
    );
    assert.equal(
      (await policy.destination({ ...profile, transport: 'http' })).kind,
      'destination_denied',
    );
    const blocked = new ExactPbxDestinationPolicy(
      approvedCatalog,
      async () => new Promise(() => {}),
      20,
    );
    const resolving = Array.from({ length: 4 }, () =>
      blocked.destination(profile),
    );
    assert.equal(
      (await blocked.destination(profile)).kind,
      'resolution_unavailable',
    );
    for (const result of await Promise.all(resolving))
      assert.equal(result.kind, 'resolution_unavailable');
    const controller = new globalThis.AbortController();
    controller.abort();
    assert.equal(
      (await policy.destination(profile, controller.signal)).kind,
      'resolution_unavailable',
    );
    const missingSave = await create(b, active, {
      ...data(7),
      credentialAlias: 'fixture-rotated',
    });
    assert.equal(missingSave.status, 201);
    assert.equal(
      (await resolver.resolve(missingSave.data.node.credentialAlias)).kind,
      'secret_missing',
    );
    assert.equal(
      (
        await request(a, `/platform/pbx-nodes/${missingSave.data.node.id}`, {
          session: active,
        })
      ).status,
      200,
    );
    const invalidCatalog = join(directory, 'invalid.json');
    await writeFile(
      invalidCatalog,
      JSON.stringify([{ ...profiles[0], providerPath: 'PBX_SECRET_SENTINEL' }]),
    );
    assert.throws(
      () => new FilePbxCatalog(invalidCatalog),
      (e) => !e.message.includes('PBX_SECRET_SENTINEL'),
    );
    console.log(
      'PASS PBX A-06: protected file resolution/rotation/missing/inaccessible sanitization, save independent of secret lookup and exact-address bounded/cancelled destination fixtures',
    );

    for (let i = 8; i < profiles.length; i++)
      assert.equal((await create(b, active, data(i))).status, 201);
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=1.5',
      'after=bad',
      'unknown=x',
      'limit=1&limit=2',
    ])
      assert.equal(
        (await request(b, `/platform/pbx-nodes?${query}`, { session: active }))
          .status,
        400,
      );
    assert.equal(
      (await request(b, '/platform/pbx-nodes/bad', { session: active })).status,
      400,
    );
    assert.equal(
      (
        await request(b, `/platform/pbx-nodes/${randomUUID()}`, {
          session: active,
        })
      ).status,
      404,
    );
    const page = await request(b, '/platform/pbx-nodes', { session: active });
    assert.equal(page.data.items.length, 25);
    assert.ok(page.data.nextCursor);
    const canonical = (
        await runtime.query('SELECT id FROM public.pbx_nodes ORDER BY id')
      ).rows.map((r) => r.id),
      seen = [];
    let cursor = null;
    do {
      const result = await request(
        b,
        `/platform/pbx-nodes?limit=5${cursor ? `&after=${cursor}` : ''}`,
        { session: active },
      );
      assert.equal(result.status, 200);
      seen.push(...result.data.items.map((n) => n.id));
      cursor = result.data.nextCursor;
    } while (cursor);
    assert.deepEqual(seen, canonical);
    const persisted = (
      await runtime.query(
        "SELECT row_to_json(a) AS data FROM public.audit_events a WHERE event_type='telephony.pbx.desired-changed' UNION ALL SELECT row_to_json(o) FROM public.outbox_work o WHERE work_type='fixture.pbx-reconcile' UNION ALL SELECT row_to_json(r) FROM public.pbx_create_receipts r",
      )
    ).rows;
    const safe = output.join('') + JSON.stringify(persisted);
    secrets.push('Controlled PBX');
    for (const sentinel of [
      'PBX_SECRET_SENTINEL',
      'PBX_USER_SENTINEL',
      file,
      config.proxySecret,
      config.csrfSecret,
    ])
      assert.ok(!safe.includes(sentinel), 'PBX private material leaked');
    const dtoSource = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        new URL('../packages/contracts/src/pbx-nodes.ts', import.meta.url),
        'utf8',
      ),
    );
    assert.ok(!dtoSource.includes('password'));
    assert.ok(!dtoSource.includes('providerPath'));
    console.log(
      'PASS PBX A-07: multiple independent installations/profiles, indexed bounded pagination and safe DTO/receipt/audit/outbox/client contract output',
    );
  } finally {
    await owner.query('ROLLBACK').catch(() => {});
    for (const c of calls) if (c.child.connected) await c('close');
    for (const s of sessions) await redis.del(key(s.token));
    await handoffRuntime?.onApplicationShutdown();
    await handoffDatabase?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
