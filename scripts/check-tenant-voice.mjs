import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkTenantVoice({
  owner,
  runtime,
  redis,
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
  await redis.del('myims:limiter:v1:platform.protected');
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
  const attempt = (detail, value = 'enabled') => ({
    requestId: randomUUID(),
    expectedVersion: detail.tenant.version,
    expectedAuthorityVersion: detail.tenant.authorityVersion,
    section: 'voice',
    values: { voicePreference: value },
  });
  const counts = async () =>
    (
      await owner.query(
        `SELECT (SELECT count(*)::int FROM public.tenant_edit_receipts WHERE tenant_id=$1) receipts,(SELECT count(*)::int FROM public.audit_events WHERE target_reference=$1::text) audits`,
        [id],
      )
    ).rows[0];
  assert.equal(created.data.tenant.voicePreference, 'not_configured');
  const old = randomUUID();
  await owner.query(
    "INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,'Existing fixture','draft')",
    [old, `voice-existing-${old}`],
  );
  assert.equal(
    (await request(a, `/platform/tenants/${old}`, { session })).data.tenant
      .voicePreference,
    'not_configured',
  );
  const body = attempt(created.data);
  assert.equal((await request(a, path, { method: 'POST', body })).status, 401);
  assert.equal((await send(body, a, expired)).status, 401);
  assert.ok([401, 403].includes((await send(body, b, staffSession)).status));
  for (const call of [unavailableRedis, unavailableDatabase])
    assert.equal((await send(body, call)).status, 503);
  for (const headers of [
    { 'x-platform-csrf': 'bad' },
    { origin: 'https://foreign.invalid' },
    { 'x-platform-proxy': 'bad' },
  ])
    assert.equal((await send(body, a, session, { headers })).status, 403);
  for (const values of [
    {},
    { voicePreference: null },
    { voicePreference: 'not_configured' },
    { voicePreference: 'unknown' },
    { voicePreference: true },
    { voicePreference: 'enabled', status: 'active' },
    { voicePreference: 'disabled', ready: true },
    { voicePreference: 'enabled', pbxId: randomUUID() },
    { voicePreference: 'enabled', allocations: [] },
  ])
    assert.equal((await send({ ...body, values })).status, 400);
  for (const extra of [
    { status: 'active' },
    { readiness: true },
    { allocationId: randomUUID() },
    { pbxBinding: {} },
    { expectedGeographyVersion: 0 },
    { ownershipConfirmed: true },
  ])
    assert.equal((await send({ ...body, ...extra })).status, 400);
  const initialCounts = await counts();
  const both = await Promise.all([send(body, a), send(body, b)]);
  assert.ok(both.every((r) => r.status === 200));
  assert.equal(both.filter((r) => !r.data.replayed).length, 1);
  assert.deepEqual(await counts(), {
    receipts: initialCounts.receipts + 1,
    audits: initialCounts.audits + 1,
  });
  let current = await read();
  assert.equal(current.tenant.voicePreference, 'enabled');
  assert.equal(current.tenant.status, 'draft');
  for (const key of ['contacts', 'geography', 'tenantCode', 'authorityVersion'])
    assert.deepEqual(current.tenant[key], created.data.tenant[key]);
  assert.deepEqual(current.administrator, created.data.administrator);
  assert.equal((await send(body, b, foreign)).status, 409);
  assert.equal(
    (await send({ ...body, values: { voicePreference: 'disabled' } })).status,
    409,
  );
  assert.equal((await send(attempt(created.data, 'disabled'))).status, 409);
  const race = await Promise.all([
    send(attempt(current, 'disabled'), a),
    send(attempt(current, 'enabled'), b),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  current = await read();
  const contact = {
    ...attempt(current),
    section: 'contacts',
    values: { name: 'Voice preserved desk' },
  };
  const cross = await Promise.all([
    send(attempt(current, 'disabled'), a),
    send(contact, b),
  ]);
  assert.deepEqual(cross.map((r) => r.status).sort(), [200, 409]);
  current = await read();
  assert.equal(
    (
      await send({
        ...contact,
        requestId: randomUUID(),
        expectedVersion: current.tenant.version,
      })
    ).status,
    200,
  );
  for (const [revoke, grant] of [
    [
      'REVOKE UPDATE(voice_preference) ON public.tenants FROM myims_runtime',
      'GRANT UPDATE(voice_preference) ON public.tenants TO myims_runtime',
    ],
    [
      'REVOKE INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events FROM myims_runtime',
      'GRANT INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events TO myims_runtime',
    ],
    [
      'REVOKE INSERT(request_id,operator_id,tenant_id,section,fingerprint,version,authority_version,correlation_id) ON public.tenant_edit_receipts FROM myims_runtime',
      'GRANT INSERT(request_id,operator_id,tenant_id,section,fingerprint,version,authority_version,correlation_id) ON public.tenant_edit_receipts TO myims_runtime',
    ],
  ]) {
    const before = await read(),
      n = await counts();
    await owner.query(revoke);
    try {
      assert.equal((await send(attempt(before, 'disabled'))).status, 503);
    } finally {
      await owner.query(grant);
    }
    assert.deepEqual(await read(), before);
    assert.deepEqual(await counts(), n);
  }
  const lost = attempt(await read(), 'disabled');
  assert.equal((await send(lost, a, session, { drop: true })).lost, true);
  const recovered = await send(lost, b);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.data.replayed, true);
  assert.equal(recovered.data.current.tenant.voicePreference, 'disabled');
  assert.equal(
    recovered.data.current.tenant.contacts.name,
    'Voice preserved desk',
  );
  const newer = attempt(await read(), 'enabled');
  assert.equal((await send(newer, b)).status, 200);
  const historical = await send(lost, b);
  assert.ok(
    historical.data.outcome.version < historical.data.current.tenant.version,
  );
  assert.equal(historical.data.current.tenant.voicePreference, 'enabled');
  const proxy = await commitProxy(/INSERT INTO public\.tenant_edit_receipts/),
    uncertainReplica = await replica({ runtimeUrl: proxy.url });
  const uncertain = attempt(await read(), 'disabled'),
    beforeUncertain = await counts();
  assert.equal((await send(uncertain, uncertainReplica)).status, 503);
  assert.equal(proxy.dropped(), true);
  await uncertainReplica('close');
  const resolved = await send(uncertain, b);
  assert.equal(resolved.status, 200);
  assert.equal(resolved.data.replayed, true);
  assert.deepEqual(await counts(), {
    receipts: beforeUncertain.receipts + 1,
    audits: beforeUncertain.audits + 1,
  });
  // The canonical tenant lock fences row, authority and lifecycle changes on replica B.
  for (const [sql, reason] of [
    ['version=version+1', 'version_conflict'],
    ['authority_version=authority_version+1', 'version_conflict'],
    [
      "status='active',version=version+1,authority_version=authority_version+1",
      'eligibility_conflict',
    ],
  ]) {
    current = await read();
    const n = await counts();
    await owner.query('BEGIN');
    await owner.query(`UPDATE public.tenants SET ${sql} WHERE id=$1`, [id]);
    const pending = send(attempt(current), b);
    try {
      await barrier('%public.tenants%FOR UPDATE');
    } finally {
      await owner.query('COMMIT');
    }
    const denied = await pending;
    assert.equal(denied.status, 409);
    assert.equal(denied.data.reason, reason);
    assert.deepEqual(await counts(), n);
  }
  for (const status of ['active', 'suspended', 'retired']) {
    await owner.query('UPDATE public.tenants SET status=$2 WHERE id=$1', [
      id,
      status,
    ]);
    assert.equal(
      (await send(attempt(await read()))).data.reason,
      'eligibility_conflict',
    );
  }
  await owner.query("UPDATE public.tenants SET status='draft' WHERE id=$1", [
    id,
  ]);
  const staleOperator = await operator(a);
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    "UPDATE public.platform_operators SET status='disabled',authentication_version=authentication_version+1 WHERE id=$1",
    [staleOperator.record.identityId],
  );
  const denied = send(attempt(current), a, staleOperator);
  try {
    await barrier('%public.platform_operators%FOR SHARE');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await denied).status, 403);
  await assert.rejects(
    runtime.query(
      "UPDATE public.tenants SET voice_preference='unknown' WHERE id=$1",
      [id],
    ),
  );
  await assert.rejects(
    runtime.query(
      "UPDATE public.tenant_edit_receipts SET section='contacts' WHERE tenant_id=$1",
      [id],
    ),
  );
  console.log(
    'PASS voice API: explicit defaults/choices, A/B races and preserved sections, atomic audit/receipt/grant rollback, response/COMMIT uncertainty, exact recovery and status/operator fencing',
  );
}
