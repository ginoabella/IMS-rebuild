// Trusted orchestration: provider token mounts only in the separate consumer.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  appendFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
export async function verifyNativeProvider(metadata) {
  const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
  const fixtures = join(process.cwd(), '.local/pbx-live/fixtures');
  mkdirSync(fixtures, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(join(fixtures, 'retained-native-'));
  const hostDirectory = project + directory.slice(process.cwd().length);
  const run = randomUUID().slice(0, 8),
    name = 'myims-live-material-' + run,
    socket = 'myims-live-material-socket-' + run;
  function docker(args, timeout = 30000) {
    const r = spawnSync('docker', args, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 1048576,
    });
    if (r.status !== 0)
      throw new Error(
        'Owned provider/native fixture failed: ' +
          r.stdout.slice(-2000) +
          ' ' +
          r.stderr.slice(-1000),
      );
    return r.stdout;
  }
  try {
    writeFileSync(
      join(directory, 'integration.json'),
      JSON.stringify({ ...metadata, socketGroup: process.getgid() }),
      { mode: 0o600 },
    );
    cpSync('infra/asterisk/bootstrap', join(directory, 'config'), {
      recursive: true,
    });
    appendFileSync(
      join(directory, 'config/pjsip.conf'),
      '\n#tryinclude /var/lib/myims-pbx/managed/current/pjsip.conf\n',
    );
    appendFileSync(
      join(directory, 'config/extensions.conf'),
      '\n#tryinclude /var/lib/myims-pbx/managed/current/extensions.conf\n',
    );
    appendFileSync(
      join(directory, 'config/modules.conf'),
      '\nload = res_pjsip_pubsub.so\nload = res_pjsip_outbound_authenticator_digest.so\nload = app_dial.so\nload = func_strings.so\n',
    );
    docker([
      'volume',
      'create',
      '--label',
      'myims.acceptance=pbx-live',
      socket,
    ]);
    const args = [
      'run',
      '-d',
      '--name',
      name,
      '--network',
      'myims-rebuild-dev_default',
      '--cap-add',
      'NET_ADMIN',
      '--mount',
      `type=volume,src=${socket},dst=/run/pbx-live`,
    ];
    for (const [source, target] of [
      [hostDirectory + '/config', '/etc/asterisk'],
      [hostDirectory + '/integration.json', '/input/integration.json'],
      [
        project + '/scripts/pbx-live-provider-native.mjs',
        '/native-fixture.mjs',
      ],
      [project + '/services/backend/dist', '/workspace/services/backend/dist'],
      [
        project + '/services/backend/package.json',
        '/workspace/services/backend/package.json',
      ],
      [project + '/packages/config', '/workspace/packages/config'],
      [project + '/packages/contracts', '/workspace/packages/contracts'],
      [
        project + '/.local/pbx-live/native/db.password',
        '/input/executor.password',
      ],
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
      '/usr/sbin/asterisk',
      'myims-rebuild-dev-asterisk-live',
      '-f',
      '-U',
      'asterisk',
    );
    docker(args);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      const r = spawnSync(
        'docker',
        ['exec', name, 'asterisk', '-rx', 'core waitfullybooted'],
        { encoding: 'utf8', timeout: 3000 },
      );
      if (r.status === 0 && r.stdout.includes('fully booted')) {
        ready = true;
        break;
      }
      await delay(100);
    }
    if (!ready) throw new Error('Owned material PBX startup unavailable');
    const root = '/var/lib/myims-pbx/control/' + metadata.nodeId;
    docker([
      'exec',
      '-d',
      name,
      '/bin/sh',
      '-c',
      `umask 077; mkdir -p ${root}; chmod 700 ${root}; exec 3>${root}/boundary.lock; flock -n 3 || exit 1; exec node /native-fixture.mjs >/native-fixture.log 2>&1`,
    ]);
    ready = false;
    for (let i = 0; i < 100; i++) {
      const r = spawnSync(
        'docker',
        ['exec', name, 'test', '-S', '/run/pbx-live/native.sock'],
        { timeout: 3000 },
      );
      if (r.status === 0) {
        ready = true;
        break;
      }
      await delay(100);
    }
    if (!ready) throw new Error('Owned material native socket unavailable');
    const proof = spawnSync(
      process.execPath,
      [
        'scripts/pbx-live-provider-launcher.mjs',
        JSON.stringify(metadata),
        socket,
      ],
      { stdio: 'inherit', timeout: 240000, env: process.env },
    );
    if (proof.status !== 0)
      throw new Error('Real retained material/native acceptance failed');
    const inspection = JSON.parse(docker(['inspect', name]))[0];
    if (
      inspection.Mounts.some(
        (m) => m.Name === 'myims-rebuild-dev_pbx-live-consumer',
      ) ||
      Object.hasOwn(
        inspection.NetworkSettings.Networks,
        'myims-rebuild-dev_endpoint-credentials',
      )
    )
      throw new Error('Provider custody crossed into PBX');
  } finally {
    spawnSync('docker', ['rm', '-f', '-v', name], {
      stdio: 'ignore',
      timeout: 15000,
    });
    const removed = spawnSync('docker', ['volume', 'rm', socket], {
      stdio: 'ignore',
      timeout: 10000,
    });
    rmSync(directory, { recursive: true, force: true });
    if (removed.status !== 0) {
      console.error('Owned material socket cleanup failed');
      process.exitCode = 1;
    }
  }
}
