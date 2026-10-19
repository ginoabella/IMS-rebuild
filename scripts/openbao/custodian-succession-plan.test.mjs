import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { custodianSuccessionPlan } from './custodian-succession-plan.mjs';
test('human maintenance plan omits routine root, renewal, material and auth-configuration rights', () => {
  for (const name of ['', '../x', '*', 'UPPER', 'bad\nname'])
    assert.throws(() => custodianSuccessionPlan(name));
  const plan = custodianSuccessionPlan('review-custodian');
  assert.deepEqual(plan.userConfiguration.token_policies, [
    'platform-deployment-maintainer',
  ]);
  assert.equal(plan.userConfiguration.token_explicit_max_ttl, 900);
  assert.equal(plan.userConfiguration.token_no_default_policy, true);
  for (const path of [
    'myims-endpoint/',
    'myims-trunk/',
    'renew-self',
    'path "sys/auth/',
    'path "auth/platform-custodian/users/review-custodian"',
  ])
    assert.ok(!plan.policy.includes(path));
  assert.ok(
    plan.policy.includes(
      'path "sys/policies/acl/platform-deployment-maintainer" { capabilities = ["deny"] }',
    ),
  );
  for (const r of plan.issuerRoles) {
    assert.equal(r.configuration.token_explicit_max_ttl, 86400);
    assert.equal(r.configuration.orphan, true);
    assert.equal(r.configuration.renewable, false);
    assert.deepEqual(r.configuration.disallowed_policies, ['default', 'root']);
    assert.equal(r.request.no_default_policy, true);
  }
});

test('manual human setup refuses absent approval before custody or provider access', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/openbao/setup-custodian-succession.mjs',
      'apply',
      '00000000-0000-4000-8000-000000000001',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(JSON.parse(result.stderr).stage, 'approval');
});

test('human maintenance refuses absent tmpfs session custody before password or network', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/openbao/human-custodian-session.mjs', 'open'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  const safe = JSON.parse(result.stderr);
  assert.equal(safe.stage, 'session_custody');
  assert.equal(safe.knownToken, false);
});

test('issuer replacement refuses missing protected custody before provider access', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/openbao/issue-lifecycle-issuer.mjs',
      'trunk',
      '/missing-reviewed-manifest.json',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(JSON.parse(result.stderr).stage, 'custody');
});
