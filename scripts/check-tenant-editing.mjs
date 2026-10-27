import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkTenantEditing({
  owner,
  runtime,
  a,
  b,
  request,
  operator,
  post,
  data,
  barrier,
  replica,
  commitProxy,
  unavailableRedis,
  unavailableDatabase,
  expired,
  staffSession,
}) {
  const session = await operator(a),
    foreign = await operator(b);
  const created = await post(a, session, data());
  assert.equal(created.status, 201);
  const id = created.data.tenant.id,
    path = `/platform/tenants/${id}/configuration`;
  const read = async () => {
    const r = await request(b, `/platform/tenants/${id}`, { session });
    assert.equal(r.status, 200);
    return r.data;
  };
  const send = (body, call = a, s = session, extra = {}) =>
    request(call, path, { method: 'POST', session: s, body, ...extra });
  const attempt = (detail, section, values) => ({
    requestId: randomUUID(),
    expectedVersion: detail.tenant.version,
    expectedAuthorityVersion: detail.tenant.authorityVersion,
    section,
    values,
  });
  const count = async () =>
    (
      await owner.query(
        `SELECT (SELECT count(*)::int FROM public.tenant_edit_receipts WHERE tenant_id=$1) receipts,(SELECT count(*)::int FROM public.audit_events WHERE target_reference=$1::text) audits`,
        [id],
      )
    ).rows[0];
  const first = attempt(created.data, 'name', {
    displayName: '  Cebu Équipe %_\\ 救急  ',
  });
  assert.equal(
    (await request(a, path, { method: 'POST', body: first })).status,
    401,
  );
  assert.equal((await send(first, a, expired)).status, 401);
  assert.ok([401, 403].includes((await send(first, b, staffSession)).status));
  assert.equal((await send(first, unavailableRedis)).status, 503);
  assert.equal((await send(first, unavailableDatabase)).status, 503);
  assert.equal((await send(' '.repeat(5000))).status, 400);
  const changed = await send(first);
  assert.equal(changed.status, 200);
  assert.equal(
    changed.data.current.tenant.displayName,
    'Cebu Équipe %_\\ 救急',
  );
  assert.equal(changed.data.current.tenant.authorityVersion, 1);
  assert.equal(
    changed.data.current.administrator.id,
    created.data.administrator.id,
  );
  assert.equal(
    changed.data.current.tenant.tenantCode,
    created.data.tenant.tenantCode,
  );
  for (const q of [
    '  cEbU  ',
    'éQUIPE',
    '%_\\',
    '%',
    '_',
    '\\',
    '救急',
    created.data.tenant.tenantCode.toUpperCase(),
  ]) {
    const r = await request(
      b,
      `/platform/tenants?search=${encodeURIComponent(q)}&status=draft`,
      { session },
    );
    assert.equal(r.status, 200);
    assert.ok(
      r.data.items.some((t) => t.id === id),
      q,
    );
    if (['%', '_', '\\'].includes(q))
      assert.ok(
        r.data.items.every(
          (t) => t.displayName.includes(q) || t.tenantCode.includes(q),
        ),
      );
  }
  const unfiltered = await request(b, '/platform/tenants', { session });
  const blank = await request(b, '/platform/tenants?search=%20%20%20', {
    session,
  });
  assert.deepEqual(blank.data, unfiltered.data);
  for (const status of ['draft', 'active', 'suspended', 'retired']) {
    const r = await request(b, `/platform/tenants?status=${status}`, {
      session,
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.items.every((t) => t.status === status));
  }
  // Search and lifecycle criteria must survive every UUID keyset page across replicas.
  const pageSearch = `paging-${randomUUID()}`;
  const pageIds = [];
  for (let index = 0; index < 4; index++) {
    const fixture = await post(index % 2 ? b : a, session, {
      ...data(),
      displayName: `${pageSearch} ${index}`,
    });
    assert.equal(fixture.status, 201);
    if (index === 3)
      await owner.query(
        "UPDATE public.tenants SET status='active',version=version+1,authority_version=authority_version+1 WHERE id=$1",
        [fixture.data.tenant.id],
      );
    else pageIds.push(fixture.data.tenant.id);
  }
  pageIds.sort();
  let cursor = null;
  for (let index = 0; index < pageIds.length; index++) {
    const page = await request(
      index % 2 ? b : a,
      `/platform/tenants?limit=1&search=${encodeURIComponent(pageSearch.toUpperCase())}&status=draft${cursor ? `&after=${cursor}` : ''}`,
      { session },
    );
    assert.equal(page.status, 200);
    assert.deepEqual(
      page.data.items.map((tenant) => tenant.id),
      [pageIds[index]],
    );
    assert.equal(page.data.items[0].status, 'draft');
    assert.equal(
      page.data.nextCursor,
      index < pageIds.length - 1 ? pageIds[index] : null,
    );
    cursor = page.data.nextCursor;
  }
  for (const query of [
    'search=' + 'x'.repeat(201),
    'search=%00',
    'status=all',
    'search=a&search=b',
  ]) {
    assert.equal(
      (await request(b, `/platform/tenants?${query}`, { session })).status,
      400,
    );
  }
  const none = await request(b, `/platform/tenants?search=${randomUUID()}`, {
    session,
  });
  assert.deepEqual(none.data.items, []);
  const c = attempt(await read(), 'contacts', {
    name: ' Desk ',
    email: ' desk@example.org ',
    phone: ' +63 (2) 123-4567 ',
  });
  const concurrent = await Promise.all([send(c, a), send(c, b)]);
  assert.ok(concurrent.every((r) => r.status === 200));
  assert.equal(concurrent.filter((r) => !r.data.replayed).length, 1);
  let current = await read();
  assert.deepEqual(current.tenant.contacts, {
    name: 'Desk',
    email: 'desk@example.org',
    phone: '+63 (2) 123-4567',
  });
  assert.equal((await count()).receipts, 2);
  const upperReplay = await request(
    b,
    `/platform/tenants/${id.toUpperCase()}/configuration`,
    {
      method: 'POST',
      session,
      body: { ...c, requestId: c.requestId.toUpperCase() },
    },
  );
  assert.equal(upperReplay.status, 200);
  assert.equal(upperReplay.data.replayed, true);
  const beforeReplay = await count();
  assert.equal((await send({ ...c, values: { name: 'Changed' } })).status, 409);
  assert.equal((await send(c, b, foreign)).status, 409);
  assert.deepEqual(await count(), beforeReplay);
  const clear = attempt(current, 'contacts', { email: '  ', phone: null });
  assert.equal((await send(clear, b)).status, 200);
  current = await read();
  assert.deepEqual(current.tenant.contacts, {
    name: 'Desk',
    email: null,
    phone: null,
  });
  const replay = await send(c, b);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.ok(replay.data.outcome.version < replay.data.current.tenant.version);
  assert.deepEqual(
    replay.data.current.tenant.contacts,
    current.tenant.contacts,
  );
  const stale = await send(
    attempt(created.data, 'name', { displayName: 'stale' }),
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.data.reason, 'version_conflict');
  const left = attempt(current, 'name', { displayName: 'Race winner' }),
    right = attempt(current, 'contacts', { name: 'Other section' });
  const race = await Promise.all([send(left, a), send(right, b)]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  current = await read();
  const loser = race[0].status === 409 ? left : right;
  assert.equal(
    (
      await send({
        ...loser,
        requestId: randomUUID(),
        expectedVersion: current.tenant.version,
      })
    ).status,
    200,
  );
  current = await read();
  assert.equal(current.tenant.displayName, 'Race winner');
  assert.equal(current.tenant.contacts.name, 'Other section');
  assert.equal(current.tenant.contacts.email, null);
  for (const values of [
    { name: 'x'.repeat(201) },
    { name: '😀'.repeat(101) },
    { email: 'bad' },
    { email: 'a@b..org' },
    { email: 'a@' + 'b'.repeat(64) + '.org' },
    { phone: 'abc' },
    { phone: '++' },
    { phone: '1'.repeat(51) },
    { name: '\ud800' },
    {},
  ])
    assert.equal(
      (await send(attempt(current, 'contacts', values))).status,
      400,
    );
  for (const extra of [
    { tenantCode: 'forged' },
    { status: 'active' },
    { administratorId: randomUUID() },
    { roles: [] },
    { voicePreference: 'enabled' },
  ])
    assert.equal(
      (
        await send({
          ...attempt(current, 'name', { displayName: 'Valid' }),
          ...extra,
        })
      ).status,
      400,
    );
  assert.equal(
    (await send(attempt(current, 'name', { displayName: '' }))).status,
    400,
  );
  assert.equal(
    (await send(attempt(current, 'name', { displayName: '😀'.repeat(101) })))
      .status,
    400,
  );
  const maximumEmail =
    'a'.repeat(64) +
    '@' +
    'b'.repeat(63) +
    '.' +
    'c'.repeat(63) +
    '.' +
    'd'.repeat(61);
  assert.equal(maximumEmail.length, 254);
  assert.equal(
    (
      await send(
        attempt(current, 'contacts', {
          name: '😀'.repeat(100),
          email: maximumEmail,
          phone: '1'.repeat(50),
        }),
      )
    ).status,
    200,
  );
  current = await read();
  assert.deepEqual(current.tenant.contacts, {
    name: '😀'.repeat(100),
    email: maximumEmail,
    phone: '1'.repeat(50),
  });
  assert.equal(
    (await send(attempt(current, 'name', { displayName: '😀'.repeat(100) })))
      .status,
    200,
  );
  current = await read();
  assert.equal(current.tenant.displayName.length, 200);
  // Required audit, receipt and owner-write failures each roll back every attempt write with real runtime grants.
  for (const [revoke, grant] of [
    [
      'REVOKE INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events FROM myims_runtime',
      'GRANT INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events TO myims_runtime',
    ],
    [
      'REVOKE INSERT(request_id,operator_id,tenant_id,section,fingerprint,version,authority_version,correlation_id) ON public.tenant_edit_receipts FROM myims_runtime',
      'GRANT INSERT(request_id,operator_id,tenant_id,section,fingerprint,version,authority_version,correlation_id) ON public.tenant_edit_receipts TO myims_runtime',
    ],
    [
      'REVOKE UPDATE(contact_name) ON public.tenants FROM myims_runtime',
      'GRANT UPDATE(contact_name) ON public.tenants TO myims_runtime',
    ],
  ]) {
    const before = await read(),
      counts = await count();
    await owner.query(revoke);
    try {
      assert.equal(
        (await send(attempt(before, 'contacts', { name: 'Must roll back' })))
          .status,
        503,
      );
    } finally {
      await owner.query(grant);
    }
    assert.deepEqual(await read(), before);
    assert.deepEqual(await count(), counts);
  }
  current = await read();
  const lost = attempt(current, 'contacts', { name: 'Lost response desk' });
  assert.equal((await send(lost, a, session, { drop: true })).lost, true);
  const recovered = await send(lost, b);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.replayed, true);
  current = await read();
  const noChange = attempt(current, 'name', {
    displayName: current.tenant.displayName,
  });
  const beforeNoChange = await count();
  assert.equal((await send(noChange)).status, 200);
  assert.deepEqual(await count(), {
    receipts: beforeNoChange.receipts + 1,
    audits: beforeNoChange.audits + 1,
  });
  const uncertainProxy = await commitProxy(
    /INSERT INTO public\.tenant_edit_receipts/,
  );
  const uncertainReplica = await replica({ runtimeUrl: uncertainProxy.url });
  const uncertain = attempt(await read(), 'contacts', {
    name: 'Commit acknowledgement lost',
  });
  const beforeUncertain = await count();
  assert.equal((await send(uncertain, uncertainReplica)).status, 503);
  assert.equal(uncertainProxy.dropped(), true);
  await uncertainReplica('close');
  const resolved = await send(uncertain, b);
  assert.equal(resolved.status, 200);
  assert.equal(resolved.data.replayed, true);
  assert.deepEqual(await count(), {
    receipts: beforeUncertain.receipts + 1,
    audits: beforeUncertain.audits + 1,
  });
  // Tenant authority alone changing must fence an otherwise draft/row-current save.
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    'UPDATE public.tenants SET authority_version=authority_version+1 WHERE id=$1',
    [id],
  );
  const authorityRace = send(
    attempt(current, 'name', { displayName: 'Stale tenant authority' }),
  );
  try {
    await barrier('%public.tenants%FOR UPDATE');
  } finally {
    await owner.query('COMMIT');
  }
  const authorityDenied = await authorityRace;
  assert.equal(authorityDenied.status, 409);
  assert.equal(authorityDenied.data.reason, 'version_conflict');
  // A held status transition wins before the tenant lock; no stale-eligibility commit.
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    "UPDATE public.tenants SET status='active',version=version+1,authority_version=authority_version+1 WHERE id=$1",
    [id],
  );
  const blocked = send(attempt(current, 'contacts', { name: 'Denied status' }));
  try {
    await barrier('%public.tenants%FOR UPDATE');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await blocked).status, 409);
  for (const status of ['active', 'suspended', 'retired']) {
    await owner.query('UPDATE public.tenants SET status=$2 WHERE id=$1', [
      id,
      status,
    ]);
    const denied = await send(
      attempt(await read(), 'name', { displayName: 'denied' }),
    );
    assert.equal(denied.status, 409);
    assert.equal(denied.data.reason, 'eligibility_conflict');
  }
  const staleOperator = await operator(a);
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    "UPDATE public.platform_operators SET status='disabled',authentication_version=authentication_version+1 WHERE id=$1",
    [staleOperator.record.identityId],
  );
  const denied = send(
    attempt(current, 'name', { displayName: 'forged' }),
    a,
    staleOperator,
  );
  try {
    await barrier('%public.platform_operators%FOR SHARE');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await denied).status, 403);
  for (const headers of [
    { 'x-platform-csrf': 'bad' },
    { origin: 'https://foreign.invalid' },
    { 'x-platform-proxy': 'bad' },
  ])
    assert.equal(
      (
        await send(
          attempt(current, 'name', { displayName: 'denied' }),
          a,
          session,
          { headers },
        )
      ).status,
      403,
    );
  const receipts = (
    await runtime.query(
      'SELECT * FROM public.tenant_edit_receipts WHERE tenant_id=$1',
      [id],
    )
  ).rows;
  const audits = (
    await runtime.query(
      'SELECT * FROM public.audit_events WHERE target_reference=$1',
      [id],
    )
  ).rows;
  for (const marker of [
    'Lost response desk',
    'desk@example.org',
    '+63 (2) 123-4567',
  ]) {
    assert.ok(!JSON.stringify(receipts).includes(marker));
    assert.ok(!JSON.stringify(audits).includes(marker));
  }
  assert.ok(
    audits.every((r) => r.actor_reference === session.record.identityId),
  );
  await assert.rejects(
    runtime.query(
      'UPDATE public.tenant_edit_receipts SET version=version+1 WHERE tenant_id=$1',
      [id],
    ),
  );
  console.log(
    'PASS onboarding API: literal/Unicode search, lifecycle filters and A/B filtered UUID pagination, versioned sections, omitted/clear contacts, A/B races/replay/foreign adoption, later canonical state, lost response, grant rollback, status/authority races and forgery denial',
  );
}
