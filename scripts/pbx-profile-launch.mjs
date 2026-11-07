// Fixed root-only supervisor startup. No provider, SQL promotion, or calls.
import { createRequire } from 'node:module';
import { readFileSync, readlinkSync, lstatSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const load = createRequire('/workspace/services/backend/package.json');
const base = './dist/modules/telephony/adapters/live/';
const { liveConfiguration, protectedLiveBytes } = load(
  base + 'configuration.js',
);
const {
  ProtectedStaticProfiles,
  selectedStaticProfile,
  durableJson,
  staticDigest,
} = load(base + 'static-profiles.js');
const { NativeAdmissionBarrier } = load(base + 'admission.js');
const config = liveConfiguration(
  '/run/pbx-live-native/configuration.json',
  false,
);
const root = '/var/lib/myims-pbx/control/' + config.nodeId;
mkdirSync(root, { recursive: true, mode: 0o700 });
const rootStat = lstatSync(root);
if (
  !rootStat.isDirectory() ||
  rootStat.isSymbolicLink() ||
  rootStat.uid !== 0 ||
  rootStat.mode & 0o077
)
  throw new Error('Profile startup custody unavailable');
const selected = selectedStaticProfile(root);
let pending = null;
try {
  pending = JSON.parse(
    protectedLiveBytes(root + '/profile-pending.json', 1024).toString('utf8'),
  );
  if (
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
      pending.operationId,
    ) ||
    typeof pending.selectionRequired !== 'boolean'
  )
    throw new Error('Profile startup provenance unavailable');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
if (selected || pending)
  await new NativeAdmissionBarrier(['127.0.0.1']).close();
const gid = Number(
  readFileSync('/etc/group', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('asterisk:'))
    ?.split(':')[2],
);
let launch = '/etc/asterisk/asterisk.conf';
if (selected)
  launch = new ProtectedStaticProfiles(root, gid).verifyProjection(
    selected.digest,
  );
// Safety invalidation only: startup cannot select or promote a profile.
const bootId = randomUUID();
durableJson(root + '/profile-supervisor.json', { version: 1, bootId });
{
  const { LiveExecutionStore } = load(base + 'execution-store.js');
  const store = new LiveExecutionStore(config.database);
  try {
    const schema = (
      await store.pool.query(
        "SELECT to_regclass('public.pbx_artifact_profiles') IS NOT NULL AS available",
      )
    ).rows[0].available;
    const recorded =
      schema &&
      (
        await store.pool.query(
          'SELECT 1 FROM public.pbx_artifact_profiles WHERE node_id=$1 LIMIT 1',
          [config.nodeId],
        )
      ).rows.length > 0;
    if (selected || recorded || pending) {
      await store.pool.query(
        "UPDATE public.pbx_live_runtime SET runtime_state='unknown',updated_at=clock_timestamp() WHERE node_id=$1",
        [config.nodeId],
      );
      if (!selected && (recorded || pending)) {
        if (pending?.selectionRequired !== false)
          throw new Error('Recorded profile selection unavailable');
        // Initial custody registration precedes selection. Boot only the exact
        // already-selected legacy pair, behind admission denial, without repair
        // or selection. Any established selector remains required thereafter.
        const runtime = (
          await store.pool.query(
            'SELECT verified_id,active_operation_id FROM public.pbx_live_runtime WHERE node_id=$1',
            [config.nodeId],
          )
        ).rows[0];
        const current = readlinkSync('/var/lib/myims-pbx/managed/current');
        if (
          !runtime ||
          (current !== runtime.verified_id && !runtime.active_operation_id)
        )
          throw new Error('Legacy startup identity unavailable');
        const { RetainedLivePlans } = load(base + 'retained-plans.js');
        const { ProtectedArtifactStore } = load(base + 'artifact-store.js');
        const plan = new RetainedLivePlans(
          root,
          config.nodeId,
          config.installationId,
          true,
        ).load(current);
        const profiles = new ProtectedStaticProfiles(root, gid);
        if (
          staticDigest(profiles.readDirectory('/etc/asterisk')) !==
          plan.unmanaged
        )
          throw new Error('Legacy startup pair unavailable');
        const files = new ProtectedArtifactStore(
          root + '/staging',
          config.installationId,
          config.nodeId,
        ).load(plan.identity);
        for (const [name, bytes] of [
          ['pjsip.conf', files.pjsip],
          ['extensions.conf', files.dialplan],
        ]) {
          const path = '/var/lib/myims-pbx/managed/' + current + '/' + name;
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
            throw new Error('Legacy managed custody unavailable');
        }
      }
    }
  } finally {
    await store.close();
  }
}
process.stdout.write(launch);
