// Runs only in a trusted root deployment container with an exact protected mount.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
  chownSync,
  renameSync,
} from 'node:fs';
const base = '/provision',
  server = `${base}/server`,
  runtime = `${base}/runtime`;
const serverUid = Number(process.env.PBX_SERVER_UID),
  runtimeUid = Number(process.env.PBX_RUNTIME_UID);
if (!serverUid || !runtimeUid)
  throw new Error('Invalid provisioning identities');
for (const path of [server, runtime])
  mkdirSync(path, { recursive: true, mode: 0o700 });
function openssl(args) {
  const r = spawnSync('openssl', args, { stdio: 'pipe', timeout: 15000 });
  if (r.status !== 0) throw new Error('PBX trust provisioning failed');
}
function write(path, content, uid) {
  writeFileSync(`${path}.next`, content, { mode: 0o600 });
  chownSync(`${path}.next`, uid, uid);
  chmodSync(`${path}.next`, 0o600);
  renameSync(`${path}.next`, path);
}
if (!existsSync(`${server}/ca.pem`)) {
  openssl([
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '365',
    '-subj',
    '/CN=MyIMS local PBX development CA',
    '-keyout',
    `${server}/ca.key`,
    '-out',
    `${server}/ca.pem`,
  ]);
  openssl([
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-subj',
    '/CN=asterisk',
    '-keyout',
    `${server}/server.key`,
    '-out',
    `${server}/server.csr`,
  ]);
  writeFileSync(
    `${server}/extensions.cnf`,
    'subjectAltName=DNS:asterisk\nextendedKeyUsage=serverAuth\n',
    { mode: 0o600 },
  );
  openssl([
    'x509',
    '-req',
    '-in',
    `${server}/server.csr`,
    '-CA',
    `${server}/ca.pem`,
    '-CAkey',
    `${server}/ca.key`,
    '-CAcreateserial',
    '-days',
    '365',
    '-extfile',
    `${server}/extensions.cnf`,
    '-out',
    `${server}/server.pem`,
  ]);
}
let credentials;
if (
  process.argv.includes('--rotate') ||
  !existsSync(`${runtime}/observer.json`)
)
  credentials = {
    username: 'myims-observer',
    password: randomBytes(32).toString('hex'),
  };
else credentials = JSON.parse(readFileSync(`${runtime}/observer.json`, 'utf8'));
write(
  `${runtime}/observer.json`,
  JSON.stringify(credentials) + '\n',
  runtimeUid,
);
write(`${runtime}/ca.pem`, readFileSync(`${server}/ca.pem`), runtimeUid);
write(
  `${runtime}/configuration.json`,
  JSON.stringify({
    credentials: {
      'local-asterisk-observer': '/run/pbx-observer/observer.json',
    },
    trustFile: '/run/pbx-observer/ca.pem',
  }) + '\n',
  runtimeUid,
);
write(
  `${server}/manager.conf`,
  `[general]\nenabled=yes\nbindaddr=127.0.0.1\nport=5038\nwebenabled=no\ntlsenable=yes\ntlsbindaddr=0.0.0.0:5039\ntlscertfile=/run/pbx-server/server.pem\ntlsprivatekey=/run/pbx-server/server.key\nauthtimeout=2\nauthlimit=8\ndisplayconnects=no\n[${credentials.username}]\nsecret=${credentials.password}\nread=system\nwrite=system\nwritetimeout=2000\neventfilter(name(ContactStatus)) =\n`,
  serverUid,
);
// Only keys needed by Asterisk are readable by its uid. CA signing key stays root-owned.
for (const path of ['server.key', 'server.pem', 'ca.pem']) {
  chownSync(`${server}/${path}`, serverUid, serverUid);
  chmodSync(`${server}/${path}`, 0o600);
}
chmodSync(`${server}/ca.key`, 0o600);
chownSync(`${server}/ca.key`, 0, 0);
chownSync(server, serverUid, serverUid);
chownSync(runtime, runtimeUid, runtimeUid);
chmodSync(server, 0o700);
chmodSync(runtime, 0o700);
