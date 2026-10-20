import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizationDeadlineCandidate } from './authorization-deadline-candidate.mjs';

const issued = 1800000000000;
function fixture() {
  let now = issued;
  let healthy = true;
  const identity = (delta = {}) => ({
    accessor: 'synthetic-only',
    creation_time: issued / 1000,
    issue_time: new Date(issued).toISOString(),
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
  const guard = new AuthorizationDeadlineCandidate(
    identity(),
    {
      wall: () => now,
      monotonic: () => now - issued,
      healthy: () => healthy,
    },
    { expectedPolicy: 'exact-runtime' },
  );
  return {
    guard,
    identity,
    lookup: (delta) => ({ status: 200, value: { data: identity(delta) } }),
    advance: (ms) => {
      now += ms;
    },
    unhealthy: () => {
      healthy = false;
    },
    pause: () =>
      assert.throws(() => guard.renewalUnavailable(), /renewal_uncertain/),
  };
}

test('lost renewal pauses consumption; independent same-token lookup resumes within original bounds', async () => {
  const f = fixture();
  f.advance(600000);
  f.pause();
  await assert.rejects(
    f.guard.run(async () => assert.fail('paused work started')),
    /deadline_paused/,
  );
  assert.deepEqual(await f.guard.reconcile(async () => f.lookup()), {
    state: 'same_token_reconciled',
  });
  assert.equal(f.guard.remainingMs(), 3595000);
  assert.equal(await f.guard.run(async () => 'valid'), 'valid');
});

test('HTTP 500 or lost lookup stays paused, uses only two attempts and never extends authority', async () => {
  const f = fixture();
  f.pause();
  let calls = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      f.guard.reconcile(async () => {
        calls++;
        return { status: 500, value: {} };
      }),
      /reconciliation_uncertain/,
    );
    assert.throws(() => f.guard.check(), /deadline_paused/);
  }
  await assert.rejects(
    f.guard.reconcile(async () => {
      calls++;
      return f.lookup();
    }),
    /reconciliation_exhausted/,
  );
  assert.equal(calls, 2);
  const lost = fixture();
  lost.pause();
  let signal;
  await assert.rejects(
    lost.guard.reconcile((s) => {
      signal = s;
      return new Promise(() => {});
    }, 10),
    /reconciliation_uncertain/,
  );
  assert.equal(signal.aborted, true);
  assert.throws(() => lost.guard.check(), /deadline_paused/);
});

test('revoked, wrong token, identity-policy overlap, periodic or malformed lookup is terminal', async () => {
  for (const response of [
    () => ({ status: 403 }),
    () => ({ status: 404 }),
    (f) => f.lookup({ accessor: 'different-token' }),
    (f) => f.lookup({ identity_policies: ['unexpected'] }),
    (f) => f.lookup({ period: 60 }),
    (f) => f.lookup({ type: 'batch' }),
    (f) => f.lookup({ ttl: '3600' }),
    (f) => f.lookup({ ttl: 3601 }),
    () => ({ status: 200, value: {} }),
  ]) {
    const f = fixture();
    f.pause();
    await assert.rejects(
      f.guard.reconcile(async () => response(f)),
      /authority_revoked|identity_changed|identity_invalid/,
    );
    await assert.rejects(
      f.guard.reconcile(async () => f.lookup()),
      /reconciliation_unavailable/,
    );
    assert.throws(() => f.guard.check(), /deadline_paused/);
  }
});

test('late live lookup, clock uncertainty and new failure cannot resume authority', async () => {
  for (const mutate of [
    (f) => f.advance(3595000),
    (f) => f.advance(86400000),
    (f) => f.unhealthy(),
    (f) => f.pause(),
  ]) {
    const f = fixture();
    f.pause();
    await assert.rejects(
      f.guard.reconcile(async () => {
        mutate(f);
        return f.lookup();
      }),
      /reprovision_required|clock_untrusted|reconciliation_uncertain/,
    );
    assert.throws(() => f.guard.check(), /deadline_paused/);
  }
});

test('concurrent reconciliation is excluded and a late timed-out response cannot unpause', async () => {
  const f = fixture();
  f.pause();
  let finish;
  const pending = f.guard.reconcile(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    20,
  );
  await assert.rejects(
    f.guard.reconcile(async () => f.lookup()),
    /reconciliation_in_progress/,
  );
  await assert.rejects(pending, /reconciliation_uncertain/);
  finish(f.lookup());
  await Promise.resolve();
  assert.throws(() => f.guard.check(), /deadline_paused/);
});

test('lookup cannot recreate issuance origin and a shorter observed lease narrows admission', async () => {
  const f = fixture();
  f.pause();
  await f.guard.reconcile(async () => f.lookup({ ttl: 60 }));
  assert.equal(f.guard.remainingMs(), 55000);
  f.advance(55000);
  assert.throws(() => f.guard.check(), /reprovision_required/);
  assert.throws(() => f.guard.renewalUnavailable(), /deadline_paused/);
  const changed = fixture();
  changed.pause();
  await assert.rejects(
    changed.guard.reconcile(async () =>
      changed.lookup({
        creation_time: issued / 1000 + 1,
        issue_time: new Date(issued + 1000).toISOString(),
      }),
    ),
    /identity_changed/,
  );
});

test('reconciliation after normal renewals cannot move the original absolute deadline', async () => {
  const f = fixture();
  for (let elapsed = 1200000; elapsed <= 84000000; elapsed += 1200000) {
    f.advance(1200000);
    f.guard.observeRenewal(
      {
        status: 200,
        value: { auth: { lease_duration: 3600, renewable: true } },
      },
      f.identity(),
    );
  }
  f.pause();
  await f.guard.reconcile(async () => f.lookup());
  assert.equal(f.guard.remainingMs(), 2395000);
  f.advance(2395000);
  assert.throws(() => f.guard.check(), /reprovision_required/);
  await assert.rejects(
    f.guard.reconcile(async () => f.lookup()),
    /reconciliation_unavailable/,
  );
});
