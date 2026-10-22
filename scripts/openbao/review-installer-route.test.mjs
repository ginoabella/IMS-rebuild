import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expectedCapabilities } from './verify-custodian-capabilities.mjs';
import {
  reviewInstallerRoute,
  installerReviewPaths,
} from './review-installer-route.mjs';
const plan = JSON.parse(
  readFileSync(
    new URL(
      '../../docs/planning/p3-u3a-backup-maintenance-review.json',
      import.meta.url,
    ),
  ),
);
function fixture({
  changedPath,
  failPath,
  cleanup = 403,
  wrongIdentity = false,
} = {}) {
  const calls = [];
  let revoked = false;
  const caps = Object.fromEntries(
    installerReviewPaths(plan).map((p) => [
      p,
      expectedCapabilities[p] ??
        (p.startsWith('auth/token/roles/platform-')
          ? ['read']
          : p.startsWith('auth/token/roles/')
            ? ['create', 'read', 'update']
            : ['deny']),
    ]),
  );
  if (changedPath) caps[changedPath] = ['read', 'update'];
  return {
    calls,
    call: async (path, body) => {
      calls.push({ path, body });
      if (path === failPath) throw new Error('PRIVATE');
      if (path.includes('/login/'))
        return {
          status: 200,
          value: {
            auth: {
              client_token: 'PRIVATE',
              policies: ['platform-deployment-maintainer'],
              token_policies: ['platform-deployment-maintainer'],
              metadata: { username: 'platform-owner-custodian' },
              lease_duration: 900,
            },
          },
        };
      if (path === 'auth/token/lookup-self')
        return revoked
          ? { status: cleanup, value: {} }
          : {
              status: 200,
              value: {
                data: {
                  policies: ['platform-deployment-maintainer'],
                  meta: { username: 'platform-owner-custodian' },
                  path: 'auth/platform-custodian/login/platform-owner-custodian',
                  display_name: 'platform-custodian-platform-owner-custodian',
                  orphan: true,
                  type: 'service',
                  num_uses: 0,
                  ttl: 899,
                  creation_ttl: 900,
                  explicit_max_ttl: wrongIdentity ? 1800 : 900,
                },
              },
            };
      if (path === 'sys/capabilities-self')
        return { status: 200, value: { data: caps } };
      if (path === 'auth/token/revoke-self') {
        revoked = true;
        return { status: 204, value: {} };
      }
      const role = plan.completeRoleConfigurationsToVerify.find(
        (r) => path === `auth/token/roles/${r.name}`,
      );
      if (role)
        return {
          status: 200,
          value: {
            data: {
              ...role.configuration,
              period: 0,
              allowed_entity_aliases: null,
            },
          },
        };
      if (path.startsWith('sys/policies/acl/'))
        return { status: 200, value: { data: { policy: 'PRIVATE' } } };
      assert.fail('unexpected path');
    },
  };
}
test('one exact capability batch, fourteen role reads, two policy hashes and confirmed cleanup', async () => {
  const f = fixture();
  const result = await reviewInstallerRoute(f.call, 'PRIVATE', plan);
  assert.equal(result.state, 'verified');
  assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
  assert.equal(result.routeReview.installerEstablished, false);
  assert.equal(result.routeReview.mappingsEstablished, false);
  assert.equal(result.routeReview.roles.length, 14);
  assert.equal(result.routeReview.policies.length, 2);
  assert.deepEqual(f.calls[2].body, { paths: installerReviewPaths(plan) });
  assert.equal(f.calls.filter((c) => c.path.includes('/login/')).length, 1);
  assert.equal(f.calls.length, 21);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('changed installer authority or identity stops before body reads and still revokes', async () => {
  for (const options of [
    { changedPath: 'sys/auth/platform-backup' },
    { wrongIdentity: true },
  ]) {
    const f = fixture(options);
    const r = await reviewInstallerRoute(f.call, 'PRIVATE', plan);
    assert.equal(r.state, 'stopped');
    assert.equal(r.cleanup, 'revoked_and_denial_confirmed');
    assert.equal(r.routeReview.roles.length, 0);
  }
});
test('uncertain login and mid-read failure never retry; cleanup uncertainty prevents verification', async () => {
  for (const failPath of [
    'auth/platform-custodian/login/platform-owner-custodian',
    'auth/token/roles/' + plan.completeRoleConfigurationsToVerify[0].name,
  ]) {
    const f = fixture({ failPath });
    const r = await reviewInstallerRoute(f.call, 'PRIVATE', plan);
    assert.equal(r.state, 'stopped');
    assert.equal(f.calls.filter((c) => c.path.includes('/login/')).length, 1);
    assert.ok(!JSON.stringify(r).includes('PRIVATE'));
  }
  const f = fixture({ cleanup: 200 });
  assert.equal(
    (await reviewInstallerRoute(f.call, 'PRIVATE', plan)).state,
    'stopped',
  );
});
