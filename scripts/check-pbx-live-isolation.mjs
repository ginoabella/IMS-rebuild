// Metadata/permission checks only. Never reads or prints credential contents.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 2097152,
  });
  if (result.status !== 0)
    throw new Error('Live isolation metadata unavailable');
  return result.stdout;
}
const consumer = 'myims-rebuild-dev_pbx-live-consumer',
  control = 'myims-rebuild-dev_pbx-live-control';
if (process.argv[2] === '--plan') {
  const configuration = JSON.parse(
    docker([
      'compose',
      '-p',
      'myims-rebuild-dev',
      '-f',
      'infra/docker/compose.yaml',
      '-f',
      'infra/docker/compose.observation.yaml',
      '-f',
      'infra/docker/compose.pbx-live.yaml',
      '--profile',
      'telephony',
      '--profile',
      'workspace',
      '--profile',
      'workers',
      'config',
      '--format',
      'json',
    ]),
  );
  for (const name of ['workspace', 'backend', 'worker', 'asterisk']) {
    const service = configuration.services[name];
    assert.ok(
      !service.volumes?.some(
        (mount) =>
          mount.source === 'pbx-live-consumer' ||
          String(mount.source).includes('/.local/pbx-live/consumer'),
      ),
    );
    if (name !== 'asterisk')
      assert.ok(
        !service.volumes?.some((mount) => mount.source === 'pbx-live-control'),
      );
    assert.ok(
      !Object.keys(service.networks ?? {}).includes('endpoint-credentials'),
    );
  }
  assert.ok(
    configuration.services.telephony.volumes.some(
      (mount) => mount.source === 'pbx-live-consumer' && mount.read_only,
    ),
  );
}
const containers = docker([
  'ps',
  '--filter',
  'label=com.docker.compose.project=myims-rebuild-dev',
  '--format',
  '{{.Names}}',
])
  .trim()
  .split('\n')
  .filter(Boolean);
let consumers = 0;
for (const name of containers) {
  const instance = JSON.parse(docker(['inspect', name]))[0],
    role = instance.Config.Labels['com.docker.compose.service'];
  if (['workspace', 'backend', 'worker', 'asterisk'].includes(role)) {
    assert.ok(
      !instance.Mounts.some(
        (mount) =>
          mount.Name === consumer ||
          String(mount.Source).includes('/.local/pbx-live/consumer'),
      ),
    );
    if (role !== 'asterisk')
      assert.ok(!instance.Mounts.some((mount) => mount.Name === control));
    assert.ok(
      !Object.keys(instance.NetworkSettings.Networks).includes(
        'myims-rebuild-dev_endpoint-credentials',
      ),
    );
  }
  if (
    role === 'telephony' &&
    instance.Mounts.some((mount) => mount.Name === consumer)
  ) {
    consumers++;
    assert.ok(
      instance.Mounts.find((mount) => mount.Name === consumer).RW === false,
    );
  }
}
if (existsSync('.local/pbx-live/enabled')) assert.ok(consumers > 0);
const permissions = JSON.parse(
  docker([
    'exec',
    '--user',
    'node',
    'myims-rebuild-dev-workspace-1',
    'node',
    '-e',
    'const fs=require("node:fs"),result={};for(const [name,path]of Object.entries({legacyToken:"/workspace/.local/pbx-live/consumer/live-58adb785-5384-41ce-9c72-ccda6ea554db.token",nativePassword:"/workspace/.local/pbx-live/native/db.password"})){try{fs.accessSync(path,fs.constants.R_OK);result[name]=true;}catch{result[name]=false;}}console.log(JSON.stringify(result));',
  ]),
);
assert.deepEqual(permissions, { legacyToken: false, nativePassword: false });
console.log(
  'PASS live isolation: no consumer token/volume or provider network in workspace, HTTP, worker or Asterisk; actual workspace cannot read legacy staging/native SQL custody; private consumer mounts are read-only',
);
