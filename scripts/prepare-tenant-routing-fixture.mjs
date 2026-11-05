// Test-only trusted coordinator for an already-created disposable database.
// Endpoint provider metadata/material are synthetic here; real provider custody
// remains independently exercised by the required retained-provider revision mode.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
export async function prepareTenantRoutingFixture(
  fixture,
  metadata,
  runtimeUrl,
) {
  const { SnapshotDatabase } = load(
    './dist/infrastructure/database/read-snapshot.js',
  );
  const { TransactionAuthority } = load(
    './dist/modules/identity/application/transaction-authority.js',
  );
  const { PlatformAuthorityRepository } = load(
    './dist/modules/platform/adapters/db/authority-read.js',
  );
  const { InventoryRuntime } = load(
    './dist/modules/telephony/adapters/db/inventory-runtime.js',
  );
  const { DraftTenantRuntime } = load(
    './dist/modules/platform/adapters/db/draft-tenant-runtime.js',
  );
  const snapshot = new SnapshotDatabase(runtimeUrl),
    authority = new TransactionAuthority(
      { lockedById: async () => ({ kind: 'denied' }) },
      new PlatformAuthorityRepository(snapshot),
    );
  const { SafeLogger } = load('./dist/infrastructure/execution/logging.js');
  const http = new InventoryRuntime(
      runtimeUrl,
      authority,
      new SafeLogger('deployment', () => {}),
    ),
    p = {
      plane: 'platform',
      operatorId: metadata.operatorId,
      authenticationVersion: 1,
      grants: ['platform_operator'],
    };
  const drafts = new DraftTenantRuntime(
    runtimeUrl,
    authority,
    new SafeLogger('deployment', () => {}),
  );
  const node = metadata.nodeId,
    installation = metadata.installationId;
  const check = (r, status) => {
    assert.equal(r.status, status, JSON.stringify(r));
    return r.value;
  };
  const inv = (r) => {
    assert.ok(['created', 'edited'].includes(r.kind), JSON.stringify(r));
    return r.value;
  };
  try {
    p.authenticationVersion = (
      await fixture.query(
        'SELECT authentication_version FROM public.platform_operators WHERE id=$1',
        [p.operatorId],
      )
    ).rows[0].authentication_version;
    metadata.tenants = [];
    metadata.extensions = [];
    metadata.inbound = [];
    metadata.outbound = [];
    metadata.claims = [];
    metadata.cases = [];
    await fixture.query(
      `INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media,credential_auth_max,credential_hex_max) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'],128,64) ON CONFLICT(installation_id) DO NOTHING`,
      [installation],
    );
    const profile = inv(
      await http.service.profileCreate(
        p,
        node,
        null,
        {
          requestId: randomUUID(),
          name: 'Controlled routing fixture',
          template: 'sip-basic',
          expectedNodeVersion: 1,
          expectedCapabilityRevision: 1,
        },
        randomUUID(),
      ),
    ).profile;
    for (let i = 0; i < 3; i++) {
      let e = inv(
        await http.service.create(
          p,
          node,
          {
            requestId: randomUUID(),
            number: String(7100 + i),
            kind: 'sip',
            profileId: profile.id,
            profileVersion: profile.version,
            expectedNodeVersion: 1,
            expectedCapabilityRevision: 1,
            expectedProfileHead: 1,
          },
          randomUUID(),
          true,
        ),
      ).extension;
      e = inv(
        await http.service.edit(
          p,
          node,
          e.id,
          { expectedVersion: e.version, administrativeStatus: 'enabled' },
          randomUUID(),
          true,
        ),
      ).extension;
      const operationId = randomUUID(),
        generationId = randomUUID();
      await fixture.query(
        `INSERT INTO public.endpoint_credential_operations(id,request_id,operator_id,authentication_version,action,node_id,extension_id,installation_id,expected_version,node_version,capability_revision,generation_id,ordinal,fingerprint,correlation_id,state,material_health,verified_at,associated_at,terminal_at,resulting_version) VALUES($1,$2,$3,$10,'setup',$4,$5,$6,$7,1,1,$8,1,$9,$1::uuid::text,'associated','verified',clock_timestamp(),clock_timestamp(),clock_timestamp(),$7+1)`,
        [
          operationId,
          randomUUID(),
          p.operatorId,
          node,
          e.id,
          installation,
          e.version,
          generationId,
          '0'.repeat(64),
          p.authenticationVersion,
        ],
      );
      await fixture.query(
        'UPDATE public.extensions SET credential_generation_id=$2,version=version+1 WHERE id=$1',
        [e.id, generationId],
      );
      metadata.extensions.push({ ...e, version: e.version + 1, generationId });
    }
    async function peer(kind, values) {
      let r = check(
        await http.peers.write(
          p,
          kind,
          node,
          null,
          'create',
          { requestId: randomUUID(), ...values },
          randomUUID(),
        ),
        201,
      ).resource;
      r = check(
        await http.peers.write(
          p,
          kind,
          node,
          r.id,
          'status',
          { expectedVersion: r.version, enabled: true },
          randomUUID(),
        ),
        200,
      ).resource;
      return r;
    }
    async function route(kind, values) {
      let r = check(
        await http.routing.write(
          p,
          kind,
          node,
          null,
          'create',
          { requestId: randomUUID(), ...values },
          randomUUID(),
        ),
        201,
      ).resource;
      return check(
        await http.routing.write(
          p,
          kind,
          node,
          r.id,
          'status',
          { expectedVersion: r.version, enabled: true },
          randomUUID(),
        ),
        200,
      ).resource;
    }
    const trunk = await peer('trunks', {
      name: 'Local controlled SIP sink',
      direction: 'both',
      settings: {
        host: '127.0.0.4',
        port: 20020,
        transport: 'udp',
        media: 'rtp',
        codecs: ['ulaw'],
        directMedia: false,
        rtpSymmetric: true,
        forceRport: true,
        authentication: 'ip-peer',
      },
    });
    const gateway = await peer('gateways', {
      name: 'Controlled real SIP ingress',
      kind: 'sip-device',
      trunkId: null,
      sourceAddresses: ['127.0.0.2'],
    });
    metadata.gateway = gateway;
    metadata.trunk = trunk;
    async function bind(t, kind, resourceId, scope = 'owned') {
      const review = check(
        await http.bindings.preview(
          p,
          t.id,
          node,
          { kind, resourceId, scope },
          randomUUID(),
        ),
        200,
      );
      assert.equal(review.compatible, true, JSON.stringify(review));
      const result = await http.bindings.write(
        p,
        t.id,
        node,
        null,
        {
          requestId: randomUUID(),
          expectedTenantVersion: t.version,
          expectedAuthorityVersion: t.authorityVersion,
          kind,
          resourceId,
          scope,
          evaluated: review.evaluated,
          expectedVersion: review.currentVersion,
        },
        randomUUID(),
      );
      assert.ok([200, 201].includes(result.status), JSON.stringify(result));
      return result.value.items[0];
    }
    for (let i = 0; i < 2; i++) {
      const created = await drafts.service.create(
        p,
        {
          requestId: randomUUID(),
          tenantCode: 'routing-' + randomUUID(),
          displayName: 'Controlled routing tenant ' + i,
          administratorUsername: 'routing-admin',
        },
        randomUUID(),
      );
      assert.equal(created.kind, 'created', JSON.stringify(created));
      const saved = await drafts.service.save(
        p,
        created.value.tenant.id,
        {
          requestId: randomUUID(),
          expectedVersion: created.value.tenant.version,
          expectedAuthorityVersion: created.value.tenant.authorityVersion,
          section: 'voice',
          values: { voicePreference: 'enabled' },
        },
        randomUUID(),
      );
      assert.equal(saved.kind, 'saved', JSON.stringify(saved));
      const t = saved.value.current.tenant;
      if (i === 1 && metadata.activeSecondTenant === true) {
        // Deployment-only seed of an existing active tenant in this disposable
        // database. This is not a product lifecycle action or U3 verification.
        const seeded = (
          await fixture.query(
            "UPDATE public.tenants SET status='active',version=version+1,authority_version=authority_version+1,updated_at=clock_timestamp() WHERE id=$1 AND status='draft' RETURNING version,authority_version",
            [t.id],
          )
        ).rows[0];
        assert.ok(seeded);
        Object.assign(t, {
          status: 'active',
          version: seeded.version,
          authorityVersion: seeded.authority_version,
        });
      }
      metadata.tenants.push(t);
      const e = metadata.extensions[i];
      metadata.claims.push(
        check(
          await http.allocation.write(
            p,
            t.id,
            node,
            null,
            'create',
            {
              requestId: randomUUID(),
              expectedTenantVersion: t.version,
              expectedAuthorityVersion: t.authorityVersion,
              state: 'allocated',
              items: [{ extensionId: e.id, expectedVersion: e.version }],
            },
            randomUUID(),
          ),
          201,
        ).items[0],
      );
      const did = await peer('dids', {
        name: 'Controlled tenant DID ' + i,
        number: '555000' + i,
        gatewayId: gateway.id,
      });
      const group = await route('groups', {
        name: 'Controlled tenant group ' + i,
        number: null,
        memberIds: [e.id],
        strategy: 'simultaneous',
        timeout: 15,
        fallback: { kind: 'hangup' },
      });
      const inbound = await route('inbound', {
        name: 'Controlled inbound ' + i,
        gatewayId: gateway.id,
        didId: did.id,
        destination: { kind: 'group', id: group.id },
      });
      metadata.inbound.push(inbound);
      const outbound = await route('outbound', {
        name: 'Controlled outbound ' + i,
        trunkId: trunk.id,
        pattern: {
          kind: 'exact',
          digits: '555100' + i,
          minLength: 7,
          maxLength: 7,
        },
        priority: i,
        stripCount: 1,
        addPrefix: '9',
      });
      metadata.outbound.push(outbound);
      if (i === 0) await bind(t, 'trunks', trunk.id, 'shared');
      await bind(t, 'dids', did.id);
      await bind(t, 'groups', group.id);
      await bind(t, 'inbound', inbound.id);
      await bind(t, 'permission', trunk.id);
      await bind(t, 'outbound', outbound.id);
      for (const [direction, sourceId, routeId, dialled, destinationId] of [
        ['inbound', gateway.id, inbound.id, did.number, e.id],
        ['outbound', e.id, outbound.id, '555100' + i, trunk.id],
      ]) {
        const id = randomUUID();
        await fixture.query(
          `INSERT INTO public.tenant_route_test_cases(id,node_id,installation_id,tenant_id,direction,route_id,source_id,dialled,expected_destination_id,expected_outcome,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'permitted',true)`,
          [
            id,
            node,
            installation,
            t.id,
            direction,
            routeId,
            sourceId,
            dialled,
            destinationId,
          ],
        );
        metadata.cases.push({
          id,
          tenantId: t.id,
          direction,
          expected: 'permitted',
        });
      }
    }
    for (const [kind, source] of [
      ['cross-tenant', metadata.extensions[1].id],
      ['unallocated', metadata.extensions[2].id],
      ['unknown', randomUUID()],
    ]) {
      const id = randomUUID();
      await fixture.query(
        `INSERT INTO public.tenant_route_test_cases(id,node_id,installation_id,tenant_id,direction,route_id,source_id,dialled,expected_outcome,enabled) VALUES($1,$2,$3,$4,'outbound',$5,$6,'5551000','denied',true)`,
        [
          id,
          node,
          installation,
          metadata.tenants[0].id,
          metadata.outbound[0].id,
          source,
        ],
      );
      metadata.cases.push({
        id,
        tenantId: metadata.tenants[0].id,
        direction: 'outbound',
        kind,
        expected: 'denied',
      });
    }
    metadata.materialMode = 'synthetic-fixture-endpoints';
    return metadata;
  } finally {
    await drafts.onApplicationShutdown();
    await http.onApplicationShutdown();
    await snapshot.close();
  }
}
