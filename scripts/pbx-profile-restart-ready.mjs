// Only the trusted host dispatcher invokes this read-only last-moment check.
import { createRequire } from 'node:module';
const load = createRequire('/workspace/services/backend/package.json');
const base = './dist/modules/telephony/adapters/live/';
const { liveConfiguration, protectedLiveBytes } = load(
  base + 'configuration.js',
);
const { NativeAdmissionBarrier } = load(base + 'admission.js');
const { ProtectedStaticProfiles, selectedStaticProfile } = load(
  base + 'static-profiles.js',
);
const { readFileSync, readlinkSync, lstatSync } = await import('node:fs');
const input = JSON.parse(process.argv[2]);
const config = liveConfiguration(
  '/run/pbx-live-native/configuration.json',
  false,
);
if (
  config.nodeId !== input.nodeId ||
  config.installationId !== input.installationId
)
  throw new Error('Restart target unavailable');
const root = '/var/lib/myims-pbx/control/' + config.nodeId;
const journal = JSON.parse(
  protectedLiveBytes(root + '/boundary.json', 1048576),
);
const intent = JSON.parse(
  protectedLiveBytes(
    root + '/profile-operations/' + input.operationId + '.json',
    4096,
  ),
);
const selected = selectedStaticProfile(root);
if (
  journal.epoch !== input.epoch ||
  journal.incarnation !== input.incarnation ||
  journal.pending ||
  intent.stage !== 'prepared' ||
  !selected ||
  selected.artifactId !== input.targetArtifactId ||
  selected.digest !== input.targetDigest
)
  throw new Error('Restart proof unavailable');
const gid = Number(
  readFileSync('/etc/group', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('asterisk:'))
    ?.split(':')[2],
);
new ProtectedStaticProfiles(root, gid).verifyProjection(selected.digest);
const { RetainedLivePlans } = load(base + 'retained-plans.js');
const { ProtectedArtifactStore } = load(base + 'artifact-store.js');
const plan = new RetainedLivePlans(
  root,
  config.nodeId,
  config.installationId,
  true,
).load(input.targetArtifactId);
if (
  plan.unmanaged !== selected.digest ||
  readlinkSync('/var/lib/myims-pbx/managed/current') !== input.targetArtifactId
)
  throw new Error('Managed selection unavailable');
const files = new ProtectedArtifactStore(
  root + '/staging',
  config.installationId,
  config.nodeId,
).load(plan.identity);
for (const [name, bytes] of [
  ['pjsip.conf', files.pjsip],
  ['extensions.conf', files.dialplan],
]) {
  const path =
    '/var/lib/myims-pbx/managed/' + input.targetArtifactId + '/' + name;
  const stat = lstatSync(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.uid !== 0 ||
    stat.gid !== gid ||
    (stat.mode & 0o777) !== 0o640 ||
    !readFileSync(path).equals(bytes)
  )
    throw new Error('Managed projection unavailable');
}
const barrier = new NativeAdmissionBarrier(['127.0.0.1']);
await barrier.assertClosed();
if (!(await barrier.idle())) throw new Error('Restart activity unavailable');
console.log(JSON.stringify({ restartReady: true }));
