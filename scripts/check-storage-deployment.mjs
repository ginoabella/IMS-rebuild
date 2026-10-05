import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeServiceSecrets } from './init-services.mjs';
const image =
  'dxflrs/garage:v2.3.0@sha256:866bd13ed2038ba7e7190e840482bc27234c4afaf77be8cfa439ae088c1e4690';
const name = `myims-storage-check-${randomUUID()}`;
const volumes = [`${name}-meta`, `${name}-data`];
const project = process.env.STORAGE_HOST_PROJECT_ROOT;
assert.ok(project?.startsWith('/'));
const logs = [];
function docker(args, input) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20000,
    input,
  });
  if (result.error || result.status !== 0)
    throw new Error('Storage deployment check Docker operation failed');
  return args[0] === 'logs' ? result.stdout + result.stderr : result.stdout;
}
async function ready() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker(['exec', name, '/garage', 'status']);
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error('Isolated storage provider did not become ready');
}
function provision() {
  try {
    logs.push(
      execFileSync(process.execPath, ['scripts/provision-storage.mjs'], {
        env: { ...process.env, STORAGE_PROVISION_CONTAINER: name },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      }),
    );
  } catch {
    throw new Error('Isolated storage provisioning failed');
  }
}
function fixture(operation, reference) {
  const output = docker(
    [
      'exec',
      '-i',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      'scripts/storage-deployment-fixture.mjs',
      operation,
      `http://${name}:3900`,
    ],
    reference ? JSON.stringify(reference) : '',
  );
  logs.push(output);
  return JSON.parse(output);
}
const temporary = mkdtempSync(join(tmpdir(), 'myims-storage-secrets-'));
try {
  for (const volume of volumes) docker(['volume', 'create', volume]);
  docker([
    'run',
    '-d',
    '--name',
    name,
    '--network',
    'myims-rebuild-dev_default',
    '-e',
    'RUST_LOG=error',
    '--mount',
    `type=bind,src=${project}/infra/docker/garage.toml,dst=/etc/garage.toml,readonly`,
    '--mount',
    `type=bind,src=${project}/.local/shared-services/garage-rpc-secret,dst=/run/secrets/garage_rpc_secret,readonly`,
    '--mount',
    `type=volume,src=${volumes[0]},dst=/var/lib/garage/meta`,
    '--mount',
    `type=volume,src=${volumes[1]},dst=/var/lib/garage/data`,
    image,
    '/garage',
    'server',
    '--single-node',
  ]);
  await ready();
  provision();
  provision();
  const reference = fixture('write');
  docker(['stop', name]);
  docker(['start', name]);
  await ready();
  assert.deepEqual(fixture('read', reference), reference);
  provision();
  assert.deepEqual(fixture('read', reference), reference);
  console.log(
    'PASS: fresh isolated volumes, provisioning reruns and ordinary provider stop/start retain identical bytes across new application processes',
  );

  const backend = JSON.parse(
    docker(['inspect', 'myims-rebuild-dev-backend-1']),
  )[0];
  const mounts = backend.Mounts.map((mount) => mount.Destination);
  assert.ok(
    !mounts.some(
      (path) =>
        /garage_rpc|storage_fixture|storage_denied|postgres_password$/.test(
          path,
        ) && !path.endsWith('runtime_postgres_password'),
    ),
  );
  assert.ok(!mounts.includes('/var/run/docker.sock'));
  assert.ok(!mounts.some((path) => path.includes('.local')));
  console.log(
    'PASS: application runtime mounts exclude provider administration, fixture credentials, local secret directory and Docker socket',
  );

  initializeServiceSecrets(`${temporary}/`);
  const credentialPath = `${temporary}/.local/shared-services/storage-runtime.json`;
  const original = readFileSync(credentialPath, 'utf8');
  initializeServiceSecrets(`${temporary}/`, true, true);
  assert.equal(readFileSync(credentialPath, 'utf8'), original);
  rmSync(credentialPath);
  assert.throws(
    () => initializeServiceSecrets(`${temporary}/`, true, true),
    /Restore original Garage secrets/,
  );
  console.log(
    'PASS: secret initialization reruns preserve identities; missing secrets with existing provider volumes require restoration',
  );

  logs.push(docker(['logs', name]));
  logs.push(docker(['logs', 'myims-rebuild-dev-garage-1']));
  assert.ok(
    !logs
      .join('\n')
      .includes(
        readFileSync('.local/shared-services/garage-rpc-secret', 'utf8').trim(),
      ),
  );
  for (const role of ['runtime', 'fixture', 'denied']) {
    const credentials = JSON.parse(
      readFileSync(`.local/shared-services/storage-${role}.json`, 'utf8'),
    );
    for (const value of Object.values(credentials))
      assert.ok(!logs.join('\n').includes(value));
  }
  assert.ok(!logs.join('\n').includes('STORAGE_DEPLOYMENT_CONTENT_SENTINEL'));
  console.log(
    'PASS: captured provisioning/provider/process evidence excludes content and credential sentinels',
  );
} finally {
  try {
    docker(['rm', '-f', name]);
  } finally {
    for (const volume of volumes) docker(['volume', 'rm', volume]);
    rmSync(temporary, { recursive: true, force: true });
  }
}
