// Trusted Docker workspace root preparation only. No PBX effects or provider access.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  chownSync,
  lstatSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = load('pg');
const uid = Number(process.env.PBX_RUNTIME_UID),
  gid = Number(process.env.PBX_RUNTIME_GID);
if (
  process.getuid() !== 0 ||
  !Number.isSafeInteger(uid) ||
  uid < 1 ||
  !Number.isSafeInteger(gid) ||
  gid < 1
)
  throw new Error(
    'Trusted root preparation and actual telephony identity required',
  );
const native = '/output-native',
  consumer = '/output-consumer';
for (const path of [native, consumer])
  mkdirSync(path, { recursive: true, mode: 0o700 });
chownSync(consumer, uid, gid);
chmodSync(consumer, 0o700);
chmodSync(native, 0o700);
chownSync(native, 0, 0);
const database = new URL(process.env.MIGRATION_DATABASE_URL);
if (
  database.username !== 'myims' ||
  database.hostname !== 'postgres' ||
  database.pathname !== '/myims'
)
  throw new Error('Development administration database required');
database.password = readFileSync(
  process.env.MIGRATION_DATABASE_PASSWORD_FILE,
  'utf8',
).trim();
const client = new Client({ connectionString: database.href });
await client.connect();
function write(path, bytes, owner = 0, group = 0) {
  writeFileSync(path, bytes, { mode: 0o600, flag: 'w' });
  chmodSync(path, 0o600);
  chownSync(path, owner, group);
}
try {
  const catalog = JSON.parse(readFileSync('/input/catalog.json', 'utf8'));
  const installation = '58adb785-5384-41ce-9c72-ccda6ea554db';
  const node = (
    await client.query(
      'SELECT id,installation_id,target_alias,host,port,transport,tls_server_name FROM public.pbx_nodes WHERE installation_id=$1',
      [installation],
    )
  ).rows[0];
  if (
    !node ||
    !Array.isArray(catalog) ||
    catalog.filter(
      (entry) =>
        entry.installationId === installation &&
        (entry.targetAlias === node?.target_alias ||
          entry.aliases?.includes(node?.target_alias)) &&
        entry.host === node?.host &&
        entry.port === node?.port &&
        entry.transport === node?.transport &&
        entry.tlsServerName === node?.tls_server_name,
    ).length !== 1 ||
    node.host !== 'asterisk' ||
    node.transport !== 'ami-tls' ||
    node.port !== 5039
  )
    throw new Error(
      'Canonical retained installation/catalog mapping unavailable',
    );
  const role = (
    await client.query(
      "SELECT rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='myims_pbx_executor'",
    )
  ).rows[0];
  if (
    !role ||
    role.rolsuper ||
    role.rolcreaterole ||
    role.rolcreatedb ||
    role.rolreplication ||
    role.rolbypassrls
  )
    throw new Error('Scoped executor grants unavailable');
  const passwordPath = join(native, 'db.password');
  if (role.rolcanlogin && !existsSync(passwordPath))
    throw new Error(
      'Existing executor login has no retained custody; do not rotate silently',
    );
  let password;
  if (existsSync(passwordPath)) {
    const stat = lstatSync(passwordPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.mode & 0o077 ||
      stat.uid !== 0
    )
      throw new Error('Protected executor custody unavailable');
    password = readFileSync(passwordPath, 'utf8').trim();
  } else {
    password = randomBytes(32).toString('hex');
    write(passwordPath, password);
  }
  if (!/^[a-f0-9]{64}$/.test(password))
    throw new Error('Protected executor custody invalid');
  if (!role.rolcanlogin)
    await client.query(
      `ALTER ROLE myims_pbx_executor LOGIN PASSWORD ${client.escapeLiteral(password)}`,
    );
  write(join(consumer, 'db.password'), password, uid, gid);
  const common = {
    nodeId: node.id,
    installationId: installation,
    databaseUrl: 'postgresql://myims_pbx_executor@postgres:5432/myims',
  };
  write(
    join(native, 'configuration.json'),
    JSON.stringify({
      ...common,
      databasePasswordFile: '/run/pbx-live-native/db.password',
      socketGroup: gid,
    }),
  );
  write(
    join(consumer, 'configuration.json'),
    JSON.stringify({
      ...common,
      databasePasswordFile: '/run/pbx-live-consumer/db.password',
      providerTokenFile: `/run/pbx-live-consumer/live-${installation}.token`,
      providerCaFile: '/run/pbx-live-consumer/ca.crt',
    }),
    uid,
    gid,
  );
  const owner = Number(process.env.PBX_SERVER_UID),
    group = Number(process.env.PBX_SERVER_GID);
  if (
    !Number.isSafeInteger(owner) ||
    owner < 1 ||
    !Number.isSafeInteger(group) ||
    group < 1
  )
    throw new Error('Actual Asterisk identity required');
  const bootstrap = '/input/bootstrap';
  for (const [name, addition] of [
    [
      'pjsip.conf',
      '\n#tryinclude /var/lib/myims-pbx/managed/current/pjsip.conf\n',
    ],
    [
      'extensions.conf',
      '\n#tryinclude /var/lib/myims-pbx/managed/current/extensions.conf\n',
    ],
    [
      'modules.conf',
      '\nload = res_pjsip_pubsub.so\nload = res_pjsip_outbound_authenticator_digest.so\nload = app_dial.so\nload = func_strings.so\n',
    ],
  ])
    write(
      join(native, name),
      readFileSync(join(bootstrap, name), 'utf8') + addition,
      1000,
      1000,
    );
  // The trusted host launcher supplies only the existing manager configuration,
  // preserving its exact account while moving all remote access behind the filter.
  const manager = readFileSync(0, 'utf8');
  if (Buffer.byteLength(manager) > 16384)
    throw new Error('Protected manager input exceeds bound');
  if (
    !manager.includes('bindaddr=127.0.0.1') ||
    !manager.includes('tlsenable=yes')
  )
    throw new Error('Approved loopback AMI baseline unavailable');
  write(
    join(native, 'manager.conf'),
    manager.replace('tlsenable=yes', 'tlsenable=no'),
    owner,
    group,
  );
  for (const name of ['pjsip.conf', 'extensions.conf', 'modules.conf'])
    chownSync(join(native, name), owner, group);
  console.log(
    JSON.stringify({
      state: 'live_profile_prepared',
      nodeId: node.id,
      installationId: installation,
      scope: 'private-development',
      activated: false,
    }),
  );
} finally {
  await client.end();
}
