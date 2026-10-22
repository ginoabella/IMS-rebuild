import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { provisionBootstrap } from './bootstrap-provision.mjs';
const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../docs/planning/p3-u3a-guarded-bootstrap-preparation.json',
      import.meta.url,
    ),
  ),
);
const hash = (v) => createHash('sha256').update(v).digest('hex');
function fixture({
  lostAt = -1,
  rejectedAt = -1,
  markFailure = -1,
  persistFailure = false,
  stale = false,
  drift = false,
} = {}) {
  const requests = [],
    events = [],
    outputs = [];
  const data = { current: true };
  const plan = {
    ...candidate,
    operationId: '11111111-1111-4111-8111-111111111111',
    prestateReviewApproved: true,
    prestateReads: [
      {
        path: 'sys/auth',
        method: 'GET',
        status: 200,
        responseSha256: hash(JSON.stringify(data)),
      },
    ],
  };
  let index = 0;
  return {
    requests,
    events,
    outputs,
    args: {
      plan,
      password: 'x'.repeat(64),
      client: {
        required: async () => ({ data: { policies: ['root'] } }),
        call: async (path, body, method) => {
          if (method === 'GET')
            return {
              status: 200,
              value: {
                request_id: 'changes-each-time',
                data: drift ? {} : data,
              },
            };
          requests.push({ path, body, method });
          const i = index++;
          if (i === lostAt) throw new Error('private provider diagnostics');
          return {
            status: i === rejectedAt ? 403 : 200,
            value:
              i === 6
                ? {
                    data: {
                      secret_id: 'PRIVATE-ID',
                      secret_id_accessor: 'PRIVATE-ACCESSOR',
                    },
                  }
                : {},
          };
        },
      },
      assertFresh: async () => {
        if (stale) throw new Error('stale');
      },
      mark: async (event, i) => {
        if (event === 'write-started' && i === markFailure)
          throw new Error('journal');
        events.push([event, i]);
      },
      persist: async (value) => {
        if (persistFailure) throw new Error('custody');
        outputs.push(value);
      },
    },
  };
}
test('exact nine writes use before-send journal, protected credential output and no secret result', async () => {
  const f = fixture();
  const result = await provisionBootstrap(f.args);
  assert.equal(f.requests.length, 9);
  assert.equal(f.events.length, 18);
  assert.deepEqual(f.events[0], ['write-started', 0]);
  assert.deepEqual(f.outputs, [
    { secretId: 'PRIVATE-ID', accessor: 'PRIVATE-ACCESSOR' },
  ]);
  assert.equal(f.requests[8].body.password, 'x'.repeat(64));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|password|secretId/);
});
test('every lost or denied write stops without replay or subsequent write', async () => {
  for (let i = 0; i < 9; i++) {
    for (const options of [{ lostAt: i }, { rejectedAt: i }]) {
      const f = fixture(options);
      await assert.rejects(provisionBootstrap(f.args));
      assert.equal(f.requests.length, i + 1);
      assert.ok(
        !f.events.some(([e, n]) => e === 'write-acknowledged' && n === i),
      );
    }
  }
});
test('no mutation on stale backup, changed prestate or failed before-send journal', async () => {
  for (const options of [
    { stale: true },
    { drift: true },
    { markFailure: 0 },
  ]) {
    const f = fixture(options);
    await assert.rejects(provisionBootstrap(f.args));
    assert.equal(f.requests.length, 0);
  }
  const f = fixture({ persistFailure: true });
  await assert.rejects(provisionBootstrap(f.args));
  assert.equal(f.requests.length, 7);
});
test('arbitrary root write scope and missing prestate approval reject before provider calls', async () => {
  const f = fixture();
  f.args.plan = {
    ...f.args.plan,
    writes: f.args.plan.writes.map((w, i) =>
      i ? w : { ...w, path: 'sys/auth/unreviewed' },
    ),
  };
  f.args.plan.writesSha256 = hash(JSON.stringify(f.args.plan.writes));
  await assert.rejects(provisionBootstrap(f.args));
  assert.equal(f.requests.length, 0);
  const g = fixture();
  g.args.plan.prestateReviewApproved = false;
  await assert.rejects(provisionBootstrap(g.args));
});
