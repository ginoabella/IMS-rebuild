// Trusted host issuance only. Consumer custody is never in the workspace bind.
import { spawnSync } from 'node:child_process';
import { constants, mkdirSync, writeFileSync } from 'node:fs';
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
const installation = process.argv[2];
if (
  process.argv.length !== 3 ||
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installation ?? '')
)
  throw new Error('Provide one installation UUID');
const image =
    'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c',
  volume = 'myims-rebuild-dev_pbx-live-consumer';
function docker(args, inherit = false) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    ...(inherit ? { stdio: 'inherit' } : {}),
    timeout: 60000,
    maxBuffer: 1048576,
  });
  if (result.status !== 0)
    throw new Error('Protected live consumer setup unavailable');
  return result.stdout;
}
const names = docker([
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
if (!names.length) throw new Error('Actual telephony identity unavailable');
const uid = docker(['exec', names[0], 'id', '-u']).trim(),
  gid = docker(['exec', names[0], 'id', '-g']).trim();
if (uid !== String(process.getuid()) || gid !== String(process.getgid()))
  throw new Error(
    'Trusted issuer and actual telephony custody identity must match',
  );
mkdirSync('.local/pbx-live', { recursive: true, mode: 0o700 });
const trust = docker([
  'run',
  '--rm',
  '--mount',
  `type=bind,src=${project}/.local/endpoint-credentials/ca.crt,dst=/ca,readonly`,
  image,
  'node',
  '-e',
  'process.stdout.write(require("node:fs").readFileSync("/ca"))',
]);
if (!trust.startsWith('-----BEGIN CERTIFICATE-----'))
  throw new Error('Provider public trust unavailable');
writeFileSync('.local/pbx-live/ca.crt', trust, {
  mode: 0o600,
  flag:
    constants.O_WRONLY |
    constants.O_CREAT |
    constants.O_TRUNC |
    constants.O_NOFOLLOW,
});
docker([
  'volume',
  'create',
  '--label',
  'com.docker.compose.project=myims-rebuild-dev',
  '--label',
  'com.docker.compose.volume=pbx-live-consumer',
  volume,
]);
docker(
  [
    'run',
    '--rm',
    '--network',
    'none',
    '--mount',
    `type=volume,src=${volume},dst=/consumer`,
    '--mount',
    `type=bind,src=${project}/.local/pbx-live/consumer,dst=/legacy,readonly`,
    '--mount',
    `type=bind,src=${project}/.local/pbx-live/ca.crt,dst=/public-ca,readonly`,
    '--mount',
    `type=bind,src=${project}/scripts/init-pbx-live-consumer.mjs,dst=/initialize.mjs,readonly`,
    image,
    'node',
    '/initialize.mjs',
    uid,
    gid,
    installation,
  ],
  true,
);
docker(
  [
    'run',
    '--rm',
    '--user',
    `${uid}:${gid}`,
    '--network',
    'myims-rebuild-dev_endpoint-credentials',
    '--mount',
    `type=bind,src=${process.env.MYIMS_CUSTODIAN_PASSWORD_FILE ?? '/home/gino/.openbao-custodian/password'},dst=/human/password,readonly`,
    '--mount',
    `type=bind,src=${project}/.local/pbx-live/ca.crt,dst=/trust/ca.crt,readonly`,
    '--mount',
    `type=volume,src=${volume},dst=/output`,
    '--mount',
    `type=bind,src=${project}/scripts/openbao,dst=/scripts,readonly`,
    image,
    'node',
    '/scripts/live-read-access.mjs',
    installation,
  ],
  true,
);
