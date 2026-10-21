import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewAuthority } from './review-authority-metadata.mjs';

const secret = 'sensitive-test-session';
function fixture({
  identity = {},
  login = {},
  metadata = {},
  roleResponse,
  failAt,
  revokeStatus = 204,
  denialStatus = 403,
} = {}) {
  const calls = [];
  let lookups = 0;
  let revoked = false;
  const call = async (
    path,
    body,
    token,
    method = body === undefined ? 'GET' : 'POST',
  ) => {
    calls.push({ path, body, token, method });
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
    if (path === 'sys/auth')
      return {
        status: 200,
        value: {
          data: {
            'token/': { type: 'token', ignored: secret },
            'platform-custodian/': { type: 'userpass' },
          },
          ...metadata,
        },
      };
    if (path === 'sys/policies/acl') {
      assert.equal(method, 'LIST');
      return {
        status: 200,
        value: {
          data: { keys: ['default', 'platform-deployment-maintainer'] },
        },
      };
    }
    if (path === 'auth/token/roles') {
      assert.equal(method, 'LIST');
      if (roleResponse) return roleResponse;
      return {
        status: 200,
        value: {
          data: {
            keys: ['endpoint-restricted-issuer', 'trunk-restricted-issuer'],
          },
        },
      };
    }
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
  const result = await reviewAuthority(f.call, 'sensitive-test-password');
  assert.equal(result.state, 'reviewed');
  assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
  assert.equal(result.metadataRequests, 3);
  assert.deepEqual(
    f.calls.map((c) => c.path),
    [
      'auth/platform-custodian/login/platform-owner-custodian',
      'auth/token/lookup-self',
      'sys/auth',
      'sys/policies/acl',
      'auth/token/roles',
      'auth/token/revoke-self',
      'auth/token/lookup-self',
    ],
  );
  assert.deepEqual(
    f.calls.slice(2, 5).map((c) => c.method),
    ['GET', 'LIST', 'LIST'],
  );
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
    const result = await reviewAuthority(f.call, 'password');
    assert.equal(result.state, 'stopped');
    assert.equal(result.metadataRequests, 0);
    assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
    assert.equal(f.calls.filter((c) => c.path.includes('/login/')).length, 1);
  }
});
test('lost login response never retries and reports uncertainty without inventing cleanup', async () => {
  const f = fixture({
    failAt: 'auth/platform-custodian/login/platform-owner-custodian',
  });
  const result = await reviewAuthority(f.call, 'password');
  assert.equal(f.calls.length, 1);
  assert.equal(result.cleanup, 'login_result_uncertain');
  assert.ok(!JSON.stringify(result).includes(secret));
});
test('unexpected login attributes stop and revoke the returned session', async () => {
  const f = fixture({ login: { identity_policies: ['extra'] } });
  const result = await reviewAuthority(f.call, 'password');
  assert.equal(result.metadataRequests, 0);
  assert.equal(f.calls[1].path, 'auth/token/revoke-self');
  assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
});
test('malformed or excessive metadata stops with cleanup and no response contents', async () => {
  for (const data of [
    null,
    [],
    { '../bad/': { type: 'secret-arbitrary-body' } },
    { 'good/': { type: 'invalid\nbody' } },
    Object.fromEntries(
      Array.from({ length: 129 }, (_, i) => [String(i), { type: 'token' }]),
    ),
  ]) {
    const f = fixture({ metadata: { data } });
    const result = await reviewAuthority(f.call, 'password');
    assert.equal(result.state, 'stopped');
    assert.equal(result.metadataRequests, 1);
    assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
    assert.ok(!JSON.stringify(result).includes('secret-arbitrary-body'));
  }
});
test('metadata failure stops immediately and cleans up without another login', async () => {
  for (const path of ['sys/auth', 'sys/policies/acl', 'auth/token/roles']) {
    const f = fixture({ failAt: path });
    const result = await reviewAuthority(f.call, 'password');
    assert.equal(result.state, 'stopped');
    assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
    assert.equal(f.calls.filter((c) => c.path.includes('/login/')).length, 1);
  }
});
test('denial without acknowledgement, failed cleanup, and uncertain confirmation do not pass', async () => {
  for (const options of [
    { revokeStatus: 500 },
    { denialStatus: 200 },
    { failAt: 'auth/token/revoke-self' },
  ]) {
    const f = fixture(options);
    const result = await reviewAuthority(f.call, 'password');
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

test('empty native role list is distinct from rejection and malformed error responses', async () => {
  for (const response of [
    { status: 404, value: { errors: [] } },
    { status: 403, value: { errors: [] } },
    { status: 404, value: { errors: ['sensitive-test-session'] } },
    {
      status: 404,
      value: { errors: [], unexpected: 'sensitive-test-session' },
    },
    { status: 200, value: { data: { keys: ['invalid\nname'] } } },
  ]) {
    const f = fixture({ roleResponse: response });
    const result = await reviewAuthority(f.call, 'password');
    assert.equal(
      result.state,
      response.status === 404 &&
        Object.keys(response.value).length === 1 &&
        response.value.errors.length === 0
        ? 'reviewed'
        : 'stopped',
    );
    assert.equal(result.cleanup, 'revoked_and_denial_confirmed');
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});
