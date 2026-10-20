import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyCustodian,
  expectedCapabilities,
} from './verify-custodian-capabilities.mjs';

const secret = 'sensitive-test-session';
function fixture({
  identity = {},
  login = {},
  capabilities = {},
  failAt,
  revokeStatus = 204,
  denialStatus = 403,
} = {}) {
  const calls = [];
  let lookups = 0;
  let revoked = false;
  const call = async (path, body, token) => {
    calls.push({ path, body, token });
    if (path === failAt) throw new Error(secret);
    if (path.startsWith('auth/platform-custodian/login/'))
      return {
        status: 200,
        value: {
          auth: {
            client_token: secret,
            policies: ['platform-deployment-maintainer'],
            token_policies: ['platform-deployment-maintainer'],
            metadata: { username: 'platform-owner-custodian' },
            lease_duration: 900,
            ...login,
          },
        },
      };
    assert.equal(token, secret);
    if (path === 'auth/token/lookup-self') {
      if (lookups++ || revoked) return { status: denialStatus, value: {} };
      return {
        status: 200,
        value: {
          data: {
            meta: { username: 'platform-owner-custodian' },
            path: 'auth/platform-custodian/login/platform-owner-custodian',
            display_name: 'platform-custodian-platform-owner-custodian',
            policies: ['platform-deployment-maintainer'],
            orphan: true,
            type: 'service',
            num_uses: 0,
            ttl: 899,
            creation_ttl: 900,
            explicit_max_ttl: 900,
            renewable: true,
            ...identity,
          },
        },
      };
    }
    if (path === 'sys/capabilities-self')
      return {
        status: 200,
        value: { data: { ...expectedCapabilities, ...capabilities } },
      };
    if (path === 'auth/token/revoke-self') {
      revoked = true;
      return { status: revokeStatus, value: {} };
    }
    assert.fail('out of scope request');
  };
  return { call, calls };
}
test('single session observes only exact approved paths then acknowledges and confirms cleanup', async () => {
  const f = fixture();
  const result = await verifyCustodian(f.call, 'sensitive-test-password');
  assert.equal(result.state, 'verified');
  assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
  assert.equal(result.capabilities.length, 10);
  assert.deepEqual(
    f.calls.map((c) => c.path),
    [
      'auth/platform-custodian/login/platform-owner-custodian',
      'auth/token/lookup-self',
      'sys/capabilities-self',
      'auth/token/revoke-self',
      'auth/token/lookup-self',
    ],
  );
  assert.deepEqual(f.calls[2].body, {
    paths: Object.keys(expectedCapabilities),
  });
  assert.ok(!JSON.stringify(result).includes('sensitive-test'));
});
test('unexpected identity, policy, period and session bounds stop before capabilities with cleanup', async () => {
  for (const identity of [
    { meta: { username: 'another-user' } },
    { path: 'auth/other/login/another' },
    { display_name: 'userpass-platform-owner-custodian' },
    { policies: ['root'] },
    { identity_policies: ['extra'] },
    { period: 900 },
    { ttl: 901 },
    { explicit_max_ttl: 1800 },
    { orphan: false },
    { type: 'batch' },
    { creation_ttl: 1800 },
    { num_uses: 3 },
  ]) {
    const f = fixture({ identity });
    const result = await verifyCustodian(f.call, 'password');
    assert.equal(result.state, 'stopped');
    assert.equal(result.capabilityBatches, 0);
    assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
    assert.equal(f.calls.filter((c) => c.path.includes('/login/')).length, 1);
  }
});
test('lost login response never retries and reports uncertainty without inventing cleanup', async () => {
  const f = fixture({
    failAt: 'auth/platform-custodian/login/platform-owner-custodian',
  });
  const result = await verifyCustodian(f.call, 'password');
  assert.equal(f.calls.length, 1);
  assert.equal(result.cleanup, 'login_result_uncertain');
  assert.ok(!JSON.stringify(result).includes(secret));
});
test('unexpected login attributes stop and revoke the returned session', async () => {
  const f = fixture({ login: { identity_policies: ['extra'] } });
  const result = await verifyCustodian(f.call, 'password');
  assert.equal(result.capabilityBatches, 0);
  assert.equal(f.calls[1].path, 'auth/token/revoke-self');
  assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
});
test('extra authority and malformed capabilities are sanitized differences, with no extra query', async () => {
  for (const observed of [['read'], ['secret-arbitrary-body'], null]) {
    const f = fixture({
      capabilities: { 'sys/storage/raft/snapshot': observed },
    });
    const result = await verifyCustodian(f.call, 'password');
    assert.equal(result.state, 'stopped');
    assert.equal(result.capabilityBatches, 1);
    assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
    assert.ok(!JSON.stringify(result).includes('secret-arbitrary-body'));
  }
});
test('capability request failure still cleans up without another batch', async () => {
  const f = fixture({ failAt: 'sys/capabilities-self' });
  const result = await verifyCustodian(f.call, 'password');
  assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
  assert.equal(result.capabilityBatches, 1);
  assert.equal(result.state, 'stopped');
});
test('denial without acknowledgement, failed cleanup, and uncertain confirmation do not pass', async () => {
  for (const options of [
    { revokeStatus: 500 },
    { denialStatus: 200 },
    { failAt: 'auth/token/revoke-self' },
  ]) {
    const f = fixture(options);
    const result = await verifyCustodian(f.call, 'password');
    assert.equal(result.cleanup, 'uncertain');
    assert.equal(result.state, 'stopped');
    assert.equal(
      f.calls.filter((c) => c.path === 'auth/token/revoke-self').length,
      1,
    );
    assert.equal(
      f.calls.filter((c) => c.path === 'auth/token/lookup-self').length,
      2,
    );
  }
});
