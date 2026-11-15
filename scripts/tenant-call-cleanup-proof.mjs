// Passive ordinary cleanup proof: canonical reads plus installation-bound native CLI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const uuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const args = process.argv.slice(2);
const load = createRequire('/workspace/services/backend/package.json');
async function database(file, artifactId) {
  const { manifest, fingerprint } =
    await import('./tenant-call-preparation-store.mjs');
  assert.ok(uuid(artifactId));
  const p = manifest(JSON.parse(readFileSync(file, 'utf8')));
  const { SnapshotDatabase } = load(
    './dist/infrastructure/database/read-snapshot.js',
  );
  const db = new SnapshotDatabase(
    load('./dist/infrastructure/configuration.js').loadBackendConfig().database
      .url,
  );
  try {
    return await db.read(async (s) => {
      const query = async (sql, values = []) =>
        (await s.query(sql, values)).rows;
      const [preparation] = await query(
        'SELECT fingerprint FROM public.tenant_call_preparations WHERE id=$1 AND node_id=$2 AND installation_id=$3',
        [p.requestId, p.nodeId, p.installationId],
      );
      assert.equal(preparation?.fingerprint, fingerprint(p));
      const [event] = await query(
        'SELECT action FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
        [p.requestId],
      );
      assert.equal(event?.action, 'stop');
      const [step] = await query(
        "SELECT result FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 AND step='cases' AND phase='outcome'",
        [p.requestId],
      );
      const resources = step?.result?.resources;
      assert.ok(resources);
      const [runtime] = await query(
        'SELECT r.verified_id,r.installed_id,r.known_good_id,r.runtime_state,r.routing_generation,r.boundary_epoch::text AS epoch,r.active_operation_id,r.active_retirement_id,r.active_profile_operation_id,a.revision_id,v.source_digest FROM public.pbx_live_runtime r JOIN public.pbx_live_artifacts a ON a.id=r.verified_id JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE r.node_id=$1',
        [p.nodeId],
      );
      for (const key of ['verified_id', 'installed_id', 'known_good_id'])
        assert.equal(runtime?.[key], artifactId);
      assert.equal(runtime.runtime_state, 'verified');
      for (const key of [
        'active_operation_id',
        'active_retirement_id',
        'active_profile_operation_id',
      ])
        assert.equal(runtime[key], null);
      assert.equal(
        (
          await query(
            "SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown')",
            [p.nodeId],
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await query(
            'SELECT 1 FROM public.tenant_verification_grants g WHERE node_id=$1 AND expires_at>statement_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations v WHERE v.grant_id=g.id)',
            [p.nodeId],
          )
        ).length,
        0,
      );
      const stock = await query(
        'SELECT id,administrative_status,credential_generation_id FROM public.extensions WHERE node_id=$1 AND id=ANY($2::uuid[]) ORDER BY id',
        [p.nodeId, resources.extensionIds],
      );
      assert.equal(stock.length, 3);
      assert.ok(
        stock.every(
          (e) =>
            e.administrative_status === 'disabled' &&
            uuid(e.credential_generation_id),
        ),
      );
      const [gateway] = await query(
        'SELECT enabled FROM public.sip_gateways WHERE node_id=$1 AND id=$2 AND removed_at IS NULL',
        [p.nodeId, resources.gatewayId],
      );
      const [trunk] = await query(
        'SELECT enabled FROM public.sip_trunks WHERE node_id=$1 AND id=$2 AND removed_at IS NULL',
        [p.nodeId, resources.trunkId],
      );
      assert.equal(gateway?.enabled, false);
      assert.equal(trunk?.enabled, false);
      const routes = await query(
        'SELECT DISTINCT c.route_id FROM public.tenant_route_test_cases c JOIN public.tenant_call_preparation_cases p ON p.case_id=c.id WHERE p.preparation_id=$1 ORDER BY c.route_id LIMIT 65',
        [p.requestId],
      );
      assert.ok(routes.length > 0 && routes.length <= 64);
      const routeIds = routes.map((r) => r.route_id);
      assert.equal(
        (
          await query(
            "SELECT 1 FROM public.tenant_route_authorizations WHERE node_id=$1 AND tenant_id=ANY($2::uuid[]) AND kind IN ('inbound','outbound','permission') AND state='active' AND resource_id=ANY($3::uuid[])",
            [p.nodeId, resources.tenantIds, [...routeIds, resources.trunkId]],
          )
        ).length,
        0,
      );
      const [custody] = await query(
        "SELECT (f.valid AND f.owner_epoch=o.epoch AND f.source_digest=$2 AND f.checked_at>statement_timestamp()-interval '15 seconds' AND o.expires_at>statement_timestamp()) IS TRUE AS current FROM public.tenant_call_custody_proofs f JOIN public.pbx_ownership o ON o.node_id=f.node_id WHERE f.node_id=$1",
        [p.nodeId, runtime.source_digest],
      );
      assert.equal(custody?.current, true);
      const pins = await query(
        'SELECT kind,resource_id,version,count(*)::integer AS references FROM public.pbx_live_pins WHERE node_id=$1 AND released_at IS NULL GROUP BY kind,resource_id,version ORDER BY kind,resource_id,version LIMIT 257',
        [p.nodeId],
      );
      assert.ok(pins.length <= 256);
      return {
        nodeId: p.nodeId,
        installationId: p.installationId,
        artifactId,
        revisionId: runtime.revision_id,
        epoch: runtime.epoch,
        generation: runtime.routing_generation,
        sourceDigest: runtime.source_digest,
        extensionIds: resources.extensionIds,
        gatewayId: resources.gatewayId,
        trunkId: resources.trunkId,
        routeIds,
        retainedPins: pins,
        materialCustodyCurrent: true,
      };
    });
  } finally {
    await db.close();
  }
}
async function native(input) {
  assert.equal(process.getuid(), 0);
  for (const key of [
    'nodeId',
    'installationId',
    'artifactId',
    'revisionId',
    'gatewayId',
    'trunkId',
  ])
    assert.ok(uuid(input[key]));
  assert.ok(
    Array.isArray(input.extensionIds) &&
      input.extensionIds.length === 3 &&
      input.extensionIds.every(uuid),
  );
  assert.ok(
    Array.isArray(input.routeIds) &&
      input.routeIds.length > 0 &&
      input.routeIds.length <= 64 &&
      input.routeIds.every(uuid),
  );
  const { liveConfiguration } = load(
    './dist/modules/telephony/adapters/live/configuration.js',
  );
  const { nativeCli } = load(
    './dist/modules/telephony/adapters/live/native-driver.js',
  );
  const { routeIdentity } = load(
    './dist/modules/telephony/domain/route-identity.js',
  );
  const config = liveConfiguration(
    '/run/pbx-live-native/configuration.json',
    false,
  );
  assert.equal(config.nodeId, input.nodeId);
  assert.equal(config.installationId, input.installationId);
  const compact = (id) => id.replaceAll('-', '');
  const marker = `ims-rev-${compact(input.revisionId)}`;
  assert.ok(
    (await nativeCli(`pjsip show endpoint ${marker}`)).includes(marker),
  );
  for (const id of input.extensionIds) {
    for (const [type, prefix] of [
      ['endpoint', 'e'],
      ['auth', 'a'],
      ['aor', 'r'],
    ]) {
      const key = `ims-${prefix}-${compact(input.installationId)}-${compact(id)}`;
      assert.ok(
        (await nativeCli(`pjsip show ${type} ${key}`)).includes(
          `Unable to find object ${key}.`,
        ),
      );
    }
  }
  const gateway = `ims-g-${compact(input.gatewayId)}`;
  for (const [type, key] of [
    ['endpoint', gateway],
    ['identify', gateway + '-identify'],
  ])
    assert.ok(
      (await nativeCli(`pjsip show ${type} ${key}`)).includes(
        `Unable to find object ${key}.`,
      ),
    );
  const retainedTrunk = `ims-t-${compact(input.nodeId)}-${compact(input.trunkId)}`;
  const trunk = await nativeCli(`pjsip show endpoint ${retainedTrunk}`);
  assert.ok(
    trunk.includes('Endpoint:') &&
      trunk.includes(`ims-deny-${compact(input.nodeId)}`),
  );
  for (const id of input.routeIds) {
    const context =
      'ims-route-' + routeIdentity(input.installationId, id).contextHash;
    const out = await nativeCli(`dialplan show ${context}`);
    if (out.includes(`There is no existence of '${context}' context`)) continue;
    assert.ok(out.includes(context) && out.includes('Hangup('));
    assert.ok(!/\b(?:Dial|AGI)\(/.test(out));
  }
  const channels = await nativeCli('core show channels count');
  assert.match(channels, /^0 active channels$/m);
  assert.match(channels, /^0 active calls$/m);
  return {
    nativeEndpointsAuthsAorsAbsent: 3,
    nativeControlledGatewayAndIdentifyAbsent: true,
    controlledRouteDialAndAdmissionAbsent: input.routeIds.length,
    activeChannels: 0,
    retainedTrunkStub: true,
  };
}
try {
  if (args[0] === '--database') {
    assert.equal(args.length, 3);
    console.log(JSON.stringify(await database(args[1], args[2])));
  } else if (args[0] === '--native') {
    assert.equal(args.length, 2);
    console.log(JSON.stringify(await native(JSON.parse(args[1]))));
  } else {
    assert.equal(args.length, 2);
    const { manifest } = await import('./tenant-call-preparation-store.mjs');
    const p = manifest(JSON.parse(readFileSync(args[0], 'utf8')));
    assert.ok(uuid(args[1]));
    const run = (argv, input) => {
      const r = spawnSync('docker', argv, {
        input,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 1048576,
      });
      if (r.status !== 0)
        throw new Error('Passive cleanup dependency unavailable');
      return JSON.parse(r.stdout);
    };
    const before = run([
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      '/workspace/scripts/tenant-call-cleanup-proof.mjs',
      '--database',
      ...args,
    ]);
    const status = spawnSync(
      process.execPath,
      ['scripts/pbx-profile.mjs', 'status', p.nodeId, p.installationId],
      { encoding: 'utf8', timeout: 60000, maxBuffer: 1048576 },
    );
    assert.equal(status.status, 0);
    const profile = JSON.parse(status.stdout);
    assert.ok(
      profile.blockers.every(
        (b) => b === 'exact_provider_material_probe_required',
      ),
    );
    assert.equal(profile.exactProtectedAndLoadedRuntimeMatch, true);
    assert.equal(profile.runtime.artifactId, args[1]);
    assert.equal(profile.activeChannels, 0);
    assert.equal(profile.unmanagedDigest, p.expectedProfileDigest);
    const observed = run(
      [
        'exec',
        '-i',
        '--user',
        '0',
        'myims-rebuild-dev-asterisk-1',
        'node',
        '--input-type=module',
        '-',
        '--native',
        JSON.stringify(before),
      ],
      readFileSync(
        new URL('./tenant-call-cleanup-proof.mjs', import.meta.url),
        'utf8',
      ),
    );
    const after = run([
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      '/workspace/scripts/tenant-call-cleanup-proof.mjs',
      '--database',
      ...args,
    ]);
    assert.deepEqual(after, before);
    console.log(
      JSON.stringify({
        state: 'ordinary_loaded_cleanup_proved',
        effectAuthorization: false,
        ...after,
        ...observed,
        profileDigest: profile.unmanagedDigest,
      }),
    );
  }
} catch {
  console.error(
    'Passive ordinary cleanup proof unavailable or mismatched; no loaded-path absence or cleanup pass is claimed.',
  );
  process.exitCode = 1;
}
