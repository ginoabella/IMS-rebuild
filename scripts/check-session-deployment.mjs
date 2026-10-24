import { inventoryPbxAcceptance } from './inventory-pbx-acceptance.mjs';
import {
  endpointAccess,
  provisionEndpointFixture,
  endpointFixtureRequest,
  cleanupEndpointFixture,
} from './endpoint-credential-launcher.mjs';
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
const credentials = ['--endpoint-credentials', '--inventory-browser'].includes(
  process.argv[2],
);

const inventoryBrowser = process.argv[2] === '--inventory-browser';
const trunkAccess =
  process.argv[2] === '--peer-browser' &&
  process.env.MYIMS_TRUNK_INSTALLATION_ID
    ? { installationId: process.env.MYIMS_TRUNK_INSTALLATION_ID }
    : null;
if (
  trunkAccess &&
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
    trunkAccess.installationId,
  )
)
  throw new Error('Invalid real trunk acceptance installation.');
let inventoryAcceptance;
let pbxAccess;
const observing = ['--pbx-observation', '--pbx-browser'].includes(
  process.argv[2],
);
const fixtureName = `myims-observation-${randomBytes(4).toString('hex')}`;
let fixtureInstalled = false;
if (observing || inventoryBrowser) {
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
    preserveConfiguration: true,
    fixturePassword: randomBytes(32).toString('hex'),
  };
}
function fixture(content) {
  if (!inventoryAcceptance)
    throw new Error('Exclusive PBX acceptance guard required');
  return inventoryAcceptance.writeLegacy(content, fixtureName);
}
if (inventoryBrowser || observing)
  inventoryAcceptance = inventoryPbxAcceptance(pbxAccess);
if (
  ['--extension-inventory', '--peer-browser', '--routing-browser'].includes(
    process.argv[2],
  )
)
  console.log(
    JSON.stringify({
      check:
        process.argv[2] === '--routing-browser'
          ? 'routing'
          : process.argv[2] === '--routing-browser'
            ? 'routing'
            : process.argv[2] === '--peer-browser'
              ? 'trunk-gateways'
              : 'extension-inventory',
      redisFixture: name,
    }),
  );
if (observing)
  console.log(
    JSON.stringify({
      check: 'pbx-observation',
      redisFixture: name,
      pbxFixture: fixtureName,
    }),
  );
let created = false;
let endpointCleanupError;
let trunkFixtureFailed = false;
try {
  if (credentials) provisionEndpointFixture();
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
      try {
        if (trunkAccess && line.startsWith('SIMPLE_TRUNK_FIXTURE_REQUEST ')) {
          const request = JSON.parse(
            line.slice('SIMPLE_TRUNK_FIXTURE_REQUEST '.length),
          );
          if (
            request.installationId !== trunkAccess.installationId ||
            !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
              request.credentialId ?? '',
            ) ||
            !/^myims_session_[a-f0-9]{12}$/.test(request.database ?? '')
          )
            throw new Error('Invalid owned trunk fixture request.');
          const result = spawnSync(
            process.execPath,
            [
              'scripts/trunk-setup-launcher.mjs',
              'verify',
              request.installationId,
            ],
            {
              env: {
                ...process.env,
                MYIMS_TRUNK_FIXTURE_DATABASE: request.database,
                MYIMS_TRUNK_FIXTURE_CREDENTIAL_ID: request.credentialId,
              },
              encoding: 'utf8',
              timeout: 120000,
            },
          );
          if (result.status !== 0) {
            const location =
              result.stderr?.match(
                /file:\/\/\/workspace\/scripts\/check-simple-trunk-openbao\.mjs:\d+:\d+/,
              )?.[0] ?? 'trusted container';
            console.error(
              `Real OpenBao check failed at ${location}; exit ${result.status ?? 'interrupted'}`,
            );
            trunkFixtureFailed = true;
          }
          if (!trunkFixtureFailed) console.log(result.stdout.trim());
        } else if (credentials && line.startsWith('ENDPOINT_FIXTURE_REQUEST '))
          endpointFixtureRequest(line).catch(() => {
            console.error('Endpoint fixture control failed');
            child.kill('SIGKILL');
          });
        else if (inventoryBrowser && line.startsWith('INVENTORY_PBX_INSTALL '))
          inventoryAcceptance.install(
            JSON.parse(line.slice('INVENTORY_PBX_INSTALL '.length)),
          );
        else if (inventoryBrowser && line === 'INVENTORY_PBX_STOP')
          inventoryAcceptance.stop();
        else if (inventoryBrowser && line === 'INVENTORY_PBX_START')
          inventoryAcceptance.start();
        else if (inventoryBrowser && line === 'INVENTORY_SESSION_STOP')
          docker(['stop', '--time', '5', name]);
        else if (inventoryBrowser && line === 'INVENTORY_SESSION_START')
          docker(['start', name]);
        else if (line === 'SESSION_FIXTURE_RESTART') docker(['restart', name]);
        else if (observing && line === 'PBX_FIXTURE_INSTALL') {
          if (fixtureInstalled)
            throw new Error('PBX fixture already installed');
          fixture(
            `[${fixtureName}]\ntype=endpoint\ncontext=myims-observation-no-calls\nauth=${fixtureName}\naors=${fixtureName}\ndisallow=all\nallow=ulaw\n[${fixtureName}]\ntype=auth\nauth_type=userpass\nusername=${fixtureName}\npassword=${pbxAccess.fixturePassword}\n[${fixtureName}]\ntype=aor\nmax_contacts=1\nremove_existing=yes\n`,
          );
          fixtureInstalled = true;
        } else if (observing && line === 'PBX_FIXTURE_ROTATE') {
          throw new Error('Existing observer configuration must be preserved');
        } else if (observing && line === 'PBX_FIXTURE_RESTORE') {
          if (!pbxAccess.preserveConfiguration)
            throw new Error(
              'Existing observer configuration must be preserved',
            );
        } else if (observing && line === 'PBX_FIXTURE_REMOVE') {
          fixture('');
          fixtureInstalled = false;
        } else if (observing && line === 'PBX_FIXTURE_STOP') {
          inventoryAcceptance.stop();
        } else if (observing && line === 'PBX_FIXTURE_START') {
          inventoryAcceptance.start();
        } else if (observing && line === 'PBX_FIXTURE_RESTART') {
          inventoryAcceptance.stop();
          inventoryAcceptance.start();
        } else process.stdout.write(`${line}\n`);
      } catch {
        inventoryAcceptance?.recordFailure(line.split(' ')[0]);
        console.error(
          'Controlled acceptance operation failed; recovery manifest retained',
        );
        child.kill('SIGKILL');
      }
    }
  });
  child.stdin.end(
    JSON.stringify({
      redisUrl: `redis://:${password}@${name}:6379`,
      ...(trunkAccess ? { trunkAccess } : {}),
      ...(pbxAccess ? { pbxAccess } : {}),
      ...(credentials ? { endpointAccess } : {}),
    }),
  );
  const timer = setTimeout(() => child.kill('SIGKILL'), 1500000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  if (code !== 0 || trunkFixtureFailed)
    throw new Error('Session lifecycle checks failed');
} finally {
  if (credentials) {
    try {
      await cleanupEndpointFixture();
    } catch (error) {
      endpointCleanupError = error;
    }
  }
  if (inventoryAcceptance) inventoryAcceptance.close();
  if (created) docker(['rm', '-f', '-v', name]);
  rmSync(directory, { recursive: true, force: true });
  if (
    ['--extension-inventory', '--peer-browser', '--routing-browser'].includes(
      process.argv[2],
    )
  )
    console.log(
      JSON.stringify({
        check:
          process.argv[2] === '--routing-browser'
            ? 'routing'
            : process.argv[2] === '--peer-browser'
              ? 'trunk-gateways'
              : 'extension-inventory',
        redisFixture: name,
        cleanup: 'removed',
      }),
    );
  if (observing)
    console.log(
      'PASS observation cleanup: existing observer credentials preserved, exact SIP fixture cleared, exact Redis container/volume and launcher directory removed',
    );
}

if (endpointCleanupError) throw endpointCleanupError;
