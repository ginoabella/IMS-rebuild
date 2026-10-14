// Trusted deployment utility; runtime receives the resulting non-secret catalog,
// never a Docker socket or credential file. Preserve identity across refreshes.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { join } from 'node:path';
function inspect(format) {
  const result = spawnSync(
    'docker',
    ['inspect', '--format', format, 'myims-rebuild-dev-asterisk-1'],
    { encoding: 'utf8', timeout: 10000 },
  );
  if (result.status !== 0)
    throw new Error('Controlled PBX service inspection unavailable');
  return result.stdout.trim();
}
try {
  if (
    inspect('{{index .Config.Labels "com.docker.compose.service"}}') !==
      'asterisk' ||
    inspect('{{index .Config.Labels "com.docker.compose.project"}}') !==
      'myims-rebuild-dev'
  )
    throw new Error('Controlled PBX service identity unavailable');
  const address = inspect(
    '{{(index .NetworkSettings.Networks "myims-rebuild-dev_default").IPAddress}}',
  );
  if (isIP(address) !== 4)
    throw new Error('Controlled PBX address unavailable');
  const directory = join(process.cwd(), '.local', 'pbx-catalog');
  mkdirSync(directory, { recursive: true, mode: 0o755 });
  const identityFile = join(directory, 'installation-id');
  if (!existsSync(identityFile))
    writeFileSync(identityFile, randomUUID() + '\n', {
      flag: 'wx',
      mode: 0o644,
    });
  const installationId = readFileSync(identityFile, 'utf8').trim();
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      installationId,
    )
  )
    throw new Error('Controlled PBX installation identity unavailable');
  const catalog = [
    {
      installationId,
      targetAlias: 'local-asterisk',
      aliases: ['local-pbx'],
      host: 'asterisk',
      transport: 'ami-tls',
      port: 5039,
      tlsServerName: 'asterisk',
      addresses: [address],
      credentialAliases: ['local-asterisk-observer'],
    },
  ];
  writeFileSync(
    join(directory, 'catalog.json'),
    JSON.stringify(catalog, null, 2) + '\n',
    { mode: 0o644 },
  );
  console.log(
    'Prepared non-secret local PBX catalog; installation identity preserved. Authenticated observation remains pending.',
  );
} catch {
  console.error(
    'PBX catalog provisioning failed; no runtime connectivity is authorized.',
  );
  process.exitCode = 1;
}
