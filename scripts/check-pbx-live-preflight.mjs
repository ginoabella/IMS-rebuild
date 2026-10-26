// Trusted deployment read-only preflight. Never imported by HTTP or ordinary jobs.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const target = 'myims-rebuild-dev-asterisk-1';
const python = String.raw`
import json, socket, struct, shutil
with open('/proc/self/status') as source:
    values = dict(line.split(':',1) for line in source if ':' in line)
capability = bool(int(values['CapEff'].strip(),16) & (1 << 12))
# NFT_MSG_GETTABLE + NLM_F_REQUEST|NLM_F_DUMP: read only, changes no rules.
sock = socket.socket(socket.AF_NETLINK,socket.SOCK_RAW,12)
sock.settimeout(2)
sock.bind((0,0))
sock.send(struct.pack('IHHII',20,(10 << 8)|1,0x301,1,0)+struct.pack('BBH',0,0,0))
reply = sock.recv(65536)
kind = struct.unpack_from('H',reply,4)[0]
error = struct.unpack_from('i',reply,16)[0] if kind == 2 else 0
sock.close()
print(json.dumps({'networkAdministration':capability,'nftAvailable':shutil.which('nft') is not None,'netfilterReadErrno':error}))
`;
const result = spawnSync('docker', ['exec', target, 'python3', '-c', python], {
  encoding: 'utf8',
  timeout: 5000,
  maxBuffer: 4096,
});
if (result.status !== 0) {
  console.error(
    JSON.stringify({
      profile: 'p3-u5b-private-development',
      status: 'unavailable',
      reason: 'preflight_unavailable',
    }),
  );
  process.exitCode = 1;
} else {
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new Error('PBX preflight response unavailable');
  }
  const available =
    value.networkAdministration === true &&
    value.nftAvailable === true &&
    value.netfilterReadErrno === 0;
  console.log(
    JSON.stringify({
      profile: 'p3-u5b-private-development',
      target,
      status: available ? 'capability_available' : 'blocked',
      ...value,
      profileConfigured: existsSync('.local/pbx-live/enabled'),
      scope: 'capabilities-only',
    }),
  );
  if (!available) process.exitCode = 2;
}
