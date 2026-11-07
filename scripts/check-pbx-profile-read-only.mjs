// Trusted passive regression: all attempted native mutations must reject before IO.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
if (process.argv[2] !== '--native') {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '--user',
      '0',
      'myims-rebuild-dev-asterisk-1',
      'node',
      '--input-type=module',
      '-',
      '--native',
    ],
    {
      input: readFileSync(new URL(import.meta.url)),
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1048576,
    },
  );
  if (result.status !== 0) throw new Error('Passive native regression failed');
  process.stdout.write(result.stdout);
} else {
  const { createRequire } = await import('node:module');
  const { createHash } = await import('node:crypto');
  const { readdirSync, lstatSync, readlinkSync } = await import('node:fs');
  const { default: assert } = await import('node:assert/strict');
  const load = createRequire('/workspace/services/backend/package.json');
  const base = './dist/modules/telephony/adapters/live/';
  const { liveConfiguration } = load(base + 'configuration.js');
  const { NativePbxDriver } = load(base + 'native-driver.js');
  const { RetainedLivePlans } = load(base + 'retained-plans.js');
  const config = liveConfiguration(
    '/run/pbx-live-native/configuration.json',
    false,
  );
  const root = '/var/lib/myims-pbx/control/' + config.nodeId;
  const snapshot = (path, result = []) => {
    const s = lstatSync(path);
    result.push([
      path,
      s.mode,
      s.uid,
      s.gid,
      s.nlink,
      s.mtimeMs,
      s.isSymbolicLink()
        ? readlinkSync(path)
        : s.isFile()
          ? createHash('sha256').update(readFileSync(path)).digest('hex')
          : null,
    ]);
    if (s.isDirectory())
      for (const name of readdirSync(path).sort())
        snapshot(path + '/' + name, result);
    return result;
  };
  const before = ['/etc/asterisk', root, '/var/lib/myims-pbx/managed'].map(
    (p) => snapshot(p),
  );
  const plans = new RetainedLivePlans(
    root,
    config.nodeId,
    config.installationId,
    true,
  );
  const driver = new NativePbxDriver(
    root,
    '/var/lib/myims-pbx/managed',
    null,
    null,
    true,
  );
  assert.throws(() => driver.select({}));
  await assert.rejects(() => driver.captureBaseline());
  await assert.rejects(() => driver.validate({}, {}));
  await assert.rejects(() =>
    driver.reload(async () => {
      throw new Error('Guard must never run');
    }),
  );
  assert.throws(() => plans.save({}));
  assert.deepEqual(
    ['/etc/asterisk', root, '/var/lib/myims-pbx/managed'].map((p) =>
      snapshot(p),
    ),
    before,
  );
  console.log(
    JSON.stringify({
      check: 'native-profile-read-only',
      passed: true,
      protectedContentModesOwnershipAndMtimePreserved: true,
      mutationMethodsRejected: 5,
    }),
  );
}
