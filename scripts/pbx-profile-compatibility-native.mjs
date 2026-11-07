// Only mounted inside the network-none disposable compatibility copy.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
let stage = 'construction';
process.on('uncaughtException', (error) => {
  console.log(
    JSON.stringify({
      passed: false,
      stage,
      failure: [
        'boundary_unavailable',
        'verification_failed',
        'reconciliation_required',
      ].includes(error?.code)
        ? error.code
        : 'proof_failed',
      reason: [
        'endpoint_count',
        'auth_count',
        'aor_count',
        'dialplan',
        'marker',
        'trunk_parameters',
      ].includes(error?.reason)
        ? error.reason
        : null,
    }),
  );
  process.exit(1);
});
const expected = JSON.parse(process.argv[2]);
const load = createRequire('/workspace/services/backend/package.json');
const base = './dist/modules/telephony/adapters/live/';
const { NativePbxDriver, nativeCli } = load(base + 'native-driver.js');
const { RetainedLivePlans } = load(base + 'retained-plans.js');
const { ProtectedArtifactStore } = load(base + 'artifact-store.js');
const { materializeRevision } = load(base + 'materialize.js');
const root = '/var/lib/myims-pbx/control/' + expected.nodeId;
const artifacts = new ProtectedArtifactStore(
  root + '/staging',
  expected.installationId,
  expected.nodeId,
);
const plans = new RetainedLivePlans(
  root,
  expected.nodeId,
  expected.installationId,
);
const driver = new NativePbxDriver(
  root,
  '/var/lib/myims-pbx/managed',
  artifacts,
  null,
);
const old = plans.load(expected.artifactId);
assert.equal(driver.unmanaged(), expected.unmanagedDigest);
assert.equal(old.unmanaged, expected.unmanagedDigest);
assert.equal(old.identity.compilerVersion, expected.compilerVersion);
assert.equal(old.identity.policyVersion, expected.policyVersion);
assert.equal(
  readFileSync(root + '/initial-baseline', 'utf8'),
  expected.initialBaselineId,
);
const historical = [
  root + '/initial-baseline',
  root + '/baseline-facts.json',
  root + '/boundary.json',
  root + '/plans/' + expected.initialBaselineId + '.json',
  root + '/plans/' + expected.artifactId + '.json',
].map((path) => [
  path,
  createHash('sha256').update(readFileSync(path)).digest('hex'),
]);
const modulesPath = '/etc/asterisk/modules.conf';
const originalModules = readFileSync(modulesPath);
const additions = [
  'bridge_simple',
  'res_speech',
  'res_agi',
  'func_channel',
  'res_pjsip_header_funcs',
  'res_pjsip_endpoint_identifier_ip',
];
let child, exited;
const stop = async () => {
  if (!child || exited) return;
  assert.match(
    await nativeCli('core show channels count'),
    /^0 active channels\s*$/m,
  );
  const complete = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([
    complete,
    delay(5000).then(() => {
      if (!exited) throw new Error('Isolated process did not exit');
    }),
  ]);
};
const start = async () => {
  const log = openSync('/tmp/profile-proof.log', 'a', 0o600);
  exited = false;
  child = spawn('/usr/sbin/asterisk', ['-f', '-U', 'asterisk'], {
    stdio: ['ignore', log, log],
  });
  closeSync(log);
  child.once('exit', () => {
    exited = true;
  });
  const deadline = Date.now() + 15000;
  while (!exited && Date.now() < deadline) {
    try {
      if ((await nativeCli('core waitfullybooted')).includes('fully booted'))
        return;
    } catch {
      /* bounded independent startup */
    }
    await delay(100);
  }
  throw new Error('Isolated Asterisk unavailable');
};
try {
  stage = 'old_pair_start';
  await start();
  stage = 'old_pair_verify';
  await driver.verify(old.identity, old.snapshot, old.unmanaged);
  await stop();
  stage = 'new_modules';
  writeFileSync(
    modulesPath,
    Buffer.concat([
      originalModules,
      Buffer.from(
        '\n' + additions.map((m) => 'load = ' + m + '.so').join('\n') + '\n',
      ),
    ]),
  );
  await start();
  for (const module of additions)
    assert.match(
      await nativeCli('module show like ' + module + '.so'),
      new RegExp('^' + module + '\\.so\\s', 'm'),
    );
  await assert.rejects(() =>
    driver.verify(old.identity, old.snapshot, old.unmanaged),
  );
  stage = 'candidate_stage';
  const candidate = {
    identity: {
      ...old.identity,
      revisionId: randomUUID(),
      sequence: old.identity.sequence + 1,
    },
    snapshot: old.snapshot,
    unmanaged: driver.unmanaged(),
  };
  // This compatibility proof deliberately supports only material-free retained
  // snapshots. Exact provider-backed staging belongs to the transition engine.
  assert.equal(
    old.snapshot.extensions.filter((e) => e.administrativeStatus === 'enabled')
      .length,
    0,
  );
  assert.equal(
    old.snapshot.trunks.filter((t) => t.settings.credential).length,
    0,
  );
  artifacts.stage(
    candidate.identity,
    materializeRevision(candidate.snapshot, candidate.identity.revisionId, {
      endpoints: new Map(),
      trunks: new Map(),
    }),
  );
  plans.save(candidate);
  await stop();
  stage = 'candidate_select';
  driver.select(candidate.identity);
  await start();
  stage = 'candidate_verify';
  await driver.verify(
    candidate.identity,
    candidate.snapshot,
    candidate.unmanaged,
  );
  await stop();
  stage = 'old_pair_restore';
  writeFileSync(modulesPath, originalModules);
  driver.select(old.identity);
  await start();
  await driver.verify(old.identity, old.snapshot, old.unmanaged);
  for (const [path, hash] of historical)
    assert.equal(
      createHash('sha256').update(readFileSync(path)).digest('hex'),
      hash,
    );
  assert.equal(driver.unmanaged(), expected.unmanagedDigest);
  await stop();
  console.log(
    JSON.stringify({
      check: 'isolated-profile-pair-compatibility',
      passed: true,
      nodeId: expected.nodeId,
      installationId: expected.installationId,
      initialBaselineId: expected.initialBaselineId,
      oldArtifactId: expected.artifactId,
      oldUnmanagedDigest: expected.unmanagedDigest,
      newUnmanagedDigest: candidate.unmanaged,
      newIsolatedArtifactId: candidate.identity.revisionId,
      actualLoadedModules: additions,
      actualAsteriskStarts: 4,
      oldArtifactRejectedWithNewProfile: true,
      newPairVerified: true,
      exactOldPairRestored: true,
      immutableHistoryPreserved: true,
      network: 'none',
      callsPlaced: 0,
      sqlTransitionTested: false,
      interruptionRecoveryTested: false,
      retainedMutation: false,
    }),
  );
} finally {
  if (child && !exited) {
    child.kill('SIGTERM');
    await delay(1000);
    if (!exited) child.kill('SIGKILL');
  }
}
