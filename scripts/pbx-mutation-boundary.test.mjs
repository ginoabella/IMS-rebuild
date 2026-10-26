import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { PhysicalMutationBoundary } = backend(
  './dist/modules/telephony/adapters/live/mutation-boundary.js',
);
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'pbx-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const node = randomUUID(),
    installation = randomUUID(),
    baseline = randomUUID(),
    token = {
      nodeId: node,
      incarnation: randomUUID(),
      epoch: '1',
      desiredVersion: 1,
    };
  let current = { ...token };
  const authority = {
    current: async (t) =>
      t.nodeId === current.nodeId &&
      t.epoch === current.epoch &&
      t.incarnation === current.incarnation &&
      t.desiredVersion === current.desiredVersion,
  };
  const boundary = new PhysicalMutationBoundary(
    root,
    node,
    installation,
    authority,
  );
  const intent = {
    operationId: randomUUID(),
    revisionId: randomUUID(),
    sequence: 1,
    expectedBaselineId: baseline,
    fingerprint: 'a'.repeat(64),
  };
  return {
    boundary,
    root,
    node,
    installation,
    baseline,
    token,
    intent,
    authority,
    setCurrent: (t) => {
      current = { ...t };
    },
  };
}
const code = (value) => (e) => e.code === value;
test('physical queue orders takeover after an already admitted effect; stale dispatched work rejects after acknowledgement', async (t) => {
  const s = setup(t);
  await s.boundary.initialize(async () => s.baseline);
  await s.boundary.takeover(s.token);
  const events = [];
  let release, entered;
  const hold = new Promise((r) => {
      release = r;
    }),
    start = new Promise((r) => {
      entered = r;
    });
  const result = {
    kind: 'verified',
    installedId: s.intent.revisionId,
    verifiedId: s.intent.revisionId,
  };
  const effect = s.boundary.execute(
    s.token,
    s.intent,
    async (guard) => {
      await guard();
      events.push('old admitted');
      entered();
      await hold;
      events.push('old finished');
      return result;
    },
    async () => {
      throw new Error('unexpected reconciliation');
    },
  );
  await start;
  const successor = { ...s.token, incarnation: randomUUID(), epoch: '2' };
  // Canonical ownership changes while a dispatched command is already executing.
  // The physical takeover cannot acknowledge or admit a successor effect yet.
  s.setCurrent(successor);
  const takeover = s.boundary
    .takeover(successor)
    .then(() => events.push('takeover acknowledged'));
  release();
  await assert.rejects(effect, code('stale_owner'));
  await takeover;
  assert.deepEqual(events, [
    'old admitted',
    'old finished',
    'takeover acknowledged',
  ]);
  let staleEffect = false;
  await assert.rejects(
    s.boundary.execute(
      s.token,
      s.intent,
      async () => {
        staleEffect = true;
        return result;
      },
      async () => result,
    ),
    code('stale_owner'),
  );
  assert.equal(staleEffect, false);
  // The unacknowledged old result is reconciled, never blindly dispatched again.
  let reconciled = 0;
  assert.deepEqual(
    await s.boundary.execute(
      successor,
      s.intent,
      async () => {
        throw new Error('unsafe replay');
      },
      async (guard) => {
        await guard();
        reconciled++;
        return result;
      },
    ),
    result,
  );
  assert.equal(reconciled, 1);
});
test('exact duplicate receipts do not repeat effects; conflicting identities and operation order reject', async (t) => {
  const s = setup(t);
  await s.boundary.initialize(async () => s.baseline);
  await s.boundary.takeover(s.token);
  let count = 0;
  const done = {
    kind: 'verified',
    installedId: s.intent.revisionId,
    verifiedId: s.intent.revisionId,
  };
  const run = async (guard) => {
    await guard();
    count++;
    return done;
  };
  await assert.rejects(
    s.boundary.execute(s.token, { ...s.intent, sequence: 2 }, run, run),
    code('out_of_order'),
  );
  await s.boundary.execute(s.token, s.intent, run, run);
  await s.boundary.execute(s.token, s.intent, run, run);
  assert.equal(count, 1);
  await assert.rejects(
    s.boundary.execute(
      s.token,
      { ...s.intent, revisionId: randomUUID() },
      run,
      run,
    ),
    code('request_conflict'),
  );
  await assert.rejects(
    s.boundary.execute(
      s.token,
      { ...s.intent, operationId: randomUUID(), sequence: 2 },
      run,
      run,
    ),
    code('stale_baseline'),
  );
});
test('a fresh process instance reconciles durable uncertainty and blocks a different revision', async (t) => {
  const s = setup(t);
  await s.boundary.initialize(async () => s.baseline);
  await s.boundary.takeover(s.token);
  await assert.rejects(
    s.boundary.execute(
      s.token,
      s.intent,
      async () => {
        throw new Error('process interrupted');
      },
      async () => {
        throw new Error();
      },
    ),
    code('reconciliation_required'),
  );
  const restarted = new PhysicalMutationBoundary(
    s.root,
    s.node,
    s.installation,
    s.authority,
  );
  const unknown = {
    kind: 'unknown',
    installedId: s.intent.revisionId,
    verifiedId: null,
  };
  await assert.rejects(
    restarted.execute(
      s.token,
      { ...s.intent, operationId: randomUUID(), revisionId: randomUUID() },
      async () => unknown,
      async () => unknown,
    ),
    code('reconciliation_required'),
  );
  let replayed = false;
  assert.deepEqual(
    await restarted.execute(
      s.token,
      s.intent,
      async () => {
        replayed = true;
        return unknown;
      },
      async () => unknown,
    ),
    unknown,
  );
  assert.equal(replayed, false);
  const recovered = {
    kind: 'recovered',
    installedId: s.baseline,
    verifiedId: s.baseline,
  };
  assert.deepEqual(
    await restarted.execute(
      s.token,
      s.intent,
      async () => {
        throw new Error('unsafe replay');
      },
      async () => recovered,
    ),
    recovered,
  );
});
test('canonical authority failure prevents admission and an equal epoch cannot change owner', async (t) => {
  const s = setup(t);
  await s.boundary.initialize(async () => s.baseline);
  await s.boundary.takeover(s.token);
  const impostor = { ...s.token, incarnation: randomUUID() };
  s.setCurrent(impostor);
  await assert.rejects(s.boundary.takeover(impostor), code('stale_owner'));
  let touched = false;
  await assert.rejects(
    s.boundary.execute(
      s.token,
      s.intent,
      async () => {
        touched = true;
        return { kind: 'unknown', installedId: null, verifiedId: null };
      },
      async () => {
        throw new Error();
      },
    ),
    code('stale_owner'),
  );
  assert.equal(touched, false);
});

test('corrupt durable intent/receipt schemas fail closed; pre-install rejection cannot promote a baseline', async (t) => {
  const s = setup(t);
  await s.boundary.initialize(async () => s.baseline);
  await s.boundary.takeover(s.token);
  await assert.rejects(
    s.boundary.execute(
      s.token,
      s.intent,
      async () => ({
        kind: 'validation_failed',
        installedId: null,
        verifiedId: s.intent.revisionId,
      }),
      async () => {
        throw new Error('unexpected retry');
      },
    ),
    code('reconciliation_required'),
  );
  assert.equal(
    (await s.boundary.inspect(s.token, s.intent.operationId)).state,
    'pending',
  );
  const path = join(s.root, 'boundary.json'),
    original = readFileSync(path, 'utf8');
  const state = JSON.parse(original);
  for (const corrupt of [
    { ...state, pending: { ...state.pending, sequence: 99 } },
    { ...state, pending: { ...state.pending, fingerprint: 'invalid' } },
    {
      ...state,
      receipts: [
        {
          intent: s.intent,
          result: {
            kind: 'verified',
            installedId: s.intent.revisionId,
            verifiedId: s.baseline,
          },
        },
      ],
    },
    { ...state, unreviewed: 'extra' },
  ]) {
    writeFileSync(path, JSON.stringify(corrupt));
    await assert.rejects(
      s.boundary.inspect(s.token, s.intent.operationId),
      code('boundary_unavailable'),
    );
  }
  writeFileSync(path, original);
  assert.equal(
    (await s.boundary.inspect(s.token, s.intent.operationId)).state,
    'pending',
  );
});
