// Trusted Docker launcher. These two modes have no mutation path.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  expectations,
  profileSummary,
  requiredModules,
} from './pbx-profile-inspect.mjs';
const [mode, ...args] = process.argv.slice(2);
try {
  let expected = null,
    target;
  if (mode === 'status' && args.length === 2) {
    target = { nodeId: args[0], installationId: args[1] };
  } else if (mode === 'preflight' && args.length === 1) {
    const bytes = readFileSync(args[0]);
    if (bytes.length > 8192) throw new Error();
    expected = expectations(JSON.parse(bytes));
    target = {
      nodeId: expected.nodeId,
      installationId: expected.installationId,
    };
  } else throw new Error();
  const valid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
  if (!valid.test(target.nodeId) || !valid.test(target.installationId))
    throw new Error();
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '--user',
      '0',
      'myims-rebuild-dev-asterisk-1',
      'node',
      '--input-type=module',
      '-',
      '--native-profile-inspect',
      JSON.stringify({ expected, target }),
    ],
    {
      input: readFileSync(
        new URL('./pbx-profile-inspect.mjs', import.meta.url),
      ),
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 1048576,
    },
  );
  if (![0, 2].includes(result.status)) throw new Error();
  const report = JSON.parse(result.stdout);
  if (
    report.nodeId === target.nodeId &&
    report.installationId === target.installationId
  ) {
    const probe = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--user',
        `${process.getuid()}:${process.getgid()}`,
        '--network',
        'myims-rebuild-dev_endpoint-credentials',
        '--mount',
        'type=volume,src=myims-rebuild-dev_pbx-live-consumer,dst=/consumer,readonly',
        '--mount',
        `type=bind,src=${process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd()}/scripts/pbx-profile-provider.mjs,dst=/probe.mjs,readonly`,
        'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c',
        'node',
        '/probe.mjs',
        '--consumer',
        target.installationId,
      ],
      { encoding: 'utf8', timeout: 10000, maxBuffer: 8192 },
    );
    let custody;
    try {
      custody = JSON.parse(probe.stdout);
    } catch {
      custody = { state: 'unavailable' };
    }
    report.providerCustody =
      custody.state === 'available' ? 'scoped_access_available' : 'unavailable';
    if (custody.state !== 'available')
      report.blockers.push('provider_access_unavailable');
    if (report.pins?.materialReferences.length) {
      report.blockers.push('exact_provider_material_probe_required');
    }
  }
  const directory = new URL('../reference/asterisk_config/', import.meta.url);
  const files = Object.fromEntries(
    ['modules.conf', 'rtp.conf', 'pjsip.conf'].map((name) => [
      name,
      readFileSync(new URL(name, directory)),
    ]),
  );
  report.referenceProfile = profileSummary(files);
  report.referenceManifest = readdirSync(directory)
    .sort()
    .map((name) => ({
      name,
      sha256: createHash('sha256')
        .update(readFileSync(new URL(name, directory)))
        .digest('hex'),
    }));
  report.proposedProfile = {
    baseUnmanagedDigest: report.unmanagedDigest ?? null,
    addExplicitLoads: requiredModules.filter(
      (name) => !report.currentProfile?.explicitLoads.includes(name),
    ),
    autoload: 'no',
    nativeRtpBridge: 'excluded_by_explicit_allowlist',
    media: 'anchored',
    rtp: [10020, 10039],
    strictRtp: 'preserve_current',
    transportsAndNat: 'preserve_current_no_external_address_or_WebRTC_addition',
    proposedUnmanagedDigest: report.proposedUnmanagedDigest ?? null,
    status: 'reviewed_transition_requires_rehearsal_and_exact_preconditions',
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = expected && report.blockers.length ? 2 : 0;
} catch {
  console.error(
    'Profile inspection unavailable. Usage: ./dev pbx-profile status NODE_UUID INSTALLATION_UUID | preflight EXPECTATIONS.json',
  );
  process.exitCode = 2;
}
