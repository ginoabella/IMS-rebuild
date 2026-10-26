// Trusted read-only provider acceptance: reuse existing retained canonical versions.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { verifyNativeProvider } from './pbx-live-provider-native-launcher.mjs';
const database = 'myims_session_' + randomBytes(6).toString('hex');
const installationId = '58adb785-5384-41ce-9c72-ccda6ea554db';
function coordinate(action, details) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'node',
      '/workspace/scripts/pbx-live-database-fixture.mjs',
      action,
      database,
      ...(details ? [details] : []),
    ],
    { encoding: 'utf8', timeout: 90000, maxBuffer: 1048576 },
  );
  if (result.status !== 0)
    throw new Error('Owned retained-provider SQL fixture unavailable');
  return result.stdout;
}
try {
  const metadata = JSON.parse(coordinate('prepare', installationId));
  coordinate('bind-existing-material', JSON.stringify(metadata));
  const result = spawnSync(
    process.execPath,
    ['scripts/pbx-live-provider-launcher.mjs', JSON.stringify(metadata)],
    { stdio: 'inherit', timeout: 90000, env: process.env },
  );
  if (result.status !== 0)
    throw new Error('Retained exact-provider read proof failed');
  await verifyNativeProvider(metadata);
  console.log(
    'PASS retained provider fixture: canonical existing exact versions 1 and 2, isolated immutable captures and private GET-only consumer; no provider writes, access issuance, retained-PBX effects or material output',
  );
} finally {
  coordinate('cleanup');
}
