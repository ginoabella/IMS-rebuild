// Trusted Docker fixture launcher. No socket or deployment secret is added to HTTP.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const name = `myims-session-check-${randomBytes(6).toString('hex')}`;
const password = randomBytes(32).toString('hex');
const directory = mkdtempSync(join(tmpdir(), 'myims-session-'));
function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0)
    throw new Error('Session fixture Docker operation failed');
  return r.stdout;
}
let pbxAccess;
const observing = ['--pbx-observation', '--pbx-browser'].includes(
  process.argv[2],
);
const fixtureName = `myims-observation-${randomBytes(4).toString('hex')}`;
let fixtureInstalled = false;
let controlledStopped = false;
if (observing) {
  pbxAccess = {
    credentials: JSON.parse(
      readFileSync(
        join(process.cwd(), '.local/pbx-observation/runtime/observer.json'),
        'utf8',
      ),
    ),
    trust: readFileSync(
      join(process.cwd(), '.local/pbx-observation/runtime/ca.pem'),
      'utf8',
    ),
    catalog: JSON.parse(
      readFileSync(
        join(process.cwd(), '.local/pbx-catalog/catalog.json'),
        'utf8',
      ),
    ),
    rotatedCredentials: {
      username: 'myims-observer',
      password: randomBytes(32).toString('hex'),
    },
    fixtureName,
    fixturePassword: randomBytes(32).toString('hex'),
  };
}
function rotate(credentials) {
  const r = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--entrypoint',
      'node',
      '-i',
      '--mount',
      `type=bind,src=${process.env.STORAGE_HOST_PROJECT_ROOT}/.local/pbx-observation/server,dst=/server`,
      'myims-rebuild-dev-workspace',
      '-e',
      "const fs=require('fs');const c=JSON.parse(fs.readFileSync(0,'utf8'));const p='/server/manager.conf';let s=fs.readFileSync(p,'utf8');s=s.replace(/^secret=.*$/m,'secret='+c.password);fs.writeFileSync(p,s);",
    ],
    { input: JSON.stringify(credentials), encoding: 'utf8', timeout: 15000 },
  );
  if (r.status !== 0) throw new Error('Controlled account rotation failed');
  pbxCommand('manager reload');
}
function pbxCommand(command) {
  docker(['exec', 'myims-rebuild-dev-asterisk-1', 'asterisk', '-rx', command]);
}
function fixture(content) {
  // Deployment-only pipe: never print generated SIP authentication material.
  const r = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '--user',
      'asterisk',
      'myims-rebuild-dev-asterisk-1',
      'sh',
      '-c',
      'cat > /tmp/myims-pbx-fixture.conf && chmod 600 /tmp/myims-pbx-fixture.conf',
    ],
    { input: content, encoding: 'utf8', timeout: 10000 },
  );
  if (r.status !== 0) throw new Error('PBX fixture preparation failed');
  // Exact file is mounted separately through a fixture include, not product inventory.
  pbxCommand('module reload res_pjsip.so');
}
if (observing)
  console.log(
    JSON.stringify({
      check: 'pbx-observation',
      redisFixture: name,
      pbxFixture: fixtureName,
    }),
  );
let created = false;
try {
  docker([
    'create',
    '--name',
    name,
    '--network',
    'myims-rebuild-dev_default',
    '--memory',
    '192m',
    '--entrypoint',
    'redis-server',
    'redis:8-alpine@sha256:3811787313eba226a2ef38658c6ccb91cd5e110edc89c37767de373120a0e5a0',
    '/tmp/session.conf',
  ]);
  created = true;
  const path = join(directory, 'session.conf');
  writeFileSync(
    path,
    `bind 0.0.0.0\nprotected-mode yes\nport 6379\nrequirepass ${password}\ndir /data\nappendonly yes\nappendfsync always\nsave ""\nmaxmemory 128mb\nmaxmemory-policy noeviction\n`,
    { mode: 0o600 },
  );
  docker(['cp', path, `${name}:/tmp/session.conf`]);
  docker(['start', name]);
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'pnpm',
      'check:session-foundation',
      ...(process.argv[2] ? [process.argv[2]] : []),
    ],
    { stdio: ['pipe', 'pipe', 'inherit'] },
  );
  let output = '';
  child.stdout.on('data', (bytes) => {
    output += bytes.toString();
    let newline;
    while ((newline = output.indexOf('\n')) >= 0) {
      const line = output.slice(0, newline);
      output = output.slice(newline + 1);
      if (line === 'SESSION_FIXTURE_RESTART') docker(['restart', name]);
      else if (observing && line === 'PBX_FIXTURE_INSTALL') {
        if (fixtureInstalled) throw new Error('PBX fixture already installed');
        fixture(
          `[${fixtureName}]\ntype=endpoint\ncontext=myims-observation-no-calls\nauth=${fixtureName}\naors=${fixtureName}\ndisallow=all\nallow=ulaw\n[${fixtureName}]\ntype=auth\nauth_type=userpass\nusername=${fixtureName}\npassword=${pbxAccess.fixturePassword}\n[${fixtureName}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n`,
        );
        fixtureInstalled = true;
      } else if (observing && line === 'PBX_FIXTURE_ROTATE') {
        rotate(pbxAccess.rotatedCredentials);
      } else if (observing && line === 'PBX_FIXTURE_RESTORE') {
        rotate(pbxAccess.credentials);
      } else if (observing && line === 'PBX_FIXTURE_REMOVE') {
        fixture('');
        fixtureInstalled = false;
      } else if (observing && line === 'PBX_FIXTURE_STOP') {
        docker(['stop', 'myims-rebuild-dev-asterisk-1']);
        controlledStopped = true;
      } else if (observing && line === 'PBX_FIXTURE_START') {
        docker(['start', 'myims-rebuild-dev-asterisk-1']);
        controlledStopped = false;
      } else if (observing && line === 'PBX_FIXTURE_RESTART') {
        docker(['restart', 'myims-rebuild-dev-asterisk-1']);
      } else process.stdout.write(`${line}\n`);
    }
  });
  child.stdin.end(
    JSON.stringify({
      redisUrl: `redis://:${password}@${name}:6379`,
      ...(pbxAccess ? { pbxAccess } : {}),
    }),
  );
  const timer = setTimeout(() => child.kill('SIGKILL'), 1500000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  if (code !== 0) throw new Error('Session lifecycle checks failed');
} finally {
  if (observing) {
    if (controlledStopped) docker(['start', 'myims-rebuild-dev-asterisk-1']);
    rotate(pbxAccess.credentials);
    fixture('');
    docker([
      'exec',
      '--user',
      '0',
      'myims-rebuild-dev-asterisk-1',
      'rm',
      '-f',
      '/tmp/myims-pbx-fixture.conf',
    ]);
  }
  if (created) docker(['rm', '-f', '-v', name]);
  rmSync(directory, { recursive: true, force: true });
  if (observing)
    console.log(
      'PASS observation cleanup: controlled credential restored, exact SIP fixture cleared, exact Redis container/volume and launcher directory removed',
    );
}
