import { setTimeout as delay } from 'node:timers/promises';
// Host-only disposable native boundary acceptance. No retained PBX is mutated.
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  cpSync,
  appendFileSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const project = process.env.STORAGE_HOST_PROJECT_ROOT ?? process.cwd();
const fixtures = join(process.cwd(), '.local/pbx-live/fixtures');
mkdirSync(fixtures, { recursive: true, mode: 0o700 });
const directory = mkdtempSync(join(fixtures, 'myims-native-pbx-')),
  name = `myims-pbx-live-check-${randomUUID().slice(0, 8)}`;
function docker(args, timeout = 30000) {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 1048576,
  });
  if (r.status !== 0)
    throw new Error(
      `Native PBX check failed: ${r.stdout.slice(-3000)} ${r.stderr.slice(-2000)}`,
    );
  return r.stdout;
}
try {
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
    '\n#tryinclude /var/lib/myims-pbx/managed/current/extensions.conf\n[ims-fixture-hold]\nexten => s,1,Answer()\nexten => s,n,Wait(2)\nexten => s,n,Hangup()\n',
  );
  appendFileSync(
    join(directory, 'config/modules.conf'),
    '\nload = res_pjsip_pubsub.so\nload = res_pjsip_outbound_authenticator_digest.so\nload = app_dial.so\nload = res_clioriginate.so\nload = func_strings.so\n',
  );
  docker([
    'run',
    '-d',
    '--name',
    name,
    '--network',
    'none',
    '--cap-add',
    'NET_ADMIN',
    '--mount',
    `type=bind,src=${project}${directory.slice(process.cwd().length)}/config,dst=/fixture-config,readonly`,
    '--mount',
    `type=bind,src=${project}/services/backend/dist,dst=/workspace/services/backend/dist,readonly`,
    '--mount',
    `type=bind,src=${project}/scripts/pbx-native-fixture.mjs,dst=/fixture.mjs,readonly`,
    '--mount',
    `type=bind,src=${project}/scripts/pbx-command-guardian-fixture.mjs,dst=/guardian-fixture.mjs,readonly`,
    '--mount',
    `type=bind,src=${project}/scripts/pbx-sip-fixture.mjs,dst=/sip-fixture.mjs,readonly`,
    '--mount',
    `type=bind,src=${project}/scripts/pbx-native-manager-setup.mjs,dst=/setup-manager.mjs,readonly`,
    '--mount',
    `type=bind,src=${project}/scripts/pbx-ami-gateway-fixture.mjs,dst=/gateway-fixture.mjs,readonly`,
    '--entrypoint',
    '/bin/sh',
    'myims-rebuild-dev-asterisk-live',
    '-c',
    'cp -a /fixture-config/. /etc/asterisk/; node /setup-manager.mjs; exec /usr/sbin/asterisk -f -U asterisk',
  ]);
  // A dummy Ethernet interface gives CLI processes an EID in this otherwise
  // network-less namespace. Its documentation-only host address has no peer or outside connectivity.
  const network = String.raw`
import socket,struct
align=lambda n:(n+3)&~3
def attr(kind,data):
 size=4+len(data)
 return struct.pack('HH',size,kind)+data+b'\0'*(align(size)-size)
payload=struct.pack('BBHiII',socket.AF_UNSPEC,0,0,0,0,0)+attr(3,b'myims-dummy0\0')+attr(18,attr(1,b'dummy\0'))
s=socket.socket(socket.AF_NETLINK,socket.SOCK_RAW,0);s.settimeout(2);s.bind((0,0))
s.send(struct.pack('IHHII',16+len(payload),16,0x605,1,0)+payload)
r=s.recv(4096)
if struct.unpack_from('H',r,4)[0]==2 and struct.unpack_from('i',r,16)[0]!=0:raise RuntimeError('Controlled namespace setup denied')
idx=socket.if_nametoindex('myims-dummy0')
payload=struct.pack('BBHiII',socket.AF_UNSPEC,0,0,idx,1,1)
s.send(struct.pack('IHHII',16+len(payload),16,5,2,0)+payload);r=s.recv(4096)
if struct.unpack_from('H',r,4)[0]==2 and struct.unpack_from('i',r,16)[0]!=0:raise RuntimeError('Controlled link setup denied')
address=socket.inet_aton('192.0.2.254')
payload=struct.pack('BBBBI',socket.AF_INET,32,0,254,idx)+attr(1,address)+attr(2,address)
s.send(struct.pack('IHHII',16+len(payload),20,0x605,3,0)+payload);r=s.recv(4096)
if struct.unpack_from('H',r,4)[0]==2 and struct.unpack_from('i',r,16)[0]!=0:raise RuntimeError('Controlled address setup denied')
s.close()
`;
  docker(['exec', name, 'python3', '-c', network]);
  let ready = false;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const r = spawnSync(
      'docker',
      ['exec', name, 'asterisk', '-rx', 'core show uptime'],
      { encoding: 'utf8', timeout: 3000 },
    );
    if (r.status === 0 && r.stdout.includes('System uptime:')) {
      ready = true;
      break;
    }
  }
  if (!ready) throw new Error('Native PBX fixture startup unavailable');
  process.stdout.write(
    docker(
      [
        'exec',
        name,
        '/bin/sh',
        '-c',
        'mkdir -p /var/lib/myims-pbx/control/fixture; chmod 700 /var/lib/myims-pbx/control/fixture; umask 077; exec 3>/var/lib/myims-pbx/control/fixture/boundary.lock; flock -n 3 || exit 1; exec node /fixture.mjs',
      ],
      60000,
    ),
  );
  // Pause only this disposable PBX's main process. A CLI command can already
  // be dispatched while the native helper is then killed; the guardian must keep
  // the SAME installation flock until the actual PBX command acknowledges.
  docker(['kill', '--signal', 'STOP', name]);
  try {
    docker([
      'exec',
      '-d',
      name,
      '/bin/sh',
      '-c',
      'umask 077; exec 3>/var/lib/myims-pbx/control/fixture/boundary.lock; flock -n 3 || exit 1; exec node /guardian-fixture.mjs',
    ]);
    await delay(3500);
    docker([
      'exec',
      name,
      'test',
      '-f',
      '/var/lib/myims-pbx/control/fixture/guardian-timeout',
    ]);
    const pid = docker([
      'exec',
      name,
      'cat',
      '/var/lib/myims-pbx/control/fixture/guardian-helper.pid',
    ]).trim();
    if (!/^[1-9][0-9]{0,8}$/.test(pid))
      throw new Error('Invalid disposable helper identity');
    docker(['exec', name, 'kill', '-KILL', pid]);
    const probe = spawnSync(
      'docker',
      [
        'exec',
        name,
        'flock',
        '-n',
        '/var/lib/myims-pbx/control/fixture/boundary.lock',
        'true',
      ],
      { encoding: 'utf8', timeout: 3000 },
    );
    if (probe.status !== 1)
      throw new Error(
        'A dispatched command lost its installation fence after helper death',
      );
    docker(['kill', '--signal', 'CONT', name]);
    let released = false;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const r = spawnSync(
        'docker',
        [
          'exec',
          name,
          'flock',
          '-n',
          '/var/lib/myims-pbx/control/fixture/boundary.lock',
          'true',
        ],
        { encoding: 'utf8', timeout: 3000 },
      );
      if (r.status === 0) {
        released = true;
        break;
      }
      await delay(100);
    }
    if (!released)
      throw new Error(
        'Actual command completion did not release the installation fence',
      );
    console.log(
      'PASS native: dispatched real reload retains its kernel fence through caller timeout and helper SIGKILL; successor excluded until actual CLI completion',
    );
  } finally {
    spawnSync('docker', ['kill', '--signal', 'CONT', name], {
      stdio: 'ignore',
      timeout: 3000,
    });
  }
} finally {
  spawnSync('docker', ['rm', '-f', '-v', name], {
    stdio: 'ignore',
    timeout: 10000,
  });
  rmSync(directory, { recursive: true, force: true });
}
