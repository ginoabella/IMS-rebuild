import { mkdirSync, chmodSync, chownSync } from 'node:fs';
import { liveConfiguration } from '../../modules/telephony/adapters/live/configuration';
import { ProtectedArtifactStore } from '../../modules/telephony/adapters/live/artifact-store';
import { NativeAdmissionBarrier } from '../../modules/telephony/adapters/live/admission';
import { NativePbxDriver } from '../../modules/telephony/adapters/live/native-driver';
import { LiveExecutionStore } from '../../modules/telephony/adapters/live/execution-store';
import { NativeLiveApplication } from '../../modules/telephony/adapters/live/native-application';
import { NativeDenyProbes } from '../../modules/telephony/adapters/live/native-probes';
import { NativeOwnerServer } from '../../modules/telephony/adapters/live/native-transport';
import { ReadOnlyObservationGateway } from '../../modules/telephony/adapters/live/observation-gateway';
async function main() {
  process.umask(0o077);
  if (
    process.getuid?.() !== 0 ||
    process.env.PBX_LIVE_PROFILE !== 'approved-local-development'
  )
    throw new Error('Native profile unavailable');
  const configuration = liveConfiguration(
    '/run/pbx-live-native/configuration.json',
    false,
  );
  const root = `/var/lib/myims-pbx/control/${configuration.nodeId}`;
  mkdirSync(root, { recursive: true, mode: 0o700 });
  mkdirSync(root + '/staging', { recursive: true, mode: 0o700 });
  mkdirSync('/run/pbx-live', { recursive: true, mode: 0o750 });
  chownSync('/run/pbx-live', 0, configuration.socketGroup);
  chmodSync('/run/pbx-live', 0o750);
  const artifacts = new ProtectedArtifactStore(
    root + '/staging',
    configuration.installationId,
    configuration.nodeId,
  );
  const admission = new NativeAdmissionBarrier(['127.0.0.1']);
  const driver = new NativePbxDriver(
    root,
    '/var/lib/myims-pbx/managed',
    artifacts,
    admission,
  );
  const store = new LiveExecutionStore(configuration.database);
  const application = new NativeLiveApplication(
    root,
    configuration.nodeId,
    configuration.installationId,
    store,
    artifacts,
    driver,
    admission,
    new NativeDenyProbes(artifacts),
  );
  const server = new NativeOwnerServer(
    '/run/pbx-live/native.sock',
    application,
    configuration.socketGroup,
  );
  const observation = new ReadOnlyObservationGateway(
    '/run/pbx-server/server.pem',
    '/run/pbx-server/server.key',
  );
  await observation.start();
  await server.start();
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    void server
      .close()
      .then(() => driver.drain())
      .then(() => observation.close())
      .then(() => store.close())
      .catch(() => {
        process.exit(1);
      });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  console.log(
    JSON.stringify({
      entrypoint: 'telephony-native',
      state: 'ready',
      profile: 'local-development',
    }),
  );
}
void main().catch(() => {
  console.error(
    JSON.stringify({
      entrypoint: 'telephony-native',
      state: 'failed',
      failureCode: 'startup_failed',
    }),
  );
  process.exit(1);
});
