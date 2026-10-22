import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryUnseal, sealKey } from './recovery-unseal.mjs';
const key = Buffer.alloc(32, 7).toString('base64');
function fixture(overrides = {}) {
  const calls = [];
  const responses = {
    'sys/seal-status': {
      status: 200,
      value: { initialized: true, t: 1, sealed: true },
    },
    'sys/unseal': { status: 200, value: { sealed: false } },
    'sys/health': {
      status: 200,
      value: { initialized: true, sealed: false, standby: false },
    },
    'sys/generate-root/attempt': { status: 405, value: {} },
    ...overrides,
  };
  return {
    calls,
    call: async (path, body) => {
      calls.push([path, body]);
      return responses[path];
    },
  };
}
test('one unseal request uses only the TLS body and returns no key', async () => {
  const f = fixture();
  assert.deepEqual(await recoveryUnseal('unseal', f.call, () => ({ key })), {
    state: 'unsealed_active',
  });
  assert.deepEqual(
    f.calls.map(([p]) => p),
    ['sys/seal-status', 'sys/unseal', 'sys/health'],
  );
  assert.deepEqual(f.calls[1][1], { key });
});
test('unseal rejection or lost response has no mutation retry', async () => {
  for (const response of [
    { status: 400, value: {} },
    { status: 200, value: { sealed: true } },
  ]) {
    const f = fixture({ 'sys/unseal': response });
    await assert.rejects(recoveryUnseal('unseal', f.call, () => ({ key })));
    assert.equal(f.calls.filter(([p]) => p === 'sys/unseal').length, 1);
  }
  let count = 0;
  const f = fixture();
  await assert.rejects(
    recoveryUnseal(
      'unseal',
      async (...args) => {
        if (args[0] === 'sys/unseal') {
          count++;
          throw new Error();
        }
        return f.call(...args);
      },
      () => ({ key }),
    ),
  );
  assert.equal(count, 1);
});
test('protected verification never reads key and requires active health plus 405', async () => {
  for (const status of [200, 403, 404, 405, 500]) {
    const f = fixture({ 'sys/generate-root/attempt': { status, value: {} } });
    const result = recoveryUnseal('verify-protected', f.call, () => {
      throw new Error('key read');
    });
    if (status === 405)
      assert.equal((await result).state, 'protected_active_generation_denied');
    else await assert.rejects(result);
    assert.equal(
      f.calls.some(([p]) => p === 'sys/unseal'),
      false,
    );
  }
});
test('unsupported quorum, invalid key, uninitialized and inactive providers reject', async () => {
  for (const value of [
    { initialized: false, t: 1 },
    { initialized: true, t: 2 },
  ]) {
    const f = fixture({ 'sys/seal-status': { status: 200, value } });
    await assert.rejects(recoveryUnseal('unseal', f.call, () => ({ key })));
    assert.equal(f.calls.length, 1);
  }
  for (const value of [null, {}, { key: 'invalid' }])
    assert.throws(() => sealKey(value));
  const f = fixture({ 'sys/health': { status: 503, value: {} } });
  await assert.rejects(recoveryUnseal('unseal', f.call, () => ({ key })));
});
