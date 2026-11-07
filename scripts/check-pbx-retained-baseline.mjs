// Trusted host pipes this check into the retained native container.
// No ownership acquisition, selection, reload, traffic or provider access.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, lstatSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
if (process.argv[2] === '--host') {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'myims-rebuild-dev-asterisk-1',
      'node',
      '--input-type=module',
    ],
    {
      input: readFileSync(new URL(import.meta.url)),
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1048576,
    },
  );
  if (result.status !== 0)
    throw new Error(
      'Retained baseline requires reconciliation; no mutation performed',
    );
  process.stdout.write(result.stdout);
  process.exit(0);
}
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/configuration.js',
);
const { liveConfiguration } = load('./configuration.js');
const { LiveExecutionStore } = load('./execution-store.js');
const { ProtectedArtifactStore } = load('./artifact-store.js');
const { NativePbxDriver } = load('./native-driver.js');
const { NativeAdmissionBarrier } = load('./admission.js');
const { RetainedLivePlans } = load('./retained-plans.js');
const { ProtectedStaticProfiles, selectedStaticProfile } = load(
  './static-profiles.js',
);
const config = liveConfiguration(
  '/run/pbx-live-native/configuration.json',
  false,
);
const root = `/var/lib/myims-pbx/control/${config.nodeId}`;
const initial = readFileSync(root + '/initial-baseline', 'utf8');
for (const path of [
  root,
  root + '/staging',
  root + '/plans',
  '/var/lib/myims-pbx/managed',
  '/var/lib/myims-pbx/validators',
])
  assert.ok(lstatSync(path).isDirectory(), 'retained paths must already exist');
const store = new LiveExecutionStore(config.database);
const cli = (command) =>
  execFileSync('asterisk', ['-rx', command], {
    encoding: 'utf8',
    timeout: 5000,
    killSignal: 'SIGKILL',
    maxBuffer: 1048576,
  });
try {
  const state = async () =>
    (
      await store.pool.query(
        'SELECT r.*,n.installation_id FROM public.pbx_live_runtime r JOIN public.pbx_nodes n ON n.id=r.node_id WHERE r.node_id=$1',
        [config.nodeId],
      )
    ).rows[0];
  const row = await state();
  assert.equal(row.installation_id, config.installationId);
  assert.equal(row.runtime_state, 'verified');
  assert.equal(row.active_operation_id, null);
  assert.equal(row.active_retirement_id, null);
  assert.equal(row.active_profile_operation_id ?? null, null);
  assert.equal(row.installed_id, row.verified_id);
  assert.equal(row.known_good_id, row.verified_id);
  const journal = JSON.parse(readFileSync(root + '/boundary.json', 'utf8'));
  assert.equal(journal.pending, null);
  assert.equal(journal.verifiedId, row.verified_id);
  const artifact = new RetainedLivePlans(
    root,
    config.nodeId,
    config.installationId,
    true,
  ).load(row.verified_id);
  const artifacts = new ProtectedArtifactStore(
    root + '/staging',
    config.installationId,
    config.nodeId,
  );
  const driver = new NativePbxDriver(
    root,
    '/var/lib/myims-pbx/managed',
    artifacts,
    new NativeAdmissionBarrier(['127.0.0.1']),
    true,
  );
  const original = new RetainedLivePlans(
    root,
    config.nodeId,
    config.installationId,
    true,
  ).load(initial);
  artifacts.load(original.identity);
  assert.equal(original.identity.compilerVersion, 'baseline-1');
  assert.equal(
    JSON.parse(readFileSync(root + '/baseline-facts.json', 'utf8')).unmanaged,
    original.unmanaged,
  );
  assert.equal(
    (
      await store.pool.query(
        'SELECT 1 FROM public.pbx_live_artifacts WHERE id=$1 AND node_id=$2 AND initial_baseline',
        [initial, config.nodeId],
      )
    ).rows.length,
    1,
  );
  if (selectedStaticProfile(root)) {
    const gid = Number(
      readFileSync('/etc/group', 'utf8')
        .split('\n')
        .find((l) => l.startsWith('asterisk:'))
        ?.split(':')[2],
    );
    new ProtectedStaticProfiles(root, gid).verifyProjection(original.unmanaged);
  } else assert.equal(original.unmanaged, driver.unmanaged());
  // Inspection-only construction never creates paths, changes modes, captures
  // a baseline or promotes canonical state. Mutating methods reject in this mode.
  await driver.verify(artifact.identity, artifact.snapshot, artifact.unmanaged);
  assert.ok(cli('core show channels count').includes('0 active channels'));
  assert.ok(cli('core waitfullybooted').includes('fully booted'));
  const after = await state();
  assert.equal(after.verified_id, row.verified_id);
  assert.equal(after.active_operation_id, null);
  assert.equal(after.active_retirement_id, null);
  assert.equal(after.active_profile_operation_id ?? null, null);
  console.log(
    JSON.stringify({
      check: 'retained-baseline',
      state: 'passed',
      nodeId: config.nodeId,
      installationId: config.installationId,
      initialBaselineId: initial,
      retainedRevisionId: row.verified_id,
      unmanagedDigest: driver.unmanaged(),
      exactProtectedAndLoadedRuntimeMatch: true,
      activeChannels: 0,
      pendingOperation: false,
    }),
  );
} finally {
  await store.close();
}
