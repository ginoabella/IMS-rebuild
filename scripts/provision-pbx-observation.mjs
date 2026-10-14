// Trusted local deployment only. Capture/discard all command output containing material.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.env.STORAGE_HOST_PROJECT_ROOT;
if (!root) throw new Error('Trusted project root unavailable');
const directory = join(process.cwd(), '.local/pbx-observation');
mkdirSync(directory, { recursive: true, mode: 0o711 });
function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) throw new Error('PBX provisioning operation failed');
  return r.stdout.trim();
}
try {
  const uid = Number(
    docker(['exec', 'myims-rebuild-dev-asterisk-1', 'id', '-u', 'asterisk']),
  );
  const runtimeUid = Number(
    docker(['exec', 'myims-rebuild-dev-workspace-1', 'id', '-u', 'node']),
  );
  if (!uid || !runtimeUid) throw new Error();
  docker([
    'run',
    '--rm',
    '--entrypoint',
    'node',
    '--mount',
    `type=bind,src=${root},dst=/workspace,readonly`,
    '--mount',
    `type=bind,src=${root}/.local/pbx-observation,dst=/provision`,
    '-e',
    `PBX_SERVER_UID=${uid}`,
    '-e',
    `PBX_RUNTIME_UID=${runtimeUid}`,
    'myims-rebuild-dev-workspace',
    '/workspace/scripts/init-pbx-observation.mjs',
    ...(process.argv.includes('--rotate') ? ['--rotate'] : []),
  ]);
  if (!existsSync(join(directory, 'enabled')))
    writeFileSync(join(directory, 'enabled'), 'approved-local-development\n', {
      mode: 0o644,
    });
  console.log(
    'Provisioned protected local observer material; no credential output. Account system permissions exceed the application action allowlist.',
  );
} catch {
  console.error('PBX observation provisioning failed');
  process.exitCode = 1;
}
