// Disposable compatibility proof only: no SQL transition/acknowledgement claim.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expectations } from './pbx-profile-inspect.mjs';
const expected = expectations(
  JSON.parse(readFileSync(process.argv[2], 'utf8')),
);
const name = 'myims-profile-compat-' + randomUUID().slice(0, 8);
function docker(args, input, timeout = 30000) {
  const result = spawnSync('docker', args, {
    input,
    timeout,
    maxBuffer: 33554432,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    try {
      const failure = JSON.parse(result.stdout.toString('utf8'));
      if (failure.passed === false && /^[a-z_]{1,40}$/.test(failure.stage))
        console.error(JSON.stringify(failure));
    } catch {
      /* Raw subprocess output stays protected. */
    }
    throw new Error('Isolated profile compatibility proof failed');
  }
  return result.stdout;
}
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
let created = false;
try {
  const args = ['run', '--rm', '-d', '--name', name, '--network', 'none'];
  for (const [source, target] of [
    [project + '/services/backend/dist', '/workspace/services/backend/dist'],
    [
      project + '/services/backend/package.json',
      '/workspace/services/backend/package.json',
    ],
    [project + '/packages/config', '/workspace/packages/config'],
    [project + '/packages/contracts', '/workspace/packages/contracts'],
    [project + '/scripts/pbx-profile-compatibility-native.mjs', '/proof.mjs'],
  ])
    args.push('--mount', `type=bind,src=${source},dst=${target},readonly`);
  for (const [source, target] of [
    ['workspace-deps-0', '/workspace/node_modules'],
    ['workspace-deps-10', '/workspace/services/backend/node_modules'],
    ['workspace-deps-6', '/workspace/packages/config/node_modules'],
    ['workspace-deps-7', '/workspace/packages/contracts/node_modules'],
  ])
    args.push(
      '--mount',
      `type=volume,src=myims-rebuild-dev_${source},dst=${target},readonly`,
    );
  args.push(
    '--entrypoint',
    '/bin/sleep',
    'myims-rebuild-dev-asterisk-live',
    'infinity',
  );
  docker(args);
  created = true;
  // Bytes stay in memory and the isolated container's private writable layer.
  // Never mount retained custody writable, export it to the workspace, or log tar.
  const archive = docker([
    'exec',
    'myims-rebuild-dev-asterisk-1',
    'tar',
    '-C',
    '/',
    '-cf',
    '-',
    'etc/asterisk',
    'var/lib/myims-pbx/control/' + expected.nodeId,
    'var/lib/myims-pbx/managed',
  ]);
  docker([
    'exec',
    name,
    '/bin/sh',
    '-c',
    'find /etc/asterisk -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +',
  ]);
  docker(['exec', '-i', name, 'tar', '-C', '/', '-xpf', '-'], archive);
  const result = docker(
    [
      'exec',
      name,
      '/bin/sh',
      '-c',
      'exec 3<"/var/lib/myims-pbx/control/$1/boundary.lock"; flock -n 3; exec node /proof.mjs "$2"',
      'myims-profile-compatibility',
      expected.nodeId,
      JSON.stringify(expected),
    ],
    undefined,
    120000,
  );
  const report = JSON.parse(result.toString('utf8'));
  if (report.passed !== true)
    throw new Error('Isolated compatibility result unavailable');
  docker(['rm', '-fv', name]);
  created = false;
  console.log(
    JSON.stringify({ ...report, isolatedContainerRemoved: true }, null, 2),
  );
} finally {
  if (created) docker(['rm', '-fv', name]);
}
