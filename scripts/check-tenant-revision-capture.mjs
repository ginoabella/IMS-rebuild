import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { tenantRouting } = backend(
  './dist/modules/telephony/domain/tenant-routing.js',
);
/** Real canonical two-tenant API fixture. This establishes capture, not live calls. */
export async function checkTenantRevisionCapture({
  request,
  owner,
  root,
  one,
  two,
  extensions,
  inbound,
  outbound,
  permissions,
  path,
  tv,
}) {
  const capture = await request(root + '/revisions', 'POST', {
    requestId: randomUUID(),
  });
  assert.equal(capture.status, 201, JSON.stringify(capture));
  const revision = capture.data.revision;
  assert.equal(revision.compilerVersion, 'tenant-review-1');
  assert.equal(revision.policyVersion, 'tenant-routing-1');
  const saved = (
    await owner.query('SELECT snapshot FROM public.pbx_revisions WHERE id=$1', [
      revision.id,
    ])
  ).rows[0].snapshot;
  assert.equal(saved.schemaVersion, 'tenant-routing-1');
  assert.deepEqual(
    saved.tenantRouting.tenants.map((t) => t.id).sort(),
    [one.id, two.id].sort(),
  );
  assert.equal(saved.tenantRouting.allocations.length, 2);
  const eligibility = tenantRouting(saved);
  assert.equal(eligibility.valid, true);
  for (const [i, t] of [one, two].entries()) {
    assert.equal(eligibility.extension(t.id, extensions[i].id), true);
    assert.equal(eligibility.extension(t.id, extensions[1 - i].id), false);
    assert.equal(eligibility.inbound(t.id, inbound[i].id), true);
    assert.equal(eligibility.inbound(t.id, inbound[1 - i].id), false);
    assert.equal(eligibility.outbound(t.id, outbound[i].id), true);
    assert.equal(eligibility.outbound(t.id, outbound[1 - i].id), false);
  }
  const before = await request(root + '/revisions/' + revision.id);
  assert.equal(before.status, 200, JSON.stringify(before));
  assert.equal(before.data.sourceCurrent, true);
  assert.ok(before.data.resources.some((r) => r.kind === 'allocations'));
  assert.ok(before.data.resources.some((r) => r.kind === 'authorizations'));
  assert.ok(before.data.resources.some((r) => r.kind === 'tenants'));
  const validation = await request(
    root + '/revisions/' + revision.id + '/validate',
    'POST',
    {},
  );
  assert.equal(validation.status, 201, JSON.stringify(validation));
  assert.equal(validation.data.validation.applicable, true);
  for (const kind of ['tenants', 'allocations', 'authorizations'])
    assert.ok(
      validation.data.validation.evaluatedDependencies.some(
        (d) => d.kind === kind,
      ),
    );
  const permission = permissions[0];
  const revoked = await request(path(one, permission.id + '/revoke'), 'POST', {
    requestId: randomUUID(),
    ...tv(one),
    expectedVersion: permission.version,
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked));
  const after = await request(root + '/revisions/' + revision.id);
  assert.equal(after.status, 200, JSON.stringify(after));
  assert.equal(after.data.sourceCurrent, false);
  assert.equal(after.data.validation.applicable, false);
  const immutable = (
    await owner.query('SELECT snapshot FROM public.pbx_revisions WHERE id=$1', [
      revision.id,
    ])
  ).rows[0].snapshot;
  assert.deepEqual(immutable, saved);
  // Restore through the actual reviewed API. A fresh UUID keeps original history immutable.
  const review = await request(path(one, 'preview'), 'POST', {
    kind: 'permission',
    resourceId: permission.resourceId,
    scope: 'owned',
  });
  assert.equal(review.status, 200, JSON.stringify(review));
  const restored = await request(path(one), 'POST', {
    requestId: randomUUID(),
    ...tv(one),
    kind: 'permission',
    resourceId: permission.resourceId,
    scope: 'owned',
    evaluated: review.data.evaluated,
    expectedVersion: null,
  });
  assert.equal(restored.status, 201, JSON.stringify(restored));
  permissions[0] = restored.data.items[0];
  const routeReview = await request(path(one, 'preview'), 'POST', {
    kind: 'outbound',
    resourceId: outbound[0].id,
    scope: 'owned',
  });
  assert.equal(routeReview.data.compatible, true, JSON.stringify(routeReview));
  const rebound = await request(path(one), 'POST', {
    requestId: randomUUID(),
    ...tv(one),
    kind: 'outbound',
    resourceId: outbound[0].id,
    scope: 'owned',
    evaluated: routeReview.data.evaluated,
    expectedVersion: routeReview.data.currentVersion,
  });
  assert.equal(rebound.status, 200, JSON.stringify(rebound));
  console.log(
    'PASS tenant revision capture: exact canonical facts, two-tenant ownership, immutable history and permission invalidation; no live-call claim',
  );
}
