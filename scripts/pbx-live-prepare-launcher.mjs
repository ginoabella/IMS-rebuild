// Trusted one-shot setup; exact input/output mounts, no project or Next process.
import { spawnSync } from 'node:child_process';
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1048576,
  });
  if (result.status !== 0)
    throw new Error('Protected live preparation unavailable');
  return result.stdout;
}
const server = 'myims-rebuild-dev-asterisk-1';
const replicas = docker([
  'ps',
  '--filter',
  'label=com.docker.compose.project=myims-rebuild-dev',
  '--filter',
  'label=com.docker.compose.service=telephony',
  '--format',
  '{{.Names}}',
])
  .trim()
  .split('\n')
  .filter(Boolean);
if (!replicas.length)
  throw new Error('Existing telephony identity unavailable');
const identities = replicas.map((name) => [
  docker(['exec', name, 'id', '-u']).trim(),
  docker(['exec', name, 'id', '-g']).trim(),
]);
if (identities.some((value) => value.join(':') !== identities[0].join(':')))
  throw new Error('Telephony replica identities differ');
const [uid, gid] = identities[0],
  owner = docker(['exec', server, 'id', '-u', 'asterisk']).trim(),
  group = docker(['exec', server, 'id', '-g', 'asterisk']).trim();
if ([uid, gid, owner, group].some((value) => !/^[1-9][0-9]{0,8}$/.test(value)))
  throw new Error('Invalid actual deployment identity');
const manager = docker([
  'exec',
  server,
  'python3',
  '-c',
  "from pathlib import Path;import sys;sys.stdout.write(Path('/etc/asterisk/manager.conf').read_text())",
]);
if (Buffer.byteLength(manager) > 16384)
  throw new Error('Protected manager input exceeds bound');
const args = [
  'run',
  '--rm',
  '-i',
  '--user',
  'root',
  '--network',
  'myims-rebuild-dev_default',
  '-e',
  `PBX_RUNTIME_UID=${uid}`,
  '-e',
  `PBX_RUNTIME_GID=${gid}`,
  '-e',
  `PBX_SERVER_UID=${owner}`,
  '-e',
  `PBX_SERVER_GID=${group}`,
  '-e',
  'MIGRATION_DATABASE_URL=postgresql://myims@postgres:5432/myims',
  '-e',
  'MIGRATION_DATABASE_PASSWORD_FILE=/input/postgres.password',
];
for (const [source, target] of [
  ['scripts/prepare-pbx-live.mjs', '/workspace/scripts/prepare-pbx-live.mjs'],
  ['services/backend/package.json', '/workspace/services/backend/package.json'],
  ['.local/shared-services/postgres-password', '/input/postgres.password'],
  ['.local/pbx-catalog/catalog.json', '/input/catalog.json'],
  ['infra/asterisk/bootstrap', '/input/bootstrap'],
])
  args.push(
    '--mount',
    `type=bind,src=${project}/${source},dst=${target},readonly`,
  );
args.push(
  '--mount',
  `type=bind,src=${project}/.local/pbx-live/native,dst=/output-native`,
  '--mount',
  'type=volume,src=myims-rebuild-dev_pbx-live-consumer,dst=/output-consumer',
  '--mount',
  'type=volume,src=myims-rebuild-dev_workspace-deps-0,dst=/workspace/node_modules,readonly',
  '--mount',
  'type=volume,src=myims-rebuild-dev_workspace-deps-10,dst=/workspace/services/backend/node_modules,readonly',
  'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c',
  'node',
  '/workspace/scripts/prepare-pbx-live.mjs',
);
const result = spawnSync('docker', args, {
  input: manager,
  encoding: 'utf8',
  stdio: ['pipe', 'inherit', 'inherit'],
});
if (result.status !== 0) process.exitCode = result.status ?? 1;
