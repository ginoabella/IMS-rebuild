// Trusted private consumer container; never mounts its token into Asterisk/Next.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd(),
  name = 'myims-live-provider-' + randomUUID().slice(0, 8);
function docker(args, inherit = false) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    ...(inherit ? { stdio: 'inherit' } : {}),
    timeout: socket ? 240000 : 90000,
    maxBuffer: 1048576,
  });
  if (result.status !== 0)
    throw new Error('Protected actual provider proof unavailable');
  return result.stdout;
}
const socket = process.argv[3];
if (socket && !/^myims-live-material-socket-[a-f0-9]{8}$/.test(socket))
  throw new Error('Owned socket required');
try {
  const args = [
    'create',
    '--name',
    name,
    '--user',
    `${process.getuid()}:${process.getgid()}`,
    '--network',
    'myims-rebuild-dev_default',
    '--mount',
    'type=volume,src=myims-rebuild-dev_pbx-live-consumer,dst=/run/pbx-live-consumer,readonly',
  ];
  if (socket)
    args.push(
      '--mount',
      `type=volume,src=${socket},dst=/run/pbx-live,readonly`,
    );
  for (const [source, target] of [
    ...(socket
      ? [
          ['scripts/pbx-live-provider-owner.mjs', '/owner-check.mjs'],
          [
            '.local/shared-services/runtime-postgres-password',
            '/input/runtime.password',
          ],
        ]
      : []),
    ['scripts/check-pbx-live-provider.mjs', '/provider-check.mjs'],
    ['services/backend/dist', '/workspace/services/backend/dist'],
    [
      'services/backend/package.json',
      '/workspace/services/backend/package.json',
    ],
    ['packages/config', '/workspace/packages/config'],
    ['packages/contracts', '/workspace/packages/contracts'],
  ])
    args.push(
      '--mount',
      `type=bind,src=${project}/${source},dst=${target},readonly`,
    );
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
    'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c',
    'node',
    socket ? '/owner-check.mjs' : '/provider-check.mjs',
    ...(process.argv[2] ? [process.argv[2]] : []),
  );
  docker(args);
  docker([
    'network',
    'connect',
    'myims-rebuild-dev_endpoint-credentials',
    name,
  ]);
  docker(['start', '-a', name], true);
} finally {
  spawnSync('docker', ['rm', '-f', '-v', name], {
    stdio: 'ignore',
    timeout: 10000,
  });
}
