import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizationDeadlineCandidate } from './authorization-deadline-candidate.mjs';
const candidate = (identity, clock, settings = {}) =>
  new AuthorizationDeadlineCandidate(identity, clock, {
    expectedPolicy: 'exact-runtime',
    ...settings,
  });
const issued = 1800000000000;
const identity = (overrides = {}) => ({
  accessor: 'synthetic-only',
  creation_time: issued / 1000,
  issue_time: new Date(issued).toISOString(),
  expire_time: new Date(issued + 3600000).toISOString(),
  explicit_max_ttl: 86400,
  orphan: true,
  renewable: true,
  type: 'service',
  policies: ['exact-runtime'],
  identity_policies: [],
  period: 0,
  ...overrides,
});
function fixture(offset = 0) {
  let elapsed = 0,
    wallOffset = offset,
    monoOffset = 0,
    healthy = true;
  return {
    clock: {
      wall: () => issued + elapsed + wallOffset,
      monotonic: () => elapsed + monoOffset,
      healthy: () => healthy,
    },
    advance: (ms) => {
      elapsed += ms;
    },
    wallStep: (ms) => {
      wallOffset += ms;
    },
    monoStep: (ms) => {
      monoOffset += ms;
    },
    unhealthy: () => {
      healthy = false;
    },
  };
}
const renewal = {
  status: 200,
  value: { auth: { lease_duration: 3600, renewable: true } },
};
test('24-hour candidate preserves normal 20-minute renewals, exact origin and five-second margin', () => {
  for (const skew of [-2000, 0, 2000]) {
    const f = fixture(skew),
      g = candidate(identity(), f.clock);
    for (let elapsed = 1200000; elapsed < 85200000; elapsed += 1200000) {
      f.advance(1200000);
      g.check(5000);
      g.observeRenewal(
        renewal,
        identity({
          expire_time: new Date(issued + elapsed + 3600000).toISOString(),
        }),
      );
      g.check(5000);
    }
  }
});
test('all bounded skews deny before real original maximum despite provider overrun', () => {
  for (let skew = -2000; skew <= 2000; skew += 100) {
    const f = fixture(skew);
    f.advance(86400000 - 20000);
    const g = candidate(
      identity({ expire_time: new Date(issued + 86400999).toISOString() }),
      f.clock,
    );
    g.check();
    f.advance(20000);
    assert.throws(() => g.check(), /deadline_reprovision_required/);
    assert.throws(
      () =>
        candidate(
          identity({ expire_time: new Date(issued + 86400999).toISOString() }),
          f.clock,
        ),
      /deadline_reprovision_required/,
    );
  }
});
test('restart, existing short lease and delayed lookup never acquire a new issuance origin', () => {
  const f = fixture();
  f.advance(3500000);
  const g = candidate(identity(), f.clock);
  assert.equal(g.remainingMs(), 95000);
  f.advance(95000);
  assert.throws(() => g.check(), /deadline_reprovision_required/);
});
test('failed, lost or malformed renewal pauses further work without extending authority', () => {
  for (const response of [
    { status: 500, value: {} },
    { status: 403, value: {} },
    { status: 200, value: {} },
    { status: 200, value: { auth: { lease_duration: 3601, renewable: true } } },
  ]) {
    const f = fixture(),
      g = candidate(identity(), f.clock);
    assert.throws(
      () => g.observeRenewal(response, identity()),
      /deadline_renewal_uncertain|deadline_authority_revoked/,
    );
    assert.throws(() => g.check(), /deadline_paused/);
  }
  const f = fixture(),
    g = candidate(identity(), f.clock);
  assert.throws(() => g.renewalUnavailable(), /deadline_renewal_uncertain/);
  assert.throws(() => g.check(), /deadline_paused/);
});
test('clock health loss, forward/backward steps, monotonic regression and suspension fail closed', () => {
  for (const invalid of [Number.NaN, Infinity, -Infinity]) {
    for (const field of ['wall', 'monotonic']) {
      const f = fixture();
      f.clock[field] = () => invalid;
      assert.throws(
        () => candidate(identity(), f.clock),
        /deadline_clock_untrusted/,
      );
    }
  }
  assert.throws(
    () =>
      candidate(identity(), fixture().clock, {
        maximumSeconds: 172800,
      }),
    /deadline_configuration/,
  );
  for (const change of [
    (f) => f.unhealthy(),
    (f) => f.wallStep(1000),
    (f) => f.wallStep(-1000),
    (f) => f.monoStep(-1),
    (f) => f.wallStep(60000),
  ]) {
    const f = fixture(),
      g = candidate(identity(), f.clock);
    change(f);
    assert.throws(() => g.check(), /deadline_clock_untrusted/);
    assert.throws(() => g.check(), /deadline_paused/);
  }
});
test('mismatched provider maximum, original identity and extra effective policy reject', () => {
  for (const delta of [
    { explicit_max_ttl: 172800 },
    { identity_policies: ['extra'] },
    { period: 3600 },
    { orphan: false },
    { creation_time: issued / 1000 + 1 },
    { issue_time: 'invalid' },
    { policies: ['exact-runtime', 'extra'] },
    { policies: ['wrong-single-policy'] },
  ])
    assert.throws(
      () => candidate(identity(delta), fixture().clock),
      /deadline_identity_invalid/,
    );
  for (const delta of [
    { accessor: 'different' },
    {
      creation_time: issued / 1000 + 1,
      issue_time: new Date(issued + 1000).toISOString(),
    },
    { policies: ['changed'] },
  ]) {
    const f = fixture(),
      g = candidate(identity(), f.clock);
    assert.throws(
      () => g.observeRenewal(renewal, identity(delta)),
      /deadline_identity_changed|deadline_identity_invalid/,
    );
  }
});
test('late successes cannot authorize completion and insufficient request budget does not start work', async () => {
  const f = fixture(),
    g = candidate(identity(), f.clock);
  let calls = 0;
  await assert.rejects(
    g.run(async () => {
      calls++;
      f.advance(3600000);
      return 'late';
    }),
    /deadline_reprovision_required/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    g.run(async () => {
      calls++;
    }),
    /deadline_paused/,
  );
  assert.equal(calls, 1);
});
test('lost request is bounded and aborted; fresh work still requires a new check', async () => {
  const g = candidate(identity(), fixture().clock);
  let signal;
  await assert.rejects(
    g.run((s) => {
      signal = s;
      return new Promise(() => {});
    }, 10),
    /deadline_request_uncertain/,
  );
  assert.equal(signal.aborted, true);
});
