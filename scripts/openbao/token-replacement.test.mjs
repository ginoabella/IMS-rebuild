import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenReplacementCandidate } from './token-replacement-candidate.mjs';

const origin = 1800000000000;
function fixture() {
  let now = origin;
  let healthy = true;
  const identity = (delta = {}) => ({
    accessor: 'synthetic-current',
    creation_time: origin / 1000,
    issue_time: new Date(origin).toISOString(),
    expire_time: new Date(now + 3600000).toISOString(),
    explicit_max_ttl: 86400,
    orphan: true,
    renewable: true,
    type: 'service',
    policies: ['exact-runtime'],
    identity_policies: [],
    period: 0,
    ttl: 3600,
    ...delta,
  });
  const owner = new TokenReplacementCandidate(
    identity(),
    {
      wall: () => now,
      monotonic: () => now - origin,
      healthy: () => healthy,
    },
    { expectedPolicy: 'exact-runtime' },
  );
  now += 10000;
  return {
    owner,
    next: (delta = {}) =>
      identity({
        accessor: 'synthetic-next',
        creation_time: Math.floor(now / 1000),
        issue_time: new Date(now).toISOString(),
        ...delta,
      }),
    advance: (ms) => {
      now += ms;
    },
    unhealthy: () => {
      healthy = false;
    },
  };
}
const revoke = async () => ({ status: 204 });
const confirm = async () => ({ status: 403 });

test('valid replacement consumes only after exact prior revocation confirmation', async () => {
  const f = fixture();
  assert.equal(await f.owner.run(async () => 'prior'), 'prior');
  f.owner.stage(f.next());
  assert.deepEqual(f.owner.status(), {
    state: 'staged',
    currentTokens: 1,
    stagedCandidates: 1,
    priorUnconfirmedTokens: 0,
  });
  await assert.rejects(
    f.owner.run(async () => assert.fail()),
    /consumption_paused/,
  );
  const order = [];
  await f.owner.switch(
    async () => {
      order.push('revoke');
      return revoke();
    },
    async () => {
      order.push('confirm');
      return confirm();
    },
  );
  assert.deepEqual(order, ['revoke', 'confirm']);
  assert.deepEqual(f.owner.status(), {
    state: 'active',
    currentTokens: 1,
    stagedCandidates: 0,
    priorUnconfirmedTokens: 0,
  });
  assert.equal(await f.owner.run(async () => 'next'), 'next');
  assert.equal(JSON.stringify(f.owner), '{}');
});

test('wrong scope, maximum, identity overlap, old origin, alias or future issuance never switches', () => {
  for (const delta of [
    { policies: ['foreign-runtime'] },
    { identity_policies: ['extra'] },
    { explicit_max_ttl: 172800 },
    { period: 60 },
    { orphan: false },
    { type: 'batch' },
    { ttl: 3601 },
    { ttl: '3600' },
    { accessor: 'synthetic-current' },
    {
      creation_time: origin / 1000,
      issue_time: new Date(origin).toISOString(),
    },
    {
      creation_time: (origin + 20000) / 1000,
      issue_time: new Date(origin + 20000).toISOString(),
    },
  ]) {
    const f = fixture();
    assert.throws(() => f.owner.stage(f.next(delta)));
    assert.equal(f.owner.status().state, 'cleanup_required');
    assert.equal(f.owner.status().stagedCandidates, 1);
  }
});

test('expired prior authority or untrusted clock refuses replacement and retains candidate accounting', async () => {
  for (const mutate of [(f) => f.advance(3600000), (f) => f.unhealthy()]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => f.owner.stage(f.next()), /deadline/);
    assert.equal(f.owner.status().stagedCandidates, 1);
    await assert.rejects(
      f.owner.run(async () => true),
      /consumption_paused/,
    );
  }
});

test('overlap starts at replacement issuance and expired or insufficient cleanup budget cannot switch', async () => {
  const expired = fixture();
  const stale = expired.next();
  expired.advance(30000);
  assert.throws(() => expired.owner.stage(stale), /overlap_expired/);
  const near = fixture();
  near.owner.stage(near.next());
  near.advance(29000);
  let calls = 0;
  await assert.rejects(
    near.owner.switch(
      async () => {
        calls++;
        return revoke();
      },
      confirm,
      1000,
    ),
    /preflight_failed/,
  );
  assert.equal(calls, 0);
  assert.equal(near.owner.status().stagedCandidates, 1);
});

test('revocation failure, live prior lookup or malformed confirmation preserves both tokens and pauses', async () => {
  for (const [first, second] of [
    [async () => ({ status: 500 }), confirm],
    [revoke, async () => ({ status: 200 })],
    [revoke, async () => ({ status: 404 })],
    [revoke, async () => ({})],
    [
      async () => {
        throw new Error('synthetic');
      },
      confirm,
    ],
  ]) {
    const f = fixture();
    f.owner.stage(f.next());
    await assert.rejects(f.owner.switch(first, second), /cleanup_uncertain/);
    assert.deepEqual(f.owner.status(), {
      state: 'cleanup_required',
      currentTokens: 1,
      stagedCandidates: 0,
      priorUnconfirmedTokens: 1,
    });
    await assert.rejects(
      f.owner.run(async () => assert.fail()),
      /consumption_paused/,
    );
    await assert.rejects(f.owner.switch(revoke, confirm), /not_available/);
    assert.throws(() => f.owner.stage(f.next()), /not_available/);
  }
});

test('lost cleanup is aborted and late success cannot activate replacement', async () => {
  const f = fixture();
  f.owner.stage(f.next());
  let finish, signal;
  await assert.rejects(
    f.owner.switch(
      (s) => {
        signal = s;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      confirm,
      10,
    ),
    /cleanup_uncertain/,
  );
  assert.equal(signal.aborted, true);
  finish({ status: 204 });
  await Promise.resolve();
  assert.equal(f.owner.status().priorUnconfirmedTokens, 1);
  await assert.rejects(
    f.owner.run(async () => true),
    /consumption_paused/,
  );
});

test('confirmation after overlap cannot activate; confirmed prior remains accounted separately', async () => {
  const f = fixture();
  f.owner.stage(f.next());
  await assert.rejects(
    f.owner.switch(revoke, async () => {
      f.advance(30000);
      return confirm();
    }),
    /cleanup_uncertain/,
  );
  assert.equal(f.owner.status().state, 'cleanup_required');
  assert.equal(f.owner.status().priorUnconfirmedTokens, 0);
});

test('no replacement while work runs, while staged or while switching', async () => {
  const f = fixture();
  let finish;
  const work = f.owner.run(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  assert.throws(() => f.owner.stage(f.next()), /not_available/);
  await Promise.resolve();
  finish(true);
  await work;
  f.owner.stage(f.next());
  assert.throws(() => f.owner.stage(f.next()), /not_available/);
  let cleanup;
  const switching = f.owner.switch(
    () =>
      new Promise((resolve) => {
        cleanup = resolve;
      }),
    confirm,
  );
  await assert.rejects(f.owner.switch(revoke, confirm), /not_available/);
  cleanup({ status: 204 });
  await switching;
});

test('new-token observed TTL narrows its lease and an expired replacement cannot consume', async () => {
  const f = fixture();
  f.owner.stage(f.next({ ttl: 6 }));
  await assert.rejects(
    f.owner.switch(revoke, confirm, 1000),
    /preflight_failed/,
  );
  const ready = fixture();
  ready.owner.stage(ready.next({ ttl: 60 }));
  await ready.owner.switch(revoke, confirm);
  ready.advance(55000);
  await assert.rejects(
    ready.owner.run(async () => true),
    /deadline_reprovision_required/,
  );
});

test('uncertain in-flight consumption prevents replacement even when work ignores abort', async () => {
  const f = fixture();
  await assert.rejects(
    f.owner.run(() => new Promise(() => {}), 10),
    /request_uncertain/,
  );
  assert.throws(() => f.owner.stage(f.next()), /not_available/);
  assert.deepEqual(f.owner.status(), {
    state: 'cleanup_required',
    currentTokens: 1,
    stagedCandidates: 0,
    priorUnconfirmedTokens: 0,
  });
});
