// Disposable native side: exact staged material only, never provider custody.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, chownSync, chmodSync } from 'node:fs';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/native-application.js',
);
const { ProtectedArtifactStore } = load('./artifact-store.js');
const { NativeAdmissionBarrier } = load('./admission.js');
const { NativePbxDriver } = load('./native-driver.js');
const { NativeDenyProbes } = load('./native-probes.js');
const { NativeLiveApplication } = load('./native-application.js');
const { NativeOwnerServer } = load('./native-transport.js');
const { LiveExecutionStore } = load('./execution-store.js');
const m = JSON.parse(readFileSync('/input/integration.json', 'utf8'));
const url = new URL(
  'postgresql://myims_pbx_executor@postgres:5432/' + m.database,
);
url.password = readFileSync('/input/executor.password', 'utf8').trim();
const root = '/var/lib/myims-pbx/control/' + m.nodeId;
mkdirSync(root + '/staging', { recursive: true, mode: 0o700 });
chownSync('/run/pbx-live', 0, m.socketGroup);
chmodSync('/run/pbx-live', 0o750);
const artifacts = new ProtectedArtifactStore(
  root + '/staging',
  m.installationId,
  m.nodeId,
);
const admission = new NativeAdmissionBarrier(['127.0.0.1']);
const driver = new NativePbxDriver(
  root,
  '/var/lib/myims-pbx/managed',
  artifacts,
  admission,
);
const store = new LiveExecutionStore(url.href);
const server = new NativeOwnerServer(
  '/run/pbx-live/native.sock',
  new NativeLiveApplication(
    root,
    m.nodeId,
    m.installationId,
    store,
    artifacts,
    driver,
    admission,
    new NativeDenyProbes(artifacts),
  ),
  m.socketGroup,
);
await server.start();
let closing = false;
process.once('SIGTERM', () => {
  if (closing) return;
  closing = true;
  void server
    .close()
    .then(() => driver.drain())
    .then(() => store.close())
    .catch(() => {
      process.exitCode = 1;
    });
});
