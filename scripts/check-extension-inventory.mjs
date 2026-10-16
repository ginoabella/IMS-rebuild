import { checkEndpointCredentials } from './check-endpoint-credentials.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (p) => backend(`./dist/${p}.js`);
const { PlatformBrowser } = load(
  'modules/identity/adapters/http/platform-browser',
);
const { parseLimiterConfig, parseSessionConfig } = backend('@myims/config');
const { inventoryEligibility } = load('modules/telephony/domain/inventory');
const { InventoryRuntime } = load(
  'modules/telephony/adapters/db/inventory-runtime',
);
const { TransactionAuthority } = load(
  'modules/identity/application/transaction-authority',
);
const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
const { Transaction } = load('infrastructure/database/transaction');
const { SafeLogger } = load('infrastructure/execution/logging');
const { Pool } = backend('pg');
export async function checkExtensionInventory({
  processDiagnostics,
  endpointAccess,
  ownerUrl,
  owner,
  runtime,
  worker,
  redis,
  issue,
  key,
  secrets,
  appUrl,
  proxy,
  commitProxy,
}) {
  const directory = await mkdtemp(join(tmpdir(), 'myims-inventory-'));
  const catalogFile = join(directory, 'catalog.json');
  const targets = Array.from({ length: 3 }, (_, i) => ({
    installationId:
      i === 0 && endpointAccess?.installationId
        ? endpointAccess.installationId
        : randomUUID(),
    targetAlias: `inventory-${i}`,
    aliases: [`inventory-alias-${i}`],
    host: `pbx-${i}.fixture.invalid`,
    transport: 'ami-tls',
    port: 5039,
    tlsServerName: `pbx-${i}.fixture.invalid`,
    addresses: [`192.0.2.${i + 1}`],
    credentialAliases: ['fixture-observer'],
  }));
  await writeFile(catalogFile, JSON.stringify(targets), { mode: 0o600 });
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
    'INVENTORY_PRIVATE_SENTINEL',
  );
  let versionRuntime, versionDatabase, versionPool;
  async function replica(override = {}) {
    const c = await worker({
      http: true,
      productionHttp: true,
      pbxCatalogFile: catalogFile,
      config: parseSessionConfig({ SESSION_TIMEOUT_MS: '1000' }),
      browserConfig: config,
      limiterConfig: parseLimiterConfig({
        LIMITER_TRUSTED_PROXIES: '127.0.0.1',
        LIMITER_PLATFORM_PROTECTED_WINDOW_SECONDS: '1',
      }),
      ...override,
    });
    calls.push(c);
    return c;
  }
  async function operator(c) {
    const id = randomUUID();
    await owner.query(
      "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready','inventory-verifier',clock_timestamp())",
      [id, `inventory.${id}`],
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
            'x-forwarded-for': '192.0.2.117',
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
            if (
              path.includes('/extensions') ||
              path.includes('/endpoint-profiles')
            )
              output.push(text);
            resolve({
              status: res.statusCode,
              data: JSON.parse(text),
              headers: res.headers,
              text,
            });
          });
          res.on('error', reject);
        },
      );
      req.setTimeout(15000, () =>
        req.destroy(new Error('Inventory API deadline')),
      );
      req.on('error', reject);
      req.end(payload);
    });
  }
  const root = (node) => `/platform/pbx-nodes/${node.id}`;
  const post = (c, s, node, suffix, body, extra = {}) =>
    request(c, `${root(node)}/${suffix}`, {
      method: 'POST',
      session: s,
      body,
      ...extra,
    });
  const patch = (c, s, node, suffix, body, extra = {}) =>
    request(c, `${root(node)}/${suffix}`, {
      method: 'PATCH',
      session: s,
      body,
      ...extra,
    });
  const get = (c, s, node, suffix) =>
    request(c, `${root(node)}/${suffix}`, { session: s });
  const profileInput = (template, name = template) => ({
    requestId: randomUUID(),
    name,
    template,
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  });
  const deps = (profile, extra = {}) => ({
    profileId: profile.id,
    profileVersion: profile.version,
    expectedProfileHead: profile.headVersion,
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
    ...extra,
  });
  const single = (profile, number, extra = {}) => ({
    requestId: randomUUID(),
    kind: profile.kind,
    number,
    ...deps(profile),
    ...extra,
  });
  const bulk = (profile, numbers, extra = {}) => ({
    requestId: randomUUID(),
    kind: profile.kind,
    numbers,
    ...deps(profile),
    ...extra,
  });
  async function counts() {
    return (
      await owner.query(
        "SELECT (SELECT count(*)::int FROM public.extensions) AS extensions,(SELECT count(*)::int FROM public.endpoint_profiles) AS profiles,(SELECT count(*)::int FROM public.endpoint_profile_versions) AS versions,(SELECT count(*)::int FROM public.inventory_receipts) AS receipts,(SELECT count(*)::int FROM public.audit_events WHERE event_type='telephony.inventory.desired-changed') AS audit,(SELECT count(*)::int FROM public.outbox_work) AS outbox",
      )
    ).rows[0];
  }
  async function barrier(pattern, n = 1) {
    for (let i = 0; i < 220; i++) {
      await owner.query('SELECT pg_stat_clear_snapshot()');
      const r = await owner.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
        [pattern],
      );
      if (r.rows[0].n >= n) return;
      await delay(5);
    }
    throw new Error(`Inventory barrier not reached: ${pattern}`);
  }
  async function race(left, right) {
    await owner.query('BEGIN');
    await owner.query('LOCK TABLE public.inventory_receipts IN SHARE MODE');
    const x = left(),
      y = right();
    try {
      await barrier('INSERT INTO public.inventory_receipts%');
      await barrier('%', 2);
    } finally {
      await owner.query('COMMIT');
    }
    return Promise.all([x, y]);
  }
  try {
    const a = await replica(),
      b = await replica(),
      s = await operator(a),
      other = await operator(b);
    const nodes = [];
    for (let i = 0; i < targets.length; i++) {
      const created = await request(a, '/platform/pbx-nodes', {
        method: 'POST',
        session: s,
        body: {
          requestId: randomUUID(),
          displayName: `Inventory node ${i}`,
          management: {
            targetAlias: targets[i].targetAlias,
            transport: 'ami-tls',
            port: 5039,
          },
          credentialAlias: 'fixture-observer',
        },
      });
      assert.equal(created.status, 201);
      nodes.push(created.data.node);
    }
    const capabilityFile = join(directory, 'capabilities.json');
    const declarations = targets.slice(0, 2).map((t) => ({
      installationId: t.installationId,
      revision: 1,
      kinds: ['sip', 'webrtc'],
      signaling: ['udp', 'wss'],
      codecs: ['opus', 'ulaw', 'alaw'],
      media: ['none', 'dtls-srtp'],
    }));
    await writeFile(capabilityFile, JSON.stringify(declarations), {
      mode: 0o600,
    });
    const deployCapabilities = () =>
      promisify(execFile)(
        process.execPath,
        [
          'services/backend/dist/entrypoints/deployment/main.js',
          'declare-endpoint-capabilities',
          capabilityFile,
        ],
        {
          env: {
            ...process.env,
            DATABASE_URL: appUrl,
            DATABASE_PASSWORD_FILE: undefined,
            MIGRATION_DATABASE_URL: ownerUrl,
            MIGRATION_DATABASE_PASSWORD_FILE: undefined,
          },
          timeout: 15000,
        },
      );
    for (let i = 0; i < 2; i++)
      assert.equal(
        JSON.parse((await deployCapabilities()).stdout).capabilityDeclarations,
        2,
      );
    await writeFile(
      capabilityFile,
      JSON.stringify([{ ...declarations[0], signaling: ['wss'] }]),
      { mode: 0o600 },
    );
    await assert.rejects(deployCapabilities());
    assert.deepEqual(
      (
        await runtime.query(
          'SELECT signaling FROM public.endpoint_capabilities WHERE installation_id=$1',
          [targets[0].installationId],
        )
      ).rows[0].signaling,
      ['udp', 'wss'],
    );
    const node = nodes[0];
    const alias = await request(b, '/platform/pbx-nodes', {
      method: 'POST',
      session: s,
      body: {
        requestId: randomUUID(),
        displayName: 'Equivalent installation',
        management: {
          targetAlias: targets[0].aliases[0],
          transport: 'ami-tls',
          port: 5039,
        },
        credentialAlias: 'fixture-observer',
      },
    });
    assert.equal(alias.data.reason, 'target_conflict');
    assert.equal(
      (
        await post(
          a,
          s,
          nodes[2],
          'endpoint-profiles',
          profileInput('sip-basic'),
        )
      ).status,
      503,
    );
    const before = await counts(),
      sipAttempt = profileInput('sip-basic');
    const sipCreated = await post(a, s, node, 'endpoint-profiles', sipAttempt);
    assert.equal(sipCreated.status, 201);
    const sip = sipCreated.data.profile;
    const web = (
      await post(b, s, node, 'endpoint-profiles', profileInput('webrtc-basic'))
    ).data.profile;
    const alternate = (
      await post(
        a,
        s,
        node,
        'endpoint-profiles',
        profileInput('sip-basic', 'Alternate SIP'),
      )
    ).data.profile;
    const secondSip = (
      await post(a, s, nodes[1], 'endpoint-profiles', profileInput('sip-basic'))
    ).data.profile;
    assert.deepEqual(sip.settings.codecs, ['ulaw', 'alaw']);
    assert.equal(web.settings.signaling, 'wss');
    assert.equal(sip.settings.removeExisting, false);
    assert.deepEqual(
      (
        await post(b, s, node, 'endpoint-profiles', {
          ...sipAttempt,
          name: ' sip-basic ',
        })
      ).data,
      sipCreated.data,
    );
    assert.equal(
      (
        await post(
          b,
          s,
          node,
          'endpoint-profiles',
          profileInput('sip-basic', 'SIP-BASIC'),
        )
      ).data.reason,
      'profile_name_conflict',
    );
    assert.equal(
      (
        await post(b, s, node, 'endpoint-profiles', {
          ...sipAttempt,
          name: 'Changed',
        })
      ).data.reason,
      'request_conflict',
    );
    const attempt = single(sip, ' 1001 '),
      created = await post(a, s, node, 'extensions', attempt);
    assert.equal(created.status, 201);
    const extension = created.data.extension;
    assert.equal(extension.number, '1001');
    assert.equal(extension.administrativeStatus, 'disabled');
    assert.equal(extension.availability, 'available');
    assert.equal(extension.version, 1);
    assert.deepEqual(extension.credentials, { kind: 'unset' });
    assert.deepEqual(extension.readiness, { kind: 'not_established' });
    assert.deepEqual(extension.observation, { kind: 'not_available' });
    assert.deepEqual(extension.eligibility, {
      eligible: false,
      reasons: ['unallocated', 'disabled'],
    });
    assert.equal(extension.createdBy, s.record.identityId);
    const firstAudit = (
      await runtime.query(
        "SELECT actor_reference,actor_kind,identity_plane,tenant_id,metadata FROM public.audit_events WHERE event_type='telephony.inventory.desired-changed' AND metadata->>'extension1'=$1",
        [extension.id],
      )
    ).rows;
    assert.equal(firstAudit.length, 1);
    assert.equal(firstAudit[0].actor_reference, s.record.identityId);
    assert.equal(firstAudit[0].actor_kind, 'platform_operator');
    assert.equal(firstAudit[0].identity_plane, 'platform');
    assert.equal(firstAudit[0].tenant_id, null);
    assert.equal(firstAudit[0].metadata.nodeId, node.id);

    assert.deepEqual(
      (await get(b, s, node, `extensions/${extension.id}`)).data,
      created.data,
    );
    assert.equal(
      (await get(b, s, node, `extensions/${extension.id}`)).headers[
        'cache-control'
      ],
      'no-store',
    );
    assert.deepEqual(
      (await post(b, s, node, 'extensions', { ...attempt, number: '1001' }))
        .data,
      created.data,
    );
    for (const p of [sip, web, alternate])
      assert.equal(
        (await post(b, s, node, 'extensions', single(p, '1001'))).data.reason,
        'number_conflict',
      );
    assert.equal(
      (await post(b, other, node, 'extensions', attempt)).data.reason,
      'number_conflict',
    );
    assert.equal(
      (await post(b, s, nodes[1], 'extensions', single(secondSip, '1001')))
        .status,
      201,
    );
    const runtimeKeys = (
      await runtime.query(
        'SELECT installation_id,endpoint_key,auth_key,aor_key FROM public.extensions WHERE id=$1',
        [extension.id],
      )
    ).rows[0];
    for (const [field, prefix] of [
      ['endpoint_key', 'e'],
      ['auth_key', 'a'],
      ['aor_key', 'r'],
    ]) {
      assert.equal(
        runtimeKeys[field],
        `ims-${prefix}-${node.installationId.replaceAll('-', '')}-${extension.id.replaceAll('-', '')}`,
      );
      assert.equal(runtimeKeys[field].length, 71);
    }
    assert.equal(
      (await post(a, s, node, 'extensions', single(web, '1002'))).status,
      201,
    );
    const after = await counts();
    assert.equal(after.audit, before.audit + 7);
    assert.equal(after.outbox, before.outbox);
    console.log(
      'PASS inventory A-01/02: runtime-granted SIP/WebRTC, exact namespace, canonical alias/kind/profile/disabled conflicts, distinct-node reuse, safe states and attributed atomic audit',
    );
    if (endpointAccess) {
      await checkEndpointCredentials({
        replica,
        proxy,
        commitProxy,
        key,
        sessions,
        patch,
        processDiagnostics,
        apiOnly: endpointAccess.apiOnly,
        otherNode: nodes[1],
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
      });
      return;
    }

    const invalidBefore = await counts();
    const invalidNumbers = [
      1003,
      '01003',
      '911',
      '900000',
      '1e4',
      '１003',
      '1003\t',
      '\n1003',
      '+1003',
      '10 03',
      '1003#',
      ' '.repeat(33),
    ];
    for (const n of invalidNumbers)
      assert.equal(
        (await post(a, s, node, 'extensions', single(sip, n))).status,
        400,
      );
    for (const field of [
      'tenantId',
      'staffId',
      'registered',
      'readiness',
      'availability',
      'credentials',
      'endpointKey',
      'actorId',
      'context',
      'rawConfiguration',
    ])
      assert.equal(
        (
          await post(
            a,
            s,
            node,
            'extensions',
            single(sip, '1003', { [field]: 'INVENTORY_PRIVATE_SENTINEL' }),
          )
        ).status,
        400,
      );
    for (const body of [
      null,
      [],
      {},
      { ...bulk(sip, ['1003']), numbers: [] },
      bulk(sip, ['1003', ' 1003 ']),
      bulk(
        sip,
        Array.from({ length: 51 }, (_, i) => String(2000 + i)),
      ),
      { ...bulk(sip, ['1003']), range: { start: '1003', end: '1004' } },
      { ...bulk(sip, undefined), range: { start: '1100', end: '1003' } },
      { ...bulk(sip, undefined), range: { start: '1003', end: '1053' } },
    ])
      assert.equal(
        (await post(a, s, node, 'extensions/bulk', body)).status,
        400,
      );
    for (const body of [
      profileInput('sip-basic', '[injection]\n'),
      profileInput('sip-basic', '\ud800'),
      {
        ...profileInput('sip-basic', 'x'),
        settings: { codecs: ['opus'], maxContacts: 1 },
      },
      {
        ...profileInput('webrtc-basic', 'x'),
        settings: { codecs: ['opus', 'opus'], maxContacts: 1 },
      },
      {
        ...profileInput('sip-basic', 'x'),
        settings: { codecs: ['ulaw'], maxContacts: 6 },
      },
      ...['transport', 'context', 'certificate', 'password', 'raw'].map(
        (k) => ({
          ...profileInput('sip-basic', 'x'),
          [k]: 'INVENTORY_PRIVATE_SENTINEL',
        }),
      ),
      {
        ...profileInput('sip-basic', 'x'),
        settings: { codecs: ['ulaw'], maxContacts: 1, removeExisting: true },
      },
    ])
      assert.equal(
        (await post(a, s, node, 'endpoint-profiles', body)).status,
        400,
      );
    assert.equal((await post(a, s, node, 'extensions', '{broken')).status, 400);
    const oversized = await post(
      a,
      s,
      node,
      'extensions',
      JSON.stringify({ raw: 'x'.repeat(5000) }),
    );
    assert.ok([400, 413].includes(oversized.status));
    assert.equal(
      (await post(a, s, node, 'extensions?unknown=x', single(sip, '1003')))
        .status,
      400,
    );
    assert.equal(
      (
        await post(
          a,
          s,
          node,
          'extensions',
          single(sip, '1003', { profileId: secondSip.id }),
        )
      ).status,
      404,
      'Cross-node resource must be safely missing',
    );
    assert.equal(
      (await get(b, s, nodes[1], `extensions/${extension.id}`)).status,
      404,
      'Cross-node extension detail',
    );
    assert.equal(
      (await get(b, s, nodes[1], `endpoint-profiles/${sip.id}/versions/1`))
        .status,
      404,
      'Cross-node profile detail',
    );
    assert.deepEqual(await counts(), invalidBefore);
    for (const sql of [
      'DELETE FROM public.extensions',
      'TRUNCATE public.extensions',
      'DELETE FROM public.endpoint_profiles',
      'UPDATE public.endpoint_profile_versions SET name=name',
      'DELETE FROM public.inventory_receipts',
      'UPDATE public.inventory_receipts SET fingerprint=fingerprint',
      'CREATE TABLE public.inventory_forbidden(id int)',
      'ALTER TABLE public.extensions DISABLE TRIGGER ALL',
      'UPDATE public.endpoint_capabilities SET installation_id=installation_id',
      'INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) SELECT installation_id,revision,kinds,signaling,codecs,media FROM public.endpoint_capabilities',
    ])
      await assert.rejects(runtime.query(sql), (e) => e.code === '42501');
    await assert.rejects(
      runtime.query('UPDATE public.extensions SET number=$2 WHERE id=$1', [
        extension.id,
        '1009',
      ]),
      (e) => e.code === '42501',
    );
    await assert.rejects(
      runtime.query(
        'UPDATE public.extensions SET administrative_status=$2 WHERE id=$1',
        [extension.id, 'enabled'],
      ),
      (e) => e.code === '23514',
    );
    await assert.rejects(
      owner.query(
        'UPDATE public.extensions SET endpoint_key=$2,version=version+1 WHERE id=$1',
        [extension.id, '1001'],
      ),
      (e) => e.code === '23514',
    );
    for (const unsafe of [
      { ...sip.settings, context: 'INVENTORY_PRIVATE_SENTINEL' },
      { ...sip.settings, signaling: 'wss' },
      { ...sip.settings, mediaEncryption: 'dtls-srtp' },
      { ...sip.settings, codecs: ['opus'] },
      { ...sip.settings, codecs: ['ulaw', 'ulaw'] },
      { ...sip.settings, codecs: 'ulaw' },
      { ...sip.settings, removeExisting: true },
    ])
      await assert.rejects(
        runtime.query(
          "INSERT INTO public.endpoint_profile_versions(profile_id,version,node_id,kind,name,settings,capability_revision,created_by) VALUES($1,99,$2,'sip','Unsafe SQL fixture',$3,1,$4)",
          [sip.id, node.id, unsafe, s.record.identityId],
        ),
        (e) => e.code === '23514',
      );
    await assert.rejects(
      owner.query(
        'UPDATE public.endpoint_profile_versions SET name=name WHERE profile_id=$1',
        [sip.id],
      ),
      (e) => e.code === '23514',
    );
    console.log(
      'PASS inventory A-02/04/05/06: strict bounded input, injection/forged states, cross-node references, immutable versions/identities and deployment-only grants',
    );

    const previewBody = {
      kind: 'sip',
      numbers: ['1102', ' 1100 ', '1101'],
      ...deps(sip),
    };
    const sessionBefore = await redis.get(key(s.token));
    const preview = await post(
      a,
      s,
      node,
      'extensions/bulk-preview',
      previewBody,
    );
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.data.numbers, ['1100', '1101', '1102']);
    assert.equal(preview.data.advisory, true);
    await get(b, s, node, 'extensions');
    await get(b, s, node, 'endpoint-profiles');
    assert.equal(await redis.get(key(s.token)), sessionBefore);
    const committed = await post(b, s, node, 'extensions/bulk', {
      ...previewBody,
      requestId: randomUUID(),
    });
    assert.equal(committed.status, 201);
    assert.deepEqual(
      committed.data.items.map((e) => e.number),
      ['1100', '1101', '1102'],
    );
    const conflictBefore = await counts();
    assert.equal(
      (
        await post(
          a,
          s,
          node,
          'extensions/bulk',
          bulk(sip, ['1099', '1100', '1103']),
        )
      ).data.reason,
      'number_conflict',
    );
    assert.deepEqual(await counts(), conflictBefore);
    const versionAttempt = {
      requestId: randomUUID(),
      name: 'SIP revision 2',
      settings: { codecs: ['alaw'], maxContacts: 2 },
      expectedVersion: 1,
      expectedNodeVersion: 1,
      expectedCapabilityRevision: 1,
    };
    const revised = await post(
      b,
      s,
      node,
      `endpoint-profiles/${sip.id}/versions`,
      versionAttempt,
    );
    assert.equal(revised.status, 201);
    const sip2 = revised.data.profile;
    assert.equal(sip2.version, 2);
    assert.deepEqual(
      (
        await post(
          a,
          s,
          node,
          `endpoint-profiles/${sip.id}/versions`,
          versionAttempt,
        )
      ).data,
      revised.data,
    );
    assert.equal(
      (await get(a, s, node, `extensions/${extension.id}`)).data.extension
        .profile.version,
      1,
    );
    const oldProfile = (
      await get(b, s, node, `endpoint-profiles/${sip.id}/versions/1`)
    ).data.profile;
    assert.deepEqual(oldProfile.settings, sip.settings);
    assert.equal(oldProfile.headVersion, 2);
    const changedBefore = await counts();
    assert.equal(
      (
        await post(a, s, node, 'extensions/bulk', {
          ...previewBody,
          requestId: randomUUID(),
          numbers: ['1110', '1111'],
        })
      ).data.reason,
      'dependency_changed',
    );
    assert.deepEqual(await counts(), changedBefore);
    const adopted = await patch(a, s, node, `extensions/${extension.id}`, {
      expectedVersion: 1,
      ...deps(sip2),
    });
    assert.equal(adopted.status, 200);
    assert.equal(adopted.data.extension.version, 2);
    assert.equal(adopted.data.extension.profile.version, 2);
    assert.equal(
      (
        await patch(b, s, node, `extensions/${extension.id}`, {
          expectedVersion: 1,
          ...deps(sip2),
        })
      ).data.reason,
      'stale_version',
    );
    const noOpBefore = await counts();
    assert.equal(
      (
        await patch(b, s, node, `extensions/${extension.id}`, {
          expectedVersion: 2,
          ...deps(sip2),
        })
      ).data.extension.version,
      2,
    );
    assert.deepEqual(await counts(), noOpBefore);
    assert.equal(
      (
        await post(a, s, node, `endpoint-profiles/${sip.id}/versions`, {
          ...versionAttempt,
          requestId: randomUUID(),
        })
      ).data.reason,
      'stale_version',
    );
    assert.equal(
      (await post(a, s, node, 'extensions', { ...attempt, number: '1001' }))
        .status,
      200,
    ); // Original replay precedes changed dependencies.
    assert.equal(
      (
        await post(
          a,
          s,
          node,
          'extensions',
          single(sip2, '1110', { expectedNodeVersion: 2 }),
        )
      ).data.reason,
      'dependency_changed',
    );
    await owner.query(
      "UPDATE public.endpoint_capabilities SET revision=2,kinds=ARRAY['sip'],signaling=ARRAY['udp'],codecs=ARRAY['ulaw','alaw'],media=ARRAY['none'] WHERE installation_id=$1",
      [node.installationId],
    );
    assert.equal(
      (await post(a, s, node, 'extensions', single(sip2, '1110'))).data.reason,
      'dependency_changed',
    );
    assert.equal(
      (
        await post(
          a,
          s,
          node,
          'extensions',
          single(web, '1110', { expectedCapabilityRevision: 2 }),
        )
      ).status,
      400,
    );
    await owner.query(
      "UPDATE public.endpoint_capabilities SET revision=3,kinds=ARRAY['sip','webrtc'],signaling=ARRAY['udp','wss'],codecs=ARRAY['opus','ulaw','alaw'],media=ARRAY['none','dtls-srtp'] WHERE installation_id=$1",
      [node.installationId],
    );
    const fresh = (p, n, extra = {}) =>
      single(p, n, { expectedCapabilityRevision: 3, ...extra });
    const freshBulk = (p, n, extra = {}) =>
      bulk(p, n, { expectedCapabilityRevision: 3, ...extra });
    console.log(
      'PASS inventory A-03/04: passive advisory preview, atomic conflict, pinned immutable profiles, explicit adoption/stale/no-op and changed node/profile/capability rejection',
    );

    for (const [table, condition] of [
      ['audit_events', "event_type<>'telephony.inventory.desired-changed'"],
      ['inventory_receipts', 'false'],
    ]) {
      const count = await counts();
      await owner.query(
        `ALTER TABLE public.${table} ADD CONSTRAINT inventory_fault CHECK (${condition}) NOT VALID`,
      );
      try {
        assert.equal(
          (
            await post(
              a,
              s,
              node,
              'extensions/bulk',
              freshBulk(sip2, ['1200', '1201']),
            )
          ).status,
          503,
        );
        assert.deepEqual(await counts(), count);
        assert.equal(
          (await post(a, s, node, 'extensions', fresh(sip2, '1200'))).status,
          503,
        );
        assert.equal(
          (
            await post(a, s, node, 'endpoint-profiles', {
              ...profileInput('sip-basic', 'Rollback profile'),
              expectedCapabilityRevision: 3,
            })
          ).status,
          503,
        );
        assert.equal(
          (
            await post(a, s, node, `endpoint-profiles/${sip.id}/versions`, {
              ...versionAttempt,
              requestId: randomUUID(),
              expectedVersion: 2,
              expectedCapabilityRevision: 3,
            })
          ).status,
          503,
        );
        assert.deepEqual(await counts(), count);
      } finally {
        await owner.query(
          `ALTER TABLE public.${table} DROP CONSTRAINT inventory_fault`,
        );
      }
    }
    const same = freshBulk(sip2, ['1210', '1211']),
      raceBefore = await counts();
    const identical = await race(
      () => post(a, s, node, 'extensions/bulk', same),
      () =>
        post(b, s, node, 'extensions/bulk', {
          ...same,
          numbers: [' 1211 ', '1210'],
        }),
    );
    assert.deepEqual(identical.map((r) => r.status).sort(), [200, 201]);
    assert.deepEqual(identical[0].data, identical[1].data);
    const afterSame = await counts();
    assert.equal(afterSame.extensions, raceBefore.extensions + 2);
    assert.equal(afterSame.audit, raceBefore.audit + 1);
    assert.equal(afterSame.receipts, raceBefore.receipts + 1);
    const overlapBefore = await counts();
    const overlap = await race(
      () =>
        post(a, s, node, 'extensions/bulk', freshBulk(sip2, ['1220', '1221'])),
      () =>
        post(b, s, node, 'extensions/bulk', freshBulk(web, ['1221', '1222'])),
    );
    assert.deepEqual(overlap.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      overlap.find((r) => r.status === 409).data.reason,
      'number_conflict',
    );
    assert.equal((await counts()).extensions, overlapBefore.extensions + 2);
    const numberRace = await race(
      () => post(a, s, node, 'extensions', fresh(sip2, '1230')),
      () => post(b, s, node, 'extensions', fresh(web, '1230')),
    );
    assert.deepEqual(numberRace.map((r) => r.status).sort(), [201, 409]);
    const reused = freshBulk(sip2, ['1240', '1241']);
    const reuse = await race(
      () => post(a, s, node, 'extensions/bulk', reused),
      () =>
        post(b, s, node, 'extensions/bulk', {
          ...reused,
          numbers: ['1242', '1243'],
        }),
    );
    assert.deepEqual(reuse.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      reuse.find((r) => r.status === 409).data.reason,
      'request_conflict',
    );
    const profileRace = profileInput('sip-basic', 'Concurrent profile');
    profileRace.expectedCapabilityRevision = 3;
    const profilesRace = await race(
      () => post(a, s, node, 'endpoint-profiles', profileRace),
      () => post(b, s, node, 'endpoint-profiles', profileRace),
    );
    assert.deepEqual(profilesRace.map((r) => r.status).sort(), [200, 201]);
    assert.deepEqual(profilesRace[0].data, profilesRace[1].data);
    // Hold one number; unrelated numbers on the same node must still commit.
    await owner.query('BEGIN');
    await owner.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `extension-number:${node.id}:1250`,
    ]);
    const blocked = post(
      a,
      s,
      node,
      'extensions/bulk',
      freshBulk(sip2, ['1250', '1251']),
    );
    try {
      await barrier('SELECT pg_advisory_xact_lock%');
      assert.equal(
        (
          await post(
            b,
            s,
            node,
            'extensions/bulk',
            freshBulk(sip2, ['1260', '1261']),
          )
        ).status,
        201,
      );
    } finally {
      await owner.query('COMMIT');
    }
    assert.equal((await blocked).status, 201);
    const lost = freshBulk(sip2, ['1270', '1271']),
      lostBefore = await counts();
    assert.equal(
      (await post(a, s, node, 'extensions/bulk', lost, { drop: true })).lost,
      true,
    );
    assert.equal((await post(b, s, node, 'extensions/bulk', lost)).status, 200);
    assert.equal((await counts()).audit, lostBefore.audit + 1);
    const uncertainProxy = await commitProxy(
        /INSERT INTO public\.inventory_receipts/,
      ),
      uncertainReplica = await replica({ runtimeUrl: uncertainProxy.url }),
      uncertain = freshBulk(sip2, ['1280', '1281']),
      uncertainBefore = await counts();
    assert.equal(
      (await post(uncertainReplica, s, node, 'extensions/bulk', uncertain))
        .status,
      503,
    );
    assert.equal(uncertainProxy.dropped(), true);
    assert.equal((await counts()).extensions, uncertainBefore.extensions + 2);
    await uncertainReplica('close');
    const restarted = await replica();
    assert.equal(
      (await post(restarted, s, node, 'extensions/bulk', uncertain)).status,
      200,
    );
    assert.equal((await counts()).audit, uncertainBefore.audit + 1);
    console.log(
      'PASS inventory A-02/03: audit/receipt total rollback, barrier-controlled overlap/individual/profile/same-intent races, independent progress and actual HTTP/COMMIT loss replay',
    );

    const enabled = await patch(
      a,
      s,
      node,
      `extensions/${extension.id}/status`,
      { expectedVersion: 2, administrativeStatus: 'enabled' },
    );
    assert.equal(enabled.status, 200);
    assert.equal(enabled.data.extension.version, 3);
    assert.deepEqual(enabled.data.extension.eligibility, {
      eligible: false,
      reasons: ['unallocated'],
    });
    assert.deepEqual(enabled.data.extension.credentials, { kind: 'unset' });
    const editRaceBefore = await counts();
    await owner.query('BEGIN');
    await owner.query(
      'SELECT id FROM public.extensions WHERE id=$1 FOR UPDATE',
      [extension.id],
    );
    const x = patch(a, s, node, `extensions/${extension.id}/status`, {
        expectedVersion: 3,
        administrativeStatus: 'disabled',
      }),
      y = patch(b, s, node, `extensions/${extension.id}`, {
        expectedVersion: 3,
        ...deps(alternate, { expectedCapabilityRevision: 3 }),
      });
    try {
      await barrier('SELECT * FROM public.extensions%FOR UPDATE', 2);
    } finally {
      await owner.query('COMMIT');
    }
    const statusRace = await Promise.all([x, y]);
    assert.deepEqual(statusRace.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await counts()).audit, editRaceBefore.audit + 1);
    let current = (await get(b, s, node, `extensions/${extension.id}`)).data
      .extension;
    const disabled = await patch(
      a,
      s,
      node,
      `extensions/${extension.id}/status`,
      { expectedVersion: current.version, administrativeStatus: 'disabled' },
    );
    assert.equal(disabled.status, 200);
    current = disabled.data.extension;
    assert.equal(current.id, extension.id);
    assert.equal(current.number, '1001');
    assert.equal(current.createdAt, extension.createdAt);
    assert.equal(
      (await post(a, s, node, 'extensions', fresh(sip2, '1001'))).data.reason,
      'number_conflict',
    );
    assert.deepEqual(inventoryEligibility('disabled'), {
      eligible: false,
      reasons: ['unallocated', 'disabled'],
    });
    assert.deepEqual(inventoryEligibility('enabled'), {
      eligible: false,
      reasons: ['unallocated'],
    });
    // Exact b handoff against real row locks, with injected concurrent desired edit.
    versionDatabase = new SnapshotDatabase(appUrl);
    versionRuntime = new InventoryRuntime(
      appUrl,
      new TransactionAuthority(
        { lockedById: async () => ({ kind: 'denied' }) },
        new (load(
          'modules/platform/adapters/db/authority-read',
        ).PlatformAuthorityRepository)(versionDatabase),
      ),
    );
    versionPool = new Pool({ connectionString: appUrl });
    const context = {
      actor: {
        kind: 'platform_operator',
        reference: s.record.identityId,
        plane: 'platform',
        tenantId: null,
      },
      target: {
        type: 'extension-inventory',
        reference: node.id,
        tenantId: null,
      },
      correlationId: randomUUID(),
    };
    const logger = new SafeLogger('http', () => {});
    await Transaction.run(
      versionPool,
      context,
      'fixture.inventory-handoff',
      logger,
      async (tx) => {
        const locked = await versionRuntime.service.lockUnallocated(
          tx,
          node.id,
          current.id,
          current.version,
        );
        assert.equal(locked.id, current.id);
      },
    );
    await assert.rejects(
      Transaction.run(
        versionPool,
        context,
        'fixture.inventory-handoff',
        logger,
        (tx) =>
          versionRuntime.service.lockUnallocated(
            tx,
            node.id,
            current.id,
            current.version - 1,
          ),
      ),
      (e) => e.outcome?.reason === 'stale_version',
    );
    await assert.rejects(
      Transaction.run(
        versionPool,
        context,
        'fixture.inventory-handoff',
        logger,
        (tx) =>
          versionRuntime.service.lockUnallocated(
            tx,
            nodes[1].id,
            current.id,
            current.version,
          ),
      ),
      (e) => e.outcome?.kind === 'missing',
    );
    let releaseVersion;
    const versionGate = new Promise((resolve) => {
      releaseVersion = resolve;
    });
    let signalLocked;
    const versionLocked = new Promise((resolve) => {
      signalLocked = resolve;
    });
    const heldVersion = Transaction.run(
      versionPool,
      context,
      'fixture.inventory-handoff',
      logger,
      async (tx) => {
        await versionRuntime.service.lockUnallocated(
          tx,
          node.id,
          current.id,
          current.version,
        );
        signalLocked();
        await versionGate;
      },
    );
    await versionLocked;
    const handoffEdit = patch(a, s, node, `extensions/${extension.id}/status`, {
      expectedVersion: current.version,
      administrativeStatus: 'enabled',
    });
    try {
      await barrier('SELECT * FROM public.extensions%FOR UPDATE');
    } finally {
      releaseVersion();
    }
    await heldVersion;
    const afterHandoff = await handoffEdit;
    assert.equal(afterHandoff.status, 200);
    current = afterHandoff.data.extension;
    console.log(
      'PASS inventory A-05: versioned status/adoption race, retained reservation/history, no tenant eligibility and exact transaction-bound b lock/version handoff',
    );

    // Trusted owner-only expiry fixture. Runtime cannot edit or prune receipts.
    await owner.query(
      'ALTER TABLE public.inventory_receipts DISABLE TRIGGER inventory_receipt_protection',
    );
    try {
      await owner.query(
        "UPDATE public.inventory_receipts SET created_at=clock_timestamp()-interval '31 days' WHERE request_id=$1",
        [lost.requestId],
      );
    } finally {
      await owner.query(
        'ALTER TABLE public.inventory_receipts ENABLE TRIGGER inventory_receipt_protection',
      );
    }
    assert.equal(
      (await post(a, s, node, 'extensions/bulk', lost)).data.reason,
      'intent_expired',
    );
    await assert.rejects(
      owner.query('DELETE FROM public.inventory_receipts WHERE request_id=$1', [
        attempt.requestId,
      ]),
      (e) => e.code === '23514',
    );
    await owner.query(
      'DELETE FROM public.inventory_receipts WHERE request_id=$1',
      [lost.requestId],
    );
    assert.equal(
      (await post(a, s, node, 'extensions/bulk', lost)).data.reason,
      'number_conflict',
    );
    const active = await operator(b);
    const routeCases = [
      ['GET', 'extensions'],
      ['GET', `extensions/${extension.id}`],
      ['POST', 'extensions', fresh(sip2, '1300')],
      [
        'POST',
        'extensions/bulk-preview',
        {
          kind: 'sip',
          numbers: ['1300'],
          ...deps(sip2, { expectedCapabilityRevision: 3 }),
        },
      ],
      ['POST', 'extensions/bulk', freshBulk(sip2, ['1300'])],
      [
        'PATCH',
        `extensions/${extension.id}`,
        {
          expectedVersion: current.version,
          ...deps(sip2, { expectedCapabilityRevision: 3 }),
        },
      ],
      [
        'PATCH',
        `extensions/${extension.id}/status`,
        { expectedVersion: current.version, administrativeStatus: 'enabled' },
      ],
      ['GET', 'endpoint-profiles'],
      ['GET', `endpoint-profiles/${sip.id}/versions/1`],
      [
        'POST',
        'endpoint-profiles',
        {
          ...profileInput('sip-basic', 'Protected'),
          expectedCapabilityRevision: 3,
        },
      ],
      [
        'POST',
        `endpoint-profiles/${sip.id}/versions`,
        {
          ...versionAttempt,
          expectedVersion: 2,
          requestId: randomUUID(),
          expectedCapabilityRevision: 3,
        },
      ],
    ];
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
    const expired = await operator(a);
    await redis.set(
      key(expired.token),
      JSON.stringify({
        ...expired.record,
        idleExpiresAt: Date.now() - 1,
        lastActivityAt: Date.now() - 2,
      }),
    );
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
    for (const c of [a, b])
      for (const [method, suffix, body] of routeCases) {
        for (const [session, status] of [
          [undefined, 401],
          [ss, 403],
          [expired, 401],
          [revoked, 401],
        ])
          assert.equal(
            (
              await request(c, `${root(node)}/${suffix}`, {
                method,
                body,
                session,
              })
            ).status,
            status,
          );
        for (const headers of [
          { origin: 'https://evil.invalid' },
          { 'x-platform-proxy': 'bad' },
          ...(method === 'GET' ? [] : [{ 'x-platform-csrf': 'bad' }]),
          { authorization: `Bearer ${active.token}` },
          {
            cookie: `__Host-myims-platform=${active.token}; __Host-myims-platform=${active.token}`,
          },
        ]) {
          const denied = await request(c, `${root(node)}/${suffix}`, {
            method,
            body,
            session: active,
            headers,
          });
          assert.equal(
            denied.status,
            headers.authorization || headers.cookie ? 401 : 403,
          );
          assert.equal(denied.headers['cache-control'], 'no-store');
        }
      }
    const pgDown = await replica({
      runtimeUrl: appUrl.replace(/@[^/]+\//, '@127.0.0.1:1/'),
    });
    assert.equal((await get(pgDown, active, node, 'extensions')).status, 503);
    const fault = await proxy('pause'),
      redisDown = await replica({ redisUrl: fault.url });
    fault.arm();
    const redisFailure = await post(
      redisDown,
      active,
      node,
      'extensions',
      fresh(sip2, '1300'),
    );
    assert.equal(redisFailure.status, 503);
    assert.equal(redisFailure.headers['retry-after'], '1');
    const stale = await operator(b),
      staleBefore = await counts();
    await owner.query('BEGIN');
    await owner.query(
      "UPDATE public.platform_operators SET status='disabled',version=version+1,authentication_version=authentication_version+1,updated_at=clock_timestamp() WHERE id=$1",
      [stale.record.identityId],
    );
    const pending = post(b, stale, node, 'extensions', fresh(sip2, '1300'));
    try {
      await barrier('%public.platform_operators%FOR SHARE');
    } finally {
      await owner.query('COMMIT');
    }
    assert.equal((await pending).status, 403);
    assert.deepEqual(await counts(), staleBefore);
    console.log(
      'PASS inventory A-06: every route on A/B platform-only; staff/revoked/expired, CSRF/Origin/channel/no-store and PostgreSQL/Redis/current-authority failures deny safely',
    );

    // Use a fresh principal to keep default admission counters independent.
    const pageSession = await operator(a);
    const large = await post(a, pageSession, node, 'extensions/bulk', {
      requestId: randomUUID(),
      kind: 'sip',
      range: { start: '2000', end: '2049' },
      ...deps(sip2, { expectedCapabilityRevision: 3 }),
    });
    assert.equal(large.status, 201);
    assert.equal(large.data.items.length, 50);
    const boundedConflict = await post(
      a,
      pageSession,
      node,
      'extensions/bulk',
      freshBulk(
        sip2,
        Array.from({ length: 50 }, (_, i) => String(2000 + i)),
      ),
    );
    assert.equal(boundedConflict.status, 409);
    assert.equal(boundedConflict.data.conflicts.numbers.length, 10);
    assert.equal(boundedConflict.data.conflicts.total, 50);
    assert.equal(boundedConflict.data.conflicts.truncated, true);
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=1.5',
      'limit=1&limit=2',
      'after=bad',
      'unknown=x',
    ])
      for (const suffix of ['extensions', 'endpoint-profiles'])
        assert.equal(
          (await get(b, pageSession, node, `${suffix}?${query}`)).status,
          400,
        );
    const seen = [];
    let cursor = null;
    do {
      const p = await get(
        b,
        pageSession,
        node,
        `extensions?limit=7${cursor ? `&after=${cursor}` : ''}`,
      );
      assert.equal(p.status, 200);
      assert.ok(Buffer.byteLength(p.text) <= 65536);
      seen.push(...p.data.items.map((e) => e.id));
      cursor = p.data.nextCursor;
    } while (cursor);
    assert.deepEqual(
      seen,
      (
        await runtime.query(
          'SELECT id FROM public.extensions WHERE node_id=$1 ORDER BY id',
          [node.id],
        )
      ).rows.map((r) => r.id),
    );
    const maxPage = await get(b, pageSession, node, 'extensions?limit=100');
    assert.equal(maxPage.status, 200);
    assert.ok(Buffer.byteLength(maxPage.text) <= 65536);
    for (let i = 0; i < 101; i++) {
      const response = await post(a, pageSession, node, 'endpoint-profiles', {
        ...profileInput('webrtc-basic', `Bounded ${i} ${'x'.repeat(60)}`),
        expectedCapabilityRevision: 3,
      });
      assert.equal(response.status, 201);
    }
    const profilePage = await get(
      b,
      pageSession,
      node,
      'endpoint-profiles?limit=100',
    );
    assert.equal(profilePage.status, 200);
    assert.ok(Buffer.byteLength(profilePage.text) <= 65536);
    assert.ok(profilePage.data.nextCursor);
    assert.equal(profilePage.data.nodeVersion, 1);
    assert.equal(profilePage.data.capability.revision, 3);
    const profileSeen = [];
    let profileCursor = null;
    do {
      const response = await get(
        b,
        pageSession,
        node,
        `endpoint-profiles?limit=100${profileCursor ? `&after=${profileCursor}` : ''}`,
      );
      assert.equal(response.status, 200);
      assert.ok(Buffer.byteLength(response.text) <= 65536);
      profileSeen.push(...response.data.items.map((p) => p.id));
      profileCursor = response.data.nextCursor;
    } while (profileCursor);
    assert.deepEqual(
      profileSeen,
      (
        await runtime.query(
          'SELECT id FROM public.endpoint_profiles WHERE node_id=$1 ORDER BY id',
          [node.id],
        )
      ).rows.map((r) => r.id),
    );
    const persisted = (
      await runtime.query(
        "SELECT row_to_json(e) AS data FROM public.extensions e UNION ALL SELECT row_to_json(p) FROM public.endpoint_profile_versions p UNION ALL SELECT row_to_json(r) FROM public.inventory_receipts r UNION ALL SELECT row_to_json(a) FROM public.audit_events a WHERE event_type='telephony.inventory.desired-changed'",
      )
    ).rows;
    for (const sentinel of [
      'INVENTORY_PRIVATE_SENTINEL',
      config.proxySecret,
      config.csrfSecret,
      'fixture-observer',
    ])
      assert.ok(
        !(output.join('') + JSON.stringify(persisted)).includes(sentinel),
        'Inventory output leaked private data',
      );
    const bulkAudit = (
      await runtime.query(
        "SELECT actor_reference,tenant_id,target_reference,metadata FROM public.audit_events WHERE event_type='telephony.inventory.desired-changed' AND metadata->>'count'='50'",
      )
    ).rows[0];
    assert.equal(bulkAudit.actor_reference, pageSession.record.identityId);
    assert.equal(bulkAudit.tenant_id, null);
    assert.equal(bulkAudit.target_reference, node.id);
    assert.deepEqual(
      Object.entries(bulkAudit.metadata)
        .filter(([k]) => /^extension[0-9]+$/.test(k))
        .map(([, v]) => v)
        .sort(),
      large.data.items.map((i) => i.id).sort(),
    );
    assert.equal((await counts()).outbox, before.outbox);
    console.log(
      'PASS inventory A-03/06/07: 50-row exact audit/result, 10-conflict details, keyset/byte bounds, receipt expiry/pruning, safe output and no external work',
    );
  } finally {
    await owner.query('ROLLBACK').catch(() => {});
    for (const c of calls) if (c.child.connected) await c('close');
    for (const s of sessions) await redis.del(key(s.token));
    await versionRuntime?.onApplicationShutdown();
    await versionDatabase?.close();
    await versionPool?.end();
    await rm(directory, { recursive: true, force: true });
  }
}
