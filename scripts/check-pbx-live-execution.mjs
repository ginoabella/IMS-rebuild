// Trusted host launcher: owned isolated PostgreSQL DB and disposable private PBX.
import { spawnSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  cpSync,
  appendFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
const fixtures = join(process.cwd(), '.local/pbx-live/fixtures');
mkdirSync(fixtures, { recursive: true, mode: 0o700 });
const directory = mkdtempSync(join(fixtures, 'myims-live-integration-'));
const hostDirectory = project + directory.slice(process.cwd().length);
const database = 'myims_session_' + randomBytes(6).toString('hex'),
  name = 'myims-pbx-integrated-' + randomUUID().slice(0, 8);
function docker(args, timeout = 30000) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 1048576,
  });
  if (result.status !== 0)
    throw new Error(
      `Integrated native check failed: ${result.stdout.slice(-5000)} ${result.stderr.slice(-3000)}`,
    );
  return result.stdout;
}
try {
  const metadata = JSON.parse(
    docker(
      [
        'exec',
        '--user',
        'node',
        'myims-rebuild-dev-workspace-1',
        'node',
        '/workspace/scripts/pbx-live-database-fixture.mjs',
        'prepare',
        database,
      ],
      90000,
    ),
  );
  if (!/^[a-f0-9-]{36}$/.test(metadata.nodeId))
    throw new Error('Invalid owned native node identity');
  writeFileSync(join(directory, 'integration.json'), JSON.stringify(metadata), {
    mode: 0o600,
  });
  cpSync(
    join(process.cwd(), 'infra/asterisk/bootstrap'),
    join(directory, 'config'),
    {
      recursive: true,
    },
  );
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
  const args = [
    'run',
    '-d',
    '--name',
    name,
    '--network',
    'myims-rebuild-dev_default',
    '--cap-add',
    'NET_ADMIN',
  ];
  for (const [source, target] of [
    [hostDirectory + '/config', '/etc/asterisk'],
    [hostDirectory + '/integration.json', '/input/integration.json'],
    [project + '/scripts/pbx-live-integrated-fixture.mjs', '/fixture.mjs'],
    [project + '/scripts/pbx-live-race-fixture.mjs', '/race-fixture.mjs'],
    [project + '/services/backend/dist', '/workspace/services/backend/dist'],
    [
      project + '/services/backend/package.json',
      '/workspace/services/backend/package.json',
    ],
    [project + '/packages/config', '/workspace/packages/config'],
    [project + '/packages/contracts', '/workspace/packages/contracts'],
    [
      project + '/.local/shared-services/runtime-postgres-password',
      '/input/runtime.password',
    ],
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
    const result = spawnSync(
      'docker',
      ['exec', name, 'asterisk', '-rx', 'core waitfullybooted'],
      { encoding: 'utf8', timeout: 3000 },
    );
    if (result.status === 0 && result.stdout.includes('fully booted')) {
      ready = true;
      break;
    }
    await delay(100);
  }
  if (!ready) throw new Error('Owned integrated PBX startup unavailable');
  const output = docker(
    [
      'exec',
      name,
      '/bin/sh',
      '-c',
      `umask 077; mkdir -p /var/lib/myims-pbx/control/${metadata.nodeId}; chmod 700 /var/lib/myims-pbx/control/${metadata.nodeId}; exec 3>/var/lib/myims-pbx/control/${metadata.nodeId}/boundary.lock; flock -n 3 || exit 1; exec node /fixture.mjs`,
    ],
    90000,
  );
  for (const line of output
    .split('\n')
    .filter((line) => line.startsWith('PASS ')))
    console.log(line);
  const lock = `/var/lib/myims-pbx/control/${metadata.nodeId}/boundary.lock`;
  const wrapper = (script) =>
    `umask 077; exec 3>${lock}; flock -n 3 || exit 1; exec node /race-fixture.mjs ${script}`;
  async function waitFile(path, seconds = 10, kind = '-f') {
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      const result = spawnSync('docker', ['exec', name, 'test', kind, path], {
        timeout: 3000,
      });
      if (result.status === 0) return;
      await delay(100);
    }
    throw new Error('Owned dispatch race stage deadline');
  }
  docker([
    'exec',
    '-d',
    name,
    '/bin/sh',
    '-c',
    wrapper('old') + ' >/race-old.log 2>&1',
  ]);
  try {
    await waitFile('/race-ready', 30);
  } catch {
    const diagnostics = docker([
      'exec',
      name,
      'tail',
      '-c',
      '2500',
      '/race-old.log',
    ]);
    throw new Error('Owned dispatch race preparation failed: ' + diagnostics);
  }
  docker(['kill', '--signal', 'STOP', name]);
  try {
    docker(['exec', name, 'touch', '/race-paused']);
    await waitFile('/race-timeout');
    docker(['exec', name, 'node', '/race-fixture.mjs', 'acquire'], 30000);
    const pid = docker(['exec', name, 'cat', '/race-old.pid']).trim();
    if (!/^[1-9][0-9]{0,8}$/.test(pid))
      throw new Error('Owned helper PID invalid');
    docker(['exec', name, 'kill', '-KILL', pid]);
    const blocked = spawnSync(
      'docker',
      ['exec', name, 'flock', '-n', lock, 'true'],
      { timeout: 3000 },
    );
    if (blocked.status !== 1)
      throw new Error(
        'Real SQL successor bypassed dispatched-command kernel fence',
      );
    docker(['kill', '--signal', 'CONT', name]);
    const deadline = Date.now() + 10000;
    let drained = false;
    while (Date.now() < deadline) {
      const result = spawnSync(
        'docker',
        ['exec', name, 'flock', '-n', lock, 'true'],
        { timeout: 3000 },
      );
      if (result.status === 0) {
        drained = true;
        break;
      }
      await delay(100);
    }
    if (!drained)
      throw new Error('Actual dispatched reload did not release its fence');
    const result = docker(
      ['exec', name, '/bin/sh', '-c', wrapper('successor')],
      30000,
    );
    for (const line of result
      .split('\n')
      .filter((line) => line.startsWith('PASS ')))
      console.log(line);
  } finally {
    spawnSync('docker', ['kill', '--signal', 'CONT', name], {
      stdio: 'ignore',
      timeout: 3000,
    });
  }
  // Exercise the exact production native entrypoint and shell-held FD 3, with
  // disposable configuration/certificate and no provider access in this PBX.
  docker([
    'exec',
    name,
    'node',
    '-e',
    `
    const fs = require('node:fs');
    const m = JSON.parse(fs.readFileSync('/input/integration.json','utf8'));
    fs.mkdirSync('/run/pbx-live-native',{recursive:true,mode:448});
    fs.mkdirSync('/run/pbx-server',{recursive:true,mode:448});
    fs.writeFileSync('/run/pbx-live-native/db.password',fs.readFileSync('/input/executor.password'),{mode:384});
    fs.writeFileSync('/run/pbx-live-native/configuration.json',JSON.stringify({
      nodeId:m.nodeId,installationId:m.installationId,
      databaseUrl:'postgresql://myims_pbx_executor@postgres:5432/'+m.database,
      databasePasswordFile:'/run/pbx-live-native/db.password',socketGroup:1000
    }),{mode:384});
  `,
  ]);
  docker([
    'exec',
    name,
    'openssl',
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    '/run/pbx-server/server.key',
    '-out',
    '/run/pbx-server/server.pem',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost',
  ]);
  docker([
    'exec',
    '-d',
    '-e',
    'PBX_LIVE_PROFILE=approved-local-development',
    name,
    '/bin/sh',
    '-c',
    'umask 077; echo $$ >/startup-native.pid; exec /bin/sh /usr/local/lib/myims/native-owner.sh',
  ]);
  await waitFile('/run/pbx-live/native.sock', 10, '-S');
  const startupProof = docker([
    'exec',
    name,
    'node',
    '-e',
    `
    (async()=>{
      const fs=require('node:fs'),{createRequire}=require('node:module'),{randomUUID}=require('node:crypto');
      const load=createRequire('/workspace/services/backend/dist/modules/telephony/adapters/live/native-transport.js');
      const {NativeOwnerClient}=load('./native-transport.js');
      const {ObservationRepository}=load('../db/observation-repository.js');
      const {observationSettings}=load('../../domain/observation-settings.js');
      const m=JSON.parse(fs.readFileSync('/input/integration.json','utf8'));
      const url=new URL('postgresql://myims_runtime@postgres:5432/'+m.database);
      url.password=fs.readFileSync('/input/runtime.password','utf8').trim();
      const ownership=new ObservationRepository(url.href,observationSettings());
      let token;
      try {
        token=await ownership.acquire(m.nodeId,randomUUID());
        if(!token) throw Error('Owned startup lease unavailable');
        await new NativeOwnerClient('/run/pbx-live/native.sock').connect(token);
        console.log('PASS native startup: exact root entrypoint/private configuration, shell-held lifetime fence, real SQL owner handshake, retained verified baseline and private Unix socket work without provider custody');
      } finally {
        if(token) await ownership.release(token);
        await ownership.close();
      }
    })().catch(()=>{console.error('Owned native startup proof failed');process.exitCode=1});
  `,
  ]);
  for (const line of startupProof
    .split('\n')
    .filter((line) => line.startsWith('PASS ')))
    console.log(line);
  const nativePid = docker(['exec', name, 'cat', '/startup-native.pid']).trim();
  if (!/^[1-9][0-9]{0,8}$/.test(nativePid))
    throw new Error('Owned startup PID invalid');
  docker(['exec', name, 'kill', '-TERM', nativePid]);
  let released = false;
  for (let i = 0; i < 100; i++) {
    const result = spawnSync(
      'docker',
      ['exec', name, 'flock', '-n', lock, 'true'],
      { timeout: 3000 },
    );
    if (result.status === 0) {
      released = true;
      break;
    }
    await delay(100);
  }
  if (!released)
    throw new Error('Native shutdown did not drain lifetime fence');
  if (
    !docker(['exec', name, 'asterisk', '-rx', 'core waitfullybooted']).includes(
      'fully booted',
    )
  )
    throw new Error('Helper shutdown interrupted PBX');
  console.log(
    'PASS native shutdown: actual helper drains and releases its physical lock while the existing PBX remains fully booted',
  );
} finally {
  spawnSync('docker', ['rm', '-f', '-v', name], {
    stdio: 'ignore',
    timeout: 10000,
  });
  const cleanup = spawnSync(
    'docker',
    [
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      '/workspace/scripts/pbx-live-database-fixture.mjs',
      'cleanup',
      database,
    ],
    { encoding: 'utf8', timeout: 15000 },
  );
  rmSync(directory, { recursive: true, force: true });
  if (cleanup.status !== 0) {
    console.error('Owned integrated fixture DB cleanup unavailable');
    process.exitCode = 1;
  }
}
