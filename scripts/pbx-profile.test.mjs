import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  channels,
  expectations,
  profileSummary,
} from './pbx-profile-inspect.mjs';

test('exact expectations reject omissions, extra fields and changed types', () => {
  const expected = {
    proposedUnmanagedDigest: 'b'.repeat(64),
    nodeVersion: 1,
    nodeId: randomUUID(),
    installationId: randomUUID(),
    initialBaselineId: randomUUID(),
    artifactId: randomUUID(),
    compilerVersion: 'review-2',
    policyVersion: 'deny-unbound-1',
    unmanagedDigest: 'a'.repeat(64),
  };
  assert.deepEqual(expectations(expected), expected);
  for (const key of Object.keys(expected)) {
    const missing = { ...expected };
    delete missing[key];
    assert.throws(() => expectations(missing));
    assert.throws(() => expectations({ ...expected, [key]: null }));
    assert.throws(() => expectations({ ...expected, [key]: [expected[key]] }));
  }
  assert.throws(() => expectations({ ...expected, command: 'reload' }));
  assert.throws(() =>
    expectations({ ...expected, artifactId: '../../escape' }),
  );
});
test('quiet evidence requires exactly one explicit channel count', () => {
  assert.equal(channels('0 active channels\n0 active calls\n'), 0);
  assert.equal(channels('2 active channels\n1 active call\n'), 2);
  for (const output of [
    '',
    'No such command',
    'not 0 active channels',
    '0 active channels\n1 active channels',
    '0 active calls',
  ])
    assert.equal(channels(output), null);
});
test('comparison emits finite media policy and module names without secrets or addresses', () => {
  const summary = profileSummary({
    'modules.conf': Buffer.from(
      '[modules]\nautoload=no\nload = res_agi.so\nnoload=bridge_native_rtp.so\n; password=fixture-secret',
    ),
    'rtp.conf': Buffer.from(
      '[general]\nrtpstart=10020\nrtpend=10039\nstrictrtp=yes',
    ),
    'pjsip.conf': Buffer.from(
      '[fixture-user]\npassword=fixture-secret\nprotocol=udp\nbind=192.0.2.99:5060\nexternal_media_address=192.0.2.98\ndirect_media=no\nrewrite_contact=fixture-secret',
    ),
  });
  assert.deepEqual(summary.explicitLoads, ['res_agi']);
  assert.deepEqual(summary.rtpStart, [10020]);
  assert.deepEqual(summary.rewriteContact, ['other']);
  assert.deepEqual(summary.externalAddressConfigured, [true, false]);
  assert.doesNotMatch(
    JSON.stringify(summary),
    /fixture-secret|192\.0\.2|fixture-user/,
  );
});
test('read-only retained reader cannot create directories or save plans', () => {
  const load = createRequire(
    new URL('../services/backend/package.json', import.meta.url),
  );
  const { RetainedLivePlans } = load(
    './dist/modules/telephony/adapters/live/retained-plans.js',
  );
  const root = mkdtempSync(join(tmpdir(), 'pbx-profile-reader-'));
  try {
    assert.throws(
      () => new RetainedLivePlans(root, randomUUID(), randomUUID(), true),
    );
    assert.deepEqual(readdirSync(root), []);
    mkdirSync(join(root, 'plans'), { mode: 0o700 });
    const marker = join(root, 'plans', 'marker');
    writeFileSync(marker, 'preserved', { mode: 0o600 });
    const before = statSync(marker);
    const reader = new RetainedLivePlans(
      root,
      randomUUID(),
      randomUUID(),
      true,
    );
    assert.throws(() => reader.save({}));
    assert.deepEqual(readdirSync(join(root, 'plans')), ['marker']);
    assert.equal(statSync(marker).mtimeMs, before.mtimeMs);
    assert.equal(statSync(marker).mode, before.mode);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a listed module must actually be Running, with an exact module identity', () => {
  const load = createRequire(
    new URL('../services/backend/package.json', import.meta.url),
  );
  const { moduleIsRunning } = load(
    './dist/modules/telephony/adapters/live/native-driver.js',
  );
  assert.equal(
    moduleIsRunning(
      'res_agi.so  Asterisk Gateway Interface  0 Running core\n',
      'res_agi',
    ),
    true,
  );
  for (const line of [
    'res_agi.so Asterisk Gateway Interface 0 Not Running core',
    'res_agi_other.so Asterisk Gateway Interface 0 Running core',
    'No such command',
    '0 modules loaded',
  ])
    assert.equal(moduleIsRunning(line, 'res_agi'), false);
  assert.equal(
    moduleIsRunning(
      'res_agi.so Asterisk Gateway Interface 0 Running core',
      'res_agi.*',
    ),
    false,
  );
});

test('passive provider availability requires exact existing scope and a live bounded token', async () => {
  const { accessAvailable } = await import('./pbx-profile-provider.mjs');
  const installation = randomUUID(),
    data = {
      policies: ['endpoint-live-read-' + installation],
      ttl: 3600,
      explicit_max_ttl: 86400,
      renewable: false,
    };
  assert.equal(accessAvailable(data, installation), true);
  for (const changed of [
    { ttl: 0 },
    { ttl: 86401 },
    { ttl: '3600' },
    { renewable: true },
    { explicit_max_ttl: 0 },
    { policies: [...data.policies, 'default'] },
    { policies: ['root'] },
  ])
    assert.equal(accessAvailable({ ...data, ...changed }, installation), false);
});
