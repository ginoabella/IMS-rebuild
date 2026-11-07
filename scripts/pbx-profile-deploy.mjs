// Trusted explicit host deployment. No mutation is reachable from status/health.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  profileCompose,
  assertProfileComposition,
} from './pbx-profile-compose.mjs';
import { dispatchProfileRestart } from './pbx-profile-dispatch.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { expectations } from './pbx-profile-inspect.mjs';
const [
  action,
  file,
  operationId,
  targetArtifactId,
  targetDigest,
  predecessorId,
] = process.argv.slice(2);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const expected = expectations(JSON.parse(readFileSync(file, 'utf8')));
if (
  !['upgrade', 'rollback', 'operation-status', 'reconcile'].includes(action) ||
  !uuid.test(operationId)
)
  throw new Error('Exact profile operation required');
const identity = {
  operationId,
  nodeId: expected.nodeId,
  installationId: expected.installationId,
};
function docker(args, options = {}) {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1048576,
    ...options,
  });
  if (r.status !== 0)
    throw new Error(
      'Profile operation unavailable; reconcile the exact operation before further effects',
    );
  return r.stdout;
}
function workspace(mode, value = identity) {
  const output = docker([
    'exec',
    '--user',
    'node',
    'myims-rebuild-dev-workspace-1',
    'node',
    '/workspace/scripts/pbx-profile-operation.mjs',
    mode,
    JSON.stringify(value),
  ]);
  const lines = output.trim().split('\n');
  return JSON.parse(lines.at(-1));
}
if (['operation-status', 'reconcile'].includes(action)) {
  // Reconciliation is independent native inspection of the committed operation.
  // It never sends another selector or restart request.
  let result = workspace('status');
  const deadline = Date.now() + 30000;
  while (
    action === 'reconcile' &&
    Date.now() < deadline &&
    !['verified', 'rolled_back', 'prepared', 'unknown'].includes(result.state)
  ) {
    await delay(500);
    result = workspace('status');
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
const request = {
  ...identity,
  kind: action,
  sourceArtifactId: expected.artifactId,
  sourceDigest: expected.unmanagedDigest,
  targetArtifactId: action === 'upgrade' ? operationId : targetArtifactId,
  targetDigest:
    action === 'upgrade' ? expected.proposedUnmanagedDigest : targetDigest,
  nodeVersion: expected.nodeVersion,
  compilerVersion: expected.compilerVersion,
  policyVersion: expected.policyVersion,
  initialBaselineId: expected.initialBaselineId,
  predecessorId: predecessorId ?? null,
};
assertProfileComposition(docker);
workspace('accept', request);
let state;
const deadline = Date.now() + 150000;
while (Date.now() < deadline) {
  state = workspace('status');
  if (['verified', 'rolled_back'].includes(state.state)) {
    console.log(JSON.stringify(state, null, 2));
    process.exit(0);
  }
  if (state.state === 'prepared') break;
  if (['unknown', 'restart_dispatched'].includes(state.state))
    throw new Error(
      'Profile outcome uncertain; inspect/reconcile the exact operation or issue an explicit compatible rollback',
    );
  await delay(500);
}
if (state?.state !== 'prepared')
  throw new Error(
    'Profile preparation deferred or unavailable; retain the exact operation',
  );
await dispatchProfileRestart({
  workspacePrefix: [
    'exec',
    '-i',
    '--user',
    'node',
    'myims-rebuild-dev-workspace-1',
  ],
  identity,
  nativeContainer: 'myims-rebuild-dev-asterisk-1',
  targetArtifactId: request.targetArtifactId,
  targetDigest: request.targetDigest,
  effect: async () => {
    const args = [
      ...profileCompose(),
      'up',
      '-d',
      '--no-deps',
      '--force-recreate',
      'asterisk',
    ];
    docker(args, { timeout: 60000 });
  },
});
const proofDeadline = Date.now() + 90000;
while (Date.now() < proofDeadline) {
  state = workspace('status');
  if (['verified', 'rolled_back'].includes(state.state)) {
    console.log(JSON.stringify(state, null, 2));
    process.exit(0);
  }
  await delay(1000);
}
throw new Error(
  'Profile proof/acknowledgement unresolved; reconcile exact operation without another restart',
);
