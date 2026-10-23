// Host-side trusted Docker composition, invoked by ./dev. No HTTP material access.
import { spawnSync } from 'node:child_process';
import {
  constants,
  lstatSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
const action = process.argv[2];
mkdirSync('.local/trunk-setup', { recursive: true, mode: 0o700 });
const custody = lstatSync('.local/trunk-setup');
if (
  !custody.isDirectory() ||
  custody.isSymbolicLink() ||
  custody.mode & 0o077 ||
  custody.uid !== process.getuid()
)
  throw new Error('Use an owner-only setup custody directory.');
// The retained public CA is owned by the provider service. Copy only that public
// certificate through a read-only mount; never broaden access to its directory.
const trust = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--mount',
    `type=bind,src=${project}/.local/endpoint-credentials/ca.crt,dst=/ca,readonly`,
    'node:22.23.3-bookworm-slim',
    'node',
    '-e',
    "process.stdout.write(require('node:fs').readFileSync('/ca'))",
  ],
  { encoding: 'utf8' },
);
if (
  trust.status !== 0 ||
  !trust.stdout.startsWith('-----BEGIN CERTIFICATE-----')
)
  throw new Error('Cannot load the retained provider public CA.');
writeFileSync('.local/trunk-setup/ca.crt', trust.stdout, {
  mode: 0o600,
  flag:
    constants.O_WRONLY |
    constants.O_CREAT |
    constants.O_TRUNC |
    constants.O_NOFOLLOW,
});
function run(args) {
  const r = spawnSync('docker', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (action === 'access') {
  const installation = process.argv[3];
  if (
    process.argv.length !== 4 ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installation ?? '')
  )
    throw new Error('Usage: ./dev trunk-setup-access INSTALLATION_UUID');
  mkdirSync('.local/trunk-setup', { recursive: true, mode: 0o700 });
  run([
    'run',
    '--rm',
    '--user',
    `${process.getuid()}:${process.getgid()}`,
    '--network',
    'myims-rebuild-dev_endpoint-credentials',
    '--mount',
    `type=bind,src=${process.env.MYIMS_CUSTODIAN_PASSWORD_FILE ?? '/home/gino/.openbao-custodian/password'},dst=/human/password,readonly`,
    '--mount',
    `type=bind,src=${project}/.local/trunk-setup/ca.crt,dst=/trust/ca.crt,readonly`,
    '--mount',
    `type=bind,src=${project}/.local/trunk-setup,dst=/output`,
    '--mount',
    `type=bind,src=${project}/scripts/openbao,dst=/scripts,readonly`,
    'node:22.23.3-bookworm-slim',
    'node',
    '/scripts/simple-trunk-access.mjs',
    installation,
  ]);
} else if (action === 'import' || action === 'verify') {
  const [config, material] = process.argv.slice(3);
  if (action === 'import' && process.argv.length !== 5)
    throw new Error('Usage: ./dev trunk-credentials CONFIG_FILE MATERIAL_FILE');
  if (
    action === 'verify' &&
    (process.argv.length !== 4 ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(config ?? ''))
  )
    throw new Error(
      'Provide the installation UUID for trusted OpenBao acceptance.',
    );
  const name = `myims-trunk-setup-${process.pid}`;
  const fixtureDatabase = process.env.MYIMS_TRUNK_FIXTURE_DATABASE;
  if (fixtureDatabase && !/^myims_session_[a-f0-9]{12}$/.test(fixtureDatabase))
    throw new Error('Invalid isolated acceptance database.');
  const database =
    action === 'verify' && fixtureDatabase ? fixtureDatabase : 'myims';
  const mounts = [];
  for (const p of [
    'services/backend',
    'packages/config',
    'packages/contracts',
    'scripts',
  ])
    mounts.push(
      '--mount',
      `type=bind,src=${project}/${p},dst=/workspace/${p},readonly`,
    );
  for (const [v, p] of [
    ['0', 'node_modules'],
    ['10', 'services/backend/node_modules'],
    ['6', 'packages/config/node_modules'],
    ['7', 'packages/contracts/node_modules'],
  ])
    mounts.push(
      '-v',
      `myims-rebuild-dev_workspace-deps-${v}:/workspace/${p}:ro`,
    );
  // Both configs refer to fixed /setup/<file>, /trust/ca.crt and /input paths.
  const r = spawnSync(
    'docker',
    [
      'create',
      '--name',
      name,
      '--user',
      action === 'verify' ? '0:0' : `${process.getuid()}:${process.getgid()}`,
      '--network',
      'myims-rebuild-dev_endpoint-credentials',
      '-w',
      '/workspace',
      ...mounts,
      ...(action === 'verify'
        ? [
            '--mount',
            `type=bind,src=${project}/.local/trunk-credentials/issuer.token,dst=/expired/issuer.token,readonly`,
            '--mount',
            'type=volume,src=myims-rebuild-dev_endpoint-secrets-audit,dst=/provider-audit,readonly',
            '-e',
            `MYIMS_TRUNK_FIXTURE_CREDENTIAL_ID=${process.env.MYIMS_TRUNK_FIXTURE_CREDENTIAL_ID ?? ''}`,
          ]
        : []),
      ...(action === 'import'
        ? [
            '--mount',
            `type=bind,src=${realpathSync(resolve(config))},dst=/input/config,readonly`,
            '--mount',
            `type=bind,src=${realpathSync(resolve(material))},dst=/input/material,readonly`,
          ]
        : []),
      '--mount',
      `type=bind,src=${project}/.local/trunk-setup,dst=/setup,readonly`,
      '--mount',
      `type=bind,src=${project}/.local/trunk-setup/ca.crt,dst=/trust/ca.crt,readonly`,
      '--mount',
      `type=bind,src=${project}/.local/shared-services/runtime-postgres-password,dst=/database/runtime-postgres-password,readonly`,
      '--mount',
      `type=bind,src=${project}/.local/shared-services/postgres-password,dst=/database/postgres-password,readonly`,
      '-e',
      `DATABASE_URL=postgresql://myims_runtime@postgres:5432/${database}`,
      '-e',
      'DATABASE_PASSWORD_FILE=/database/runtime-postgres-password',
      '-e',
      `MIGRATION_DATABASE_URL=postgresql://myims@postgres:5432/${database}`,
      '-e',
      'MIGRATION_DATABASE_PASSWORD_FILE=/database/postgres-password',
      'node:22.23.3-bookworm-slim',
      'node',
      ...(action === 'import'
        ? [
            'services/backend/dist/entrypoints/deployment/main.js',
            'trunk-credentials',
            '/input/config',
            '/input/material',
          ]
        : ['scripts/check-simple-trunk-openbao.mjs', config]),
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error('Cannot create trusted setup container.');
  try {
    const network = spawnSync(
      'docker',
      ['network', 'connect', 'myims-rebuild-dev_endpoint-database', name],
      { stdio: 'inherit' },
    );
    if (network.status !== 0)
      throw new Error('Setup database network unavailable.');
    const result = spawnSync('docker', ['start', '-ai', name], {
      stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
  } finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  }
} else throw new Error('Unknown trunk setup action.');
