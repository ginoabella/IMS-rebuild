// Owned acceptance child. The parent holds the native serial queue and passes
// its existing physical guardian descriptor; no other mutation runs concurrently.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const load = createRequire('/workspace/services/backend/package.json');
const { ProtectedArtifactStore } = load(
  './dist/modules/telephony/adapters/live/artifact-store.js',
);
const { NativeAdmissionBarrier } = load(
  './dist/modules/telephony/adapters/live/admission.js',
);
const { NativePbxDriver } = load(
  './dist/modules/telephony/adapters/live/native-driver.js',
);
const { NativeLiveApplication } = load(
  './dist/modules/telephony/adapters/live/native-application.js',
);
const { NativeDenyProbes } = load(
  './dist/modules/telephony/adapters/live/native-probes.js',
);
const { LiveExecutionStore } = load(
  './dist/modules/telephony/adapters/live/execution-store.js',
);
const { RetainedLivePlans } = load(
  './dist/modules/telephony/adapters/live/retained-plans.js',
);
const { retireArtifact } = load(
  './dist/modules/telephony/adapters/live/artifact-retirement.js',
);
const metadata = JSON.parse(readFileSync('/input/integration.json', 'utf8'));
assert.match(metadata.database, /^myims_session_[a-f0-9]{12}$/);
const root = '/var/lib/myims-pbx/control/' + metadata.nodeId;
const token = JSON.parse(readFileSync(root + '/retirement-child.json', 'utf8'));
assert.equal(token.nodeId, metadata.nodeId);
const url = new URL(
  'postgresql://myims_pbx_executor@postgres:5432/' + metadata.database,
);
url.password = readFileSync('/input/executor.password', 'utf8').trim();
const store = new LiveExecutionStore(url.href);
const artifacts = new ProtectedArtifactStore(
  root + '/staging',
  metadata.installationId,
  metadata.nodeId,
);
const barrier = new NativeAdmissionBarrier(['127.0.0.1']);
const driver = new NativePbxDriver(
  root,
  '/var/lib/myims-pbx/managed',
  artifacts,
  barrier,
);
const native = new NativeLiveApplication(
  root,
  metadata.nodeId,
  metadata.installationId,
  store,
  artifacts,
  driver,
  barrier,
  new NativeDenyProbes(artifacts),
);
await native.connect(token);
// Reached only after actual native tombstone/file/directory fsync. Abrupt exit
// intentionally skips JS catch/finally and canonical completion.
barrier.quiet = async () => {
  process.stdout.write(
    'RETIREMENT_NATIVE_INTERRUPTED_AFTER_DURABLE_TOMBSTONE\n',
    () => process.exit(73),
  );
  await new Promise(() => {});
};
await retireArtifact(
  root,
  metadata.nodeId,
  store,
  driver,
  barrier,
  new RetainedLivePlans(root, metadata.nodeId, metadata.installationId),
  artifacts,
  (id, action) => native.maintain(id, action),
);
throw new Error('Owned native interruption point was not reached');
