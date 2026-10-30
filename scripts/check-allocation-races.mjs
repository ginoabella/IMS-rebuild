import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
/** Held canonical writers exercise real row locks, not mocked repository results. */
export async function checkAllocationRaces({
  owner,
  runtime,
  issue,
  session,
  request,
  direct,
  a,
  b,
  path,
  one,
  two,
  ext,
  save,
  root,
  deps,
}) {
  async function blocked(pattern) {
    for (let i = 0; i < 80; i++) {
      const r = await runtime.query(
        "SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE $1 LIMIT 1",
        [pattern],
      );
      if (r.rows.length) return;
      await delay(10);
    }
    throw new Error('Expected canonical lock wait was not reached');
  }
  async function held(sql, args, call, pattern) {
    await owner.query('BEGIN');
    await owner.query(sql, args);
    const pending = call();
    try {
      await blocked(pattern);
    } finally {
      await owner.query('COMMIT');
    }
    return pending;
  }
  const raceTenant = (
    await request('/platform/tenants', 'POST', {
      requestId: randomUUID(),
      tenantCode: 'race-' + randomUUID().slice(0, 8),
      displayName: 'Allocation lifecycle race',
      administratorUsername: 'admin',
    })
  ).data.tenant;
  const stale = await held(
    'UPDATE public.tenants SET authority_version=authority_version+1 WHERE id=$1',
    [raceTenant.id],
    () => direct(a, path(raceTenant), 'POST', save(raceTenant, [ext('6230')])),
    '%public.tenants%FOR SHARE',
  );
  assert.equal(stale.status, 409, JSON.stringify(stale));
  assert.equal(stale.data.reason, 'stale_version');
  const current = (await request(`/platform/tenants/${raceTenant.id}`)).data
    .tenant;
  const status = await held(
    "UPDATE public.tenants SET status='suspended',version=version+1,authority_version=authority_version+1 WHERE id=$1",
    [current.id],
    () => direct(b, path(current), 'POST', save(current, [ext('6230')])),
    '%public.tenants%FOR SHARE',
  );
  assert.equal(status.data.reason, 'tenant_ineligible', JSON.stringify(status));
  const operatorId = randomUUID();
  await owner.query(
    "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) SELECT $1,$2,'active',credential_state,password_hash,credential_changed_at FROM public.platform_operators WHERE id=$3",
    [operatorId, 'allocation-' + operatorId, session.operatorId],
  );
  const token = (
      await issue(a, {
        plane: 'platform',
        identityId: operatorId,
        authenticationVersion: 1,
      })
    ).token,
    cookie = `__Host-myims-platform=${token}`;
  const proof = (
    await direct(a, '/platform/auth/session', 'GET', undefined, cookie)
  ).data.proof;
  const revoked = await held(
    "UPDATE public.platform_operators SET status='disabled',authentication_version=authentication_version+1 WHERE id=$1",
    [operatorId],
    () =>
      direct(a, path(one), 'POST', save(one, [ext('6230')]), cookie, {
        'x-platform-csrf': proof,
      }),
    '%public.platform_operators%FOR SHARE',
  );
  assert.equal(revoked.status, 403, JSON.stringify(revoked));
  const alternate = await request(root + '/endpoint-profiles', 'POST', {
    requestId: randomUUID(),
    name: 'Allocation race alternate',
    template: 'sip-basic',
    settings: { codecs: ['ulaw'], maxContacts: 2 },
    expectedNodeVersion: 1,
    expectedCapabilityRevision: 1,
  });
  assert.equal(alternate.status, 201, JSON.stringify(alternate));
  const editBody = {
    expectedVersion: 1,
    ...deps,
    profileId: alternate.data.profile.id,
  };
  for (const [number, kind] of [
    ['6231', 'profile'],
    ['6232', 'disable'],
  ]) {
    const e = ext(number);
    if (kind === 'disable') {
      const enabled = await request(
        root + '/extensions/' + e.id + '/status',
        'PATCH',
        { expectedVersion: e.version, administrativeStatus: 'enabled' },
      );
      assert.equal(enabled.status, 200, JSON.stringify(enabled));
      e.version = enabled.data.extension.version;
    }
    const body = save(one, [e]);
    const results = await Promise.all([
      direct(a, path(one), 'POST', body),
      direct(
        b,
        root + '/extensions/' + e.id + (kind === 'disable' ? '/status' : ''),
        'PATCH',
        kind === 'disable'
          ? { expectedVersion: e.version, administrativeStatus: 'disabled' }
          : editBody,
      ),
    ]);
    assert.ok(
      results[0].status === 201 || results[0].status === 409,
      JSON.stringify(results),
    );
    assert.ok(
      results[1].status === 200 || results[1].status === 409,
      JSON.stringify(results),
    );
    if (kind === 'profile')
      assert.ok(
        results.some((r) => r.status === 409),
        JSON.stringify(results),
      );
  }
  const reserve = await Promise.all([
    direct(a, path(two), 'POST', save(two, [ext('6233')])),
    direct(b, root + '/routing/reservations', 'POST', {
      requestId: randomUUID(),
      name: 'Allocation namespace race',
      purpose: 'Fixture',
      pattern: { kind: 'exact', digits: '6233', minLength: 4, maxLength: 4 },
    }),
  ]);
  assert.deepEqual(
    reserve.map((r) => r.status),
    [201, 409],
  );
  const group = await request(root + '/routing/groups', 'POST', {
    requestId: randomUUID(),
    name: 'Release reference race',
    number: null,
    memberIds: [ext('6234').id],
    strategy: 'simultaneous',
    timeout: 10,
    fallback: { kind: 'hangup' },
  });
  assert.equal(group.status, 201, JSON.stringify(group));
  const claim = await request(path(one), 'POST', save(one, [ext('6234')]));
  assert.equal(claim.status, 201, JSON.stringify(claim));
  const c = claim.data.items[0];
  const release = await request(
    path(one, undefined, c.id + '/release'),
    'POST',
    {
      requestId: randomUUID(),
      expectedTenantVersion: one.version,
      expectedAuthorityVersion: one.authorityVersion,
      expectedVersion: 1,
    },
  );
  assert.equal(release.data.reason, 'referenced');
  console.log(
    'PASS allocation real held tenant authority/status, inventory profile/disable and namespace/reference writers',
  );
}
