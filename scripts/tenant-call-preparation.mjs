// Ordinary trusted deployment only. Canonical services own every prerequisite.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import {
  PreparationStore,
  manifest,
  stepId,
} from './tenant-call-preparation-store.mjs';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = load('pg');
const { loadMigrationConfig } = load('./dist/infrastructure/configuration.js');
const [action, file, ...args] = process.argv.slice(2);
let client, inventory, drafts, credentials, snapshot;
try {
  if (
    ![
      'preview',
      'prepare',
      'reconcile',
      'status',
      'start',
      'restart',
      'stop',
      'disable',
    ].includes(action) ||
    !file ||
    (['start', 'restart', 'stop', 'disable'].includes(action)
      ? args.length !== 2
      : args.length !== 0)
  )
    throw new Error('Invalid preparation command');
  const bytes = readFileSync(file);
  if (bytes.length > 8192) throw new Error('Manifest too large');
  const p = manifest(JSON.parse(bytes));
  const config = loadMigrationConfig();
  client = new Client({
    connectionString: config.adminUrl,
    statement_timeout: 5000,
    lock_timeout: 5000,
  });
  client.on('error', () => {});
  await client.connect();
  const store = new PreparationStore(client, p);
  if (action === 'preview')
    console.log(JSON.stringify(await store.preview(), null, 2));
  else if (action === 'status')
    console.log(JSON.stringify(await store.status(), null, 2));
  else if (['start', 'restart', 'stop', 'disable'].includes(action)) {
    console.log(
      JSON.stringify(
        await store.locked(() =>
          store.lifecycle(
            action === 'restart' ? 'start' : action,
            args[0],
            Number(args[1]),
          ),
        ),
        null,
        2,
      ),
    );
  } else
    await store.locked(async () => {
      await store.accept();
      const retained = await store.status();
      if (retained.state === 'prepared') {
        console.log(JSON.stringify(retained, null, 2));
        return;
      }
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
      const { EndpointCredentialRuntime } = load(
        './dist/modules/telephony/adapters/db/endpoint-credential-runtime.js',
      );
      const { SafeLogger } = load('./dist/infrastructure/execution/logging.js');
      snapshot = new SnapshotDatabase(config.runtimeUrl);
      const authority = new TransactionAuthority(
        { lockedById: async () => ({ kind: 'denied' }) },
        new PlatformAuthorityRepository(snapshot),
      );
      const logger = new SafeLogger('deployment', () => {});
      inventory = new InventoryRuntime(config.runtimeUrl, authority, logger);
      drafts = new DraftTenantRuntime(config.runtimeUrl, authority, logger);
      credentials = new EndpointCredentialRuntime(
        config.runtimeUrl,
        authority,
        inventory.service,
        logger,
      );
      const actor = {
        plane: 'platform',
        operatorId: p.operatorId,
        authenticationVersion: p.authenticationVersion,
        grants: ['platform_operator'],
      };
      const invoke = async (name, input, fn, kind = 'status') =>
        store.step(name, input, async (body) => {
          const response = await fn(body);
          if (
            kind === 'inventory' &&
            ['created', 'replayed', 'edited'].includes(response.kind)
          )
            return response.value;
          if (
            kind === 'draft' &&
            ['created', 'replayed', 'saved'].includes(response.kind)
          )
            return response.value;
          if (kind === 'credential' && response.kind === 'ok')
            return response.value;
          if (kind === 'status' && [200, 201].includes(response.status))
            return response.value;
          throw new Error('Canonical preparation step blocked: ' + name);
        });
      const profile = (
        await invoke(
          'profile',
          {
            requestId: stepId(p.requestId, 'profile'),
            name: 'P4 controlled development',
            template: 'sip-basic',
            expectedNodeVersion: p.expectedNodeVersion,
            expectedCapabilityRevision: p.expectedCapabilityRevision,
          },
          (b) =>
            inventory.service.profileCreate(
              actor,
              p.nodeId,
              null,
              b,
              p.requestId,
            ),
          'inventory',
        )
      ).profile;
      const extensions = [];
      for (let i = 0; i < 3; i++) {
        const key = 'extension-' + i;
        let e = (
          await invoke(
            key,
            {
              requestId: stepId(p.requestId, key),
              number:
                i < 2 ? p.tenants[i].extensionNumber : p.unallocatedNumber,
              kind: 'sip',
              profileId: profile.id,
              profileVersion: profile.version,
              expectedNodeVersion: p.expectedNodeVersion,
              expectedCapabilityRevision: p.expectedCapabilityRevision,
              expectedProfileHead: profile.version,
            },
            (b) =>
              inventory.service.create(actor, p.nodeId, b, p.requestId, true),
            'inventory',
          )
        ).extension;
        const operation = await invoke(
          'credential-' + i,
          {
            operationId: stepId(p.requestId, 'credential-' + i),
            expectedVersion: e.version,
            expectedGenerationId: null,
          },
          (b) =>
            credentials.service.accept(
              actor,
              p.nodeId,
              e.id,
              'setup',
              b,
              p.requestId,
            ),
          'credential',
        );
        const current = (
          await client.query(
            'SELECT id,number,version,profile_id,profile_version,credential_generation_id,administrative_status FROM public.extensions WHERE id=$1 AND node_id=$2',
            [e.id, p.nodeId],
          )
        ).rows[0];
        const credential = (
          await client.query(
            'SELECT id,state,material_health,generation_id,verified_at,resulting_version FROM public.endpoint_credential_operations WHERE id=$1 AND installation_id=$2 AND extension_id=$3',
            [operation.operationId, p.installationId, e.id],
          )
        ).rows[0];
        if (
          credential?.state !== 'associated' ||
          credential.material_health !== 'verified' ||
          !credential.verified_at ||
          current.credential_generation_id !== credential.generation_id
        ) {
          console.log(
            JSON.stringify({
              requestId: p.requestId,
              state: 'blocked',
              blocker: 'credential_worker_required',
              operationId: operation.operationId,
              step: 'credential-' + i,
            }),
          );
          return;
        }
        const enabled = await store.step(
          'enable-' + i,
          {
            extensionId: e.id,
            expectedVersion: credential.resulting_version,
            credentialGenerationId: credential.generation_id,
          },
          async (intent) => {
            const actual = (
              await client.query(
                'SELECT version,administrative_status,credential_generation_id FROM public.extensions WHERE id=$1',
                [e.id],
              )
            ).rows[0];
            if (
              actual.credential_generation_id !== intent.credentialGenerationId
            )
              throw new Error('Credential changed');
            // Exact lost-ack recovery of the one bounded status transition.
            if (
              actual.administrative_status === 'enabled' &&
              actual.version === intent.expectedVersion + 1
            )
              return {
                id: e.id,
                version: actual.version,
                generationId: actual.credential_generation_id,
              };
            if (
              actual.administrative_status !== 'disabled' ||
              actual.version !== intent.expectedVersion
            )
              throw new Error('Unexpected extension status/version');
            const r = await inventory.service.edit(
              actor,
              p.nodeId,
              e.id,
              {
                expectedVersion: intent.expectedVersion,
                administrativeStatus: 'enabled',
              },
              p.requestId,
              true,
            );
            if (r.kind !== 'edited') throw new Error('Enable blocked');
            return {
              id: e.id,
              version: r.value.extension.version,
              generationId: credential.generation_id,
            };
          },
        );
        e = { ...e, ...enabled };
        extensions.push(e);
      }
      const peer = async (kind, key, body) => {
        const resource = (
          await invoke(
            key,
            { requestId: stepId(p.requestId, key), ...body },
            (b) =>
              inventory.peers.write(
                actor,
                kind,
                p.nodeId,
                null,
                'create',
                b,
                p.requestId,
              ),
          )
        ).resource;
        return store.step(
          key + '-enabled',
          { id: resource.id, expectedVersion: resource.version },
          async (intent) => {
            const table =
              kind === 'trunks'
                ? 'sip_trunks'
                : kind === 'gateways'
                  ? 'sip_gateways'
                  : 'sip_dids';
            const actual = (
              await client.query(
                `SELECT id,version,enabled FROM public.${table} WHERE id=$1 AND node_id=$2 AND removed_at IS NULL`,
                [intent.id, p.nodeId],
              )
            ).rows[0];
            if (
              actual?.enabled &&
              actual.version === intent.expectedVersion + 1
            )
              return { ...resource, version: actual.version, enabled: true };
            const r = await inventory.peers.write(
              actor,
              kind,
              p.nodeId,
              resource.id,
              'status',
              { expectedVersion: intent.expectedVersion, enabled: true },
              p.requestId,
            );
            if (r.status !== 200) throw new Error('Peer enable blocked');
            return r.value.resource;
          },
        );
      };
      const trunk = await peer('trunks', 'trunk', {
        name: 'P4 controlled sink',
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
      const gateway = await peer('gateways', 'gateway', {
        name: 'P4 controlled ingress',
        kind: 'sip-device',
        trunkId: null,
        sourceAddresses: ['127.0.0.2'],
      });
      const tenants = [],
        routes = [];
      for (let i = 0; i < 2; i++) {
        const t = p.tenants[i],
          e = extensions[i];
        const created = (
          await invoke(
            'tenant-' + i,
            {
              requestId: stepId(p.requestId, 'tenant-' + i),
              tenantCode: t.tenantCode,
              displayName: t.displayName,
              administratorUsername: 'controlled-admin',
            },
            (b) => drafts.service.create(actor, b, p.requestId),
            'draft',
          )
        ).tenant;
        const tenant = (
          await invoke(
            'voice-' + i,
            {
              requestId: stepId(p.requestId, 'voice-' + i),
              expectedVersion: created.version,
              expectedAuthorityVersion: created.authorityVersion,
              section: 'voice',
              values: { voicePreference: 'enabled' },
            },
            (b) => drafts.service.save(actor, created.id, b, p.requestId),
            'draft',
          )
        ).current.tenant;
        const claim = await invoke(
          'claim-' + i,
          {
            requestId: stepId(p.requestId, 'claim-' + i),
            expectedTenantVersion: tenant.version,
            expectedAuthorityVersion: tenant.authorityVersion,
            state: 'allocated',
            items: [{ extensionId: e.id, expectedVersion: e.version }],
          },
          (b) =>
            inventory.allocation.write(
              actor,
              tenant.id,
              p.nodeId,
              null,
              'create',
              b,
              p.requestId,
            ),
        );
        const did = await peer('dids', 'did-' + i, {
          name: 'P4 controlled DID ' + i,
          number: t.inboundNumber,
          gatewayId: gateway.id,
        });
        const route = async (kind, key, body) => {
          const resource = (
            await invoke(
              key,
              { requestId: stepId(p.requestId, key), ...body },
              (b) =>
                inventory.routing.write(
                  actor,
                  kind,
                  p.nodeId,
                  null,
                  'create',
                  b,
                  p.requestId,
                ),
            )
          ).resource;
          return store.step(
            key + '-enabled',
            { id: resource.id, expectedVersion: resource.version },
            async (intent) => {
              const table =
                kind === 'inbound' ? 'inbound_rules' : 'outbound_rules';
              const actual = (
                await client.query(
                  `SELECT id,version,enabled FROM public.${table} WHERE id=$1 AND node_id=$2 AND removed_at IS NULL`,
                  [intent.id, p.nodeId],
                )
              ).rows[0];
              if (
                actual?.enabled &&
                actual.version === intent.expectedVersion + 1
              )
                return { ...resource, version: actual.version, enabled: true };
              const r = await inventory.routing.write(
                actor,
                kind,
                p.nodeId,
                resource.id,
                'status',
                { expectedVersion: intent.expectedVersion, enabled: true },
                p.requestId,
              );
              if (r.status !== 200) throw new Error('Route enable blocked');
              return r.value.resource;
            },
          );
        };
        const inbound = await route('inbound', 'inbound-' + i, {
          name: 'P4 controlled inbound ' + i,
          gatewayId: gateway.id,
          didId: did.id,
          destination: { kind: 'extension', id: e.id },
        });
        const outbound = await route('outbound', 'outbound-' + i, {
          name: 'P4 controlled outbound ' + i,
          trunkId: trunk.id,
          pattern: {
            kind: 'exact',
            digits: t.outboundNumber,
            minLength: t.outboundNumber.length,
            maxLength: t.outboundNumber.length,
          },
          priority: 770 + i,
          stripCount: 0,
          addPrefix: '',
        });
        tenants.push(tenant);
        routes.push({ inbound, outbound, did, claim: claim.items[0] });
      }
      await store.step(
        'cases',
        { tenants, extensions, routes, gateway, trunk },
        async (facts) =>
          store.transaction(async () => {
            await client.query(
              'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
              [p.nodeId],
            );
            await store.assertTarget();
            const cases = [];
            for (const [kind, resources] of [
              ['tenant', tenants],
              ['extension', extensions],
              ['claim', routes.map((r) => r.claim)],
              ['gateway', [gateway]],
              ['trunk', [trunk]],
              ['inbound', routes.map((r) => r.inbound)],
              ['outbound', routes.map((r) => r.outbound)],
              ['did', routes.map((r) => r.did)],
              ['profile', [profile]],
            ]) {
              const tables = {
                tenant: 'tenants',
                extension: 'extensions',
                claim: 'tenant_inventory_claims',
                gateway: 'sip_gateways',
                trunk: 'sip_trunks',
                inbound: 'inbound_rules',
                outbound: 'outbound_rules',
                did: 'sip_dids',
                profile: 'endpoint_profiles',
              };
              for (const resource of resources) {
                const versionColumn =
                  kind === 'profile' ? 'head_version' : 'version';
                const actual = (
                  await client.query(
                    `SELECT ${versionColumn} AS version FROM public.${tables[kind]} WHERE id=$1${kind === 'tenant' ? '' : ' AND node_id=$2'}`,
                    kind === 'tenant' ? [resource.id] : [resource.id, p.nodeId],
                  )
                ).rows[0];
                if (actual?.version !== resource.version)
                  throw new Error('Stale preparation resource facts');
                await client.query(
                  'INSERT INTO public.tenant_call_preparation_facts(preparation_id,kind,resource_id,version,authority_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
                  [
                    p.requestId,
                    kind,
                    resource.id,
                    resource.version,
                    kind === 'tenant' ? resource.authorityVersion : null,
                  ],
                );
              }
            }
            async function add(
              key,
              i,
              direction,
              source,
              expected,
              destination,
              required = true,
              kind = 'routing',
            ) {
              const id = stepId(p.requestId, 'case-' + key),
                route =
                  direction === 'inbound'
                    ? routes[i].inbound
                    : routes[i].outbound;
              const values = [
                id,
                p.nodeId,
                p.installationId,
                tenants[i].id,
                direction,
                route.id,
                source,
                direction === 'inbound'
                  ? p.tenants[i].inboundNumber
                  : p.tenants[i].outboundNumber,
                destination,
                expected,
                required,
                kind,
              ];
              const existing = (
                await client.query(
                  'SELECT * FROM public.tenant_route_test_cases WHERE id=$1',
                  [id],
                )
              ).rows[0];
              if (existing) {
                const fields = [
                  'id',
                  'node_id',
                  'installation_id',
                  'tenant_id',
                  'direction',
                  'route_id',
                  'source_id',
                  'dialled',
                  'expected_destination_id',
                  'expected_outcome',
                  'readiness_required',
                  'test_kind',
                ];
                if (
                  !existing.enabled ||
                  JSON.stringify(fields.map((k) => existing[k])) !==
                    JSON.stringify(values)
                )
                  throw new Error('Immutable case identity conflict');
                const previous = (
                  await client.query(
                    'SELECT preparation_id FROM public.tenant_call_preparation_cases WHERE case_id=$1',
                    [id],
                  )
                ).rows[0];
                if (previous && previous.preparation_id !== p.requestId)
                  throw new Error('Case preparation ownership conflict');
              }
              if (!existing)
                await client.query(
                  'INSERT INTO public.tenant_route_test_cases(id,node_id,installation_id,tenant_id,direction,route_id,source_id,dialled,expected_destination_id,expected_outcome,enabled,readiness_required,test_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12)',
                  values,
                );
              await client.query(
                'INSERT INTO public.tenant_call_preparation_cases(preparation_id,case_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
                [p.requestId, id],
              );
              cases.push({
                id,
                tenantId: tenants[i].id,
                direction,
                kind,
                readinessRequired: required,
              });
            }
            for (let i = 0; i < 2; i++) {
              await add(
                'in-' + i,
                i,
                'inbound',
                gateway.id,
                'permitted',
                extensions[i].id,
              );
              await add(
                'out-' + i,
                i,
                'outbound',
                extensions[i].id,
                'permitted',
                trunk.id,
              );
              await add(
                'cross-' + i,
                i,
                'outbound',
                extensions[1 - i].id,
                'denied',
                null,
                false,
              );
            }
            await add(
              'unallocated',
              0,
              'outbound',
              extensions[2].id,
              'denied',
              null,
              false,
            );
            await add(
              'unknown',
              0,
              'outbound',
              stepId(p.requestId, 'unknown-source'),
              'denied',
              null,
              false,
            );
            for (const kind of ['ambiguous-source', 'ordinary-draft'])
              await add(
                kind,
                0,
                'outbound',
                extensions[0].id,
                'denied',
                null,
                false,
                kind,
              );
            await add(
              'unpermitted',
              0,
              'outbound',
              extensions[1].id,
              'denied',
              null,
              false,
              'unpermitted',
            );
            await store.audit('step');
            return {
              cases,
              resources: {
                tenantIds: tenants.map((t) => t.id),
                extensionIds: extensions.map((e) => e.id),
                gatewayId: gateway.id,
                trunkId: trunk.id,
                routeIds: routes.flatMap((r) => [r.inbound.id, r.outbound.id]),
              },
              facts,
            };
          }),
      );
      console.log(JSON.stringify(await store.status(), null, 2));
    });
} catch (error) {
  const reasons = {
    'Invalid preparation manifest': 'invalid_manifest',
    'Invalid dedicated tenant definition': 'invalid_manifest',
    'Conflicting preparation numbers': 'invalid_manifest',
    'Preparation owner unavailable': 'responsible_owner_unavailable',
    'Preparation target stale or incompatible': 'target_stale_or_incompatible',
    'Controlled source conflict': 'controlled_source_conflict',
    'Dedicated resource or sink conflict': 'resource_or_sink_conflict',
    'Preparation request conflict': 'request_conflict',
    'Preparation step conflict': 'request_conflict',
    'Stale preparation resource facts': 'resource_versions_stale',
    'Immutable case identity conflict': 'case_provenance_conflict',
    'Case preparation ownership conflict': 'case_provenance_conflict',
  };
  console.log(
    JSON.stringify({
      state: 'blocked',
      reason: Object.hasOwn(reasons, error?.message)
        ? reasons[error.message]
        : error?.code === '42P01'
          ? 'preparation_schema_unavailable'
          : 'preparation_unresolved',
    }),
  );
  console.error(
    'Preparation blocked or unresolved. Inspect this exact request and canonical step outcomes; reconcile without changing request identity.',
  );
  process.exitCode = 2;
} finally {
  await credentials?.onApplicationShutdown();
  await drafts?.onApplicationShutdown();
  await inventory?.onApplicationShutdown();
  await snapshot?.close();
  await client?.end();
}
