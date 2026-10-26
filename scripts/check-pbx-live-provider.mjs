// Protected consumer verification only; real provider GETs, no PBX or material writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/exact-material.js',
);
const { ExactLiveMaterialConsumer } = load('./exact-material.js'),
  { liveConfiguration } = load('./configuration.js'),
  { LiveExecutionStore } = load('./execution-store.js'),
  { LiveMaterialResolver } = load('./material-resolver.js'),
  { captureSnapshot } = load('../db/revision-snapshot.js');
let stage = 'configuration';
async function main() {
  const configuration = liveConfiguration(
    '/run/pbx-live-consumer/configuration.json',
    true,
  );
  if (process.argv[2]) {
    const fixture = JSON.parse(process.argv[2]);
    if (
      !/^myims_session_[a-f0-9]{12}$/.test(fixture.database ?? '') ||
      fixture.installationId !== configuration.installationId ||
      !/^[a-f0-9-]{36}$/.test(fixture.nodeId ?? '')
    )
      throw new Error('Owned provider fixture unavailable');
    const database = new URL(configuration.database);
    database.pathname = '/' + fixture.database;
    configuration.database = database.href;
    configuration.nodeId = fixture.nodeId;
  }
  const settings = {
    installationId: configuration.installationId,
    endpoint: 'https://endpoint-secrets:8200',
    tokenFile: configuration.providerTokenFile,
    caFile: configuration.providerCaFile,
  };
  const consumer = new ExactLiveMaterialConsumer(settings),
    store = new LiveExecutionStore(configuration.database);
  try {
    stage = 'canonical_snapshot';
    const snapshot = await store.database.read((tx) =>
      captureSnapshot(tx, configuration.nodeId),
    );
    stage = 'exact_resolution';
    const material = await new LiveMaterialResolver(
      store.pool,
      consumer,
    ).resolve(snapshot);
    let reads = material.endpoints.size + material.trunks.size;
    const historical = (
      await store.pool.query(
        'SELECT snapshot FROM public.pbx_revisions WHERE node_id=$1 ORDER BY sequence',
        [configuration.nodeId],
      )
    ).rows;
    for (const row of historical) {
      const retained = await new LiveMaterialResolver(
        store.pool,
        consumer,
      ).resolve(row.snapshot);
      reads += retained.endpoints.size + retained.trunks.size;
    }
    const reference = snapshot.trunks.find((trunk) => trunk.settings.credential)
      ?.settings.credential;
    if (reference) {
      const imported = (
        await store.pool.query(
          "SELECT operation_id FROM public.sip_credential_imports WHERE credential_id=$1 AND expected_version=$2 AND state='confirmed'",
          [reference.id, reference.version - 1],
        )
      ).rows[0];
      await assert.rejects(
        consumer.trunk({
          installationId: configuration.installationId,
          credentialId: reference.id,
          operationId: imported.operation_id,
          version: 2147483647,
          realm: null,
        }),
        (error) => error.code === 'material_missing',
      );
      const unavailable = new ExactLiveMaterialConsumer({
        ...settings,
        endpoint: 'https://127.0.0.1:1',
      });
      const started = Date.now();
      await assert.rejects(
        unavailable.trunk({
          installationId: configuration.installationId,
          credentialId: reference.id,
          operationId: imported.operation_id,
          version: reference.version,
          realm: null,
        }),
        (error) => error.code === 'material_unavailable',
      );
      assert.ok(Date.now() - started < 6000, 'provider loss must be bounded');
    }

    // A disabled associated generation is still an exact canonical retained ref;
    // prove its identity without enabling stock or emitting registration/calls.
    if (!reads) {
      const endpoint = snapshot.extensions.find((entry) => entry.generationId);
      if (endpoint) {
        const row = (
          await store.pool.query(
            "SELECT id FROM public.endpoint_credential_operations WHERE installation_id=$1 AND extension_id=$2 AND generation_id=$3 AND state='associated' AND material_health='verified'",
            [snapshot.node.installationId, endpoint.id, endpoint.generationId],
          )
        ).rows[0];
        if (row) {
          await consumer.endpoint({
            installationId: snapshot.node.installationId,
            extensionId: endpoint.id,
            generationId: endpoint.generationId,
            operationId: row.id,
          });
          reads++;
        }
      }
    }
    stage = 'canonical_references';
    console.log(
      JSON.stringify({
        check: 'live-exact-provider-scope',
        extensions: snapshot.extensions.length,
        associatedEndpointReferences: snapshot.extensions.filter(
          (entry) => entry.generationId,
        ).length,
        trunkCredentialReferences: snapshot.trunks.filter(
          (entry) => entry.settings.credential,
        ).length,
      }),
    );
    assert.ok(
      reads > 0,
      'A real canonical referenced material read is required',
    );
    stage = 'foreign_denial';
    const foreign = randomUUID();
    const denied = new ExactLiveMaterialConsumer({
      ...settings,
      installationId: foreign,
    });
    await assert.rejects(
      denied.endpoint({
        installationId: foreign,
        extensionId: randomUUID(),
        generationId: randomUUID(),
        operationId: randomUUID(),
      }),
      (error) => error.code === 'material_denied',
    );
    console.log(
      JSON.stringify({
        check: 'live-exact-provider',
        state: 'passed',
        installationId: configuration.installationId,
        exactCanonicalReads: reads,
        foreignInstallationDenied: true,
        unavailableTransportBounded: !!reference,
        pbxEffects: false,
        materialOutput: false,
      }),
    );
  } finally {
    await store.close();
  }
}
void main().catch((error) => {
  console.error(
    JSON.stringify({
      check: 'live-exact-provider',
      state: 'failed',
      stage,
      databaseCode: /^[0-9A-Z]{5}$/.test(error?.code ?? '')
        ? error.code
        : undefined,
      failureCode: [
        'material_missing',
        'material_denied',
        'material_invalid',
        'material_unavailable',
      ].includes(error?.code)
        ? error.code
        : 'canonical_material_proof_unavailable',
    }),
  );
  process.exitCode = 1;
});
