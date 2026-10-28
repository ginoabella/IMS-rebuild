import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const {
  serviceAreaUpload,
  barangayUpload,
  geographyValues,
  GeographyInputError,
} = backend('@myims/contracts');
const load = (p) => backend(`./dist/${p}.js`);
export async function checkTenantGeography({
  appUrl,
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
  redis,
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
  const empty = { area: null, barangays: [], defaults: null };
  const polygon = (x = 0, y = 0, size = 10) => ({
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
        [x, y],
      ],
    ],
  });
  const area = (g) => ({ geometry: g, municipality: null });
  const attempt = (detail, values, more = {}) => ({
    requestId: randomUUID(),
    expectedVersion: detail.tenant.version,
    expectedAuthorityVersion: detail.tenant.authorityVersion,
    expectedGeographyVersion: detail.tenant.geography.version,
    section: 'geography',
    ownershipConfirmed: true,
    values,
    ...more,
  });
  const count = async () =>
    (
      await owner.query(
        `SELECT (SELECT count(*)::int FROM public.tenant_edit_receipts WHERE tenant_id=$1) receipts,(SELECT count(*)::int FROM public.audit_events WHERE target_reference=$1::text) audits`,
        [id],
      )
    ).rows[0];
  let current = await read();
  assert.deepEqual(current.tenant.geography, {
    ...empty,
    version: 0,
    srid: 4326,
  });
  const values = { ...empty, area: area(polygon()), defaults: [0, 0] };
  let body = attempt(current, values);
  assert.equal((await request(a, path, { method: 'POST', body })).status, 401);
  assert.equal((await send(body, a, expired)).status, 401);
  assert.ok([401, 403].includes((await send(body, a, staffSession)).status));
  assert.equal((await send(body, unavailableRedis)).status, 503);
  assert.equal((await send(body, unavailableDatabase)).status, 503);
  assert.equal(
    (await send({ ...body, ownershipConfirmed: false })).status,
    400,
  );
  const race = await Promise.all([send(body, a), send(body, b)]);
  assert.deepEqual(
    race.map((r) => r.status),
    [200, 200],
  );
  assert.equal(race.filter((r) => r.data.replayed).length, 1);
  current = await read();
  assert.deepEqual(current.tenant.geography, {
    ...values,
    version: 1,
    srid: 4326,
  });
  assert.deepEqual(await count(), { receipts: 1, audits: 2 }); // creation + one confirmed geography change
  assert.equal(current.administrator.id, created.data.administrator.id);
  assert.equal(current.tenant.tenantCode, created.data.tenant.tenantCode);
  assert.equal(
    current.tenant.authorityVersion,
    created.data.tenant.authorityVersion,
  );
  assert.equal((await send(body, b, foreign)).status, 409);
  assert.equal(
    (await send({ ...body, ownershipConfirmed: false })).status,
    409,
  );
  assert.equal(
    (await send({ ...body, values: { ...values, defaults: [1, 1] } })).status,
    409,
  );
  assert.equal(
    (await send(attempt(current, values, { expectedGeographyVersion: 0 })))
      .status,
    409,
  );
  assert.equal((await send(attempt(created.data, values))).status, 409);
  for (const v of [
    { ...empty, defaults: [0] },
    { ...empty, defaults: [181, 0] },
    { ...empty, defaults: [0, 91] },
    { ...empty, defaults: ['0', 0] },
    { ...values, area: area({ ...polygon(), crs: { name: 'EPSG:3857' } }) },
    { ...values, area: area({ type: 'Point', coordinates: [0, 0] }) },
    {
      ...values,
      area: area({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [0, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      }),
    },
    {
      ...values,
      area: area({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      }),
    },
    {
      ...values,
      area: area({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0, 1],
            [1, 0],
            [1, 1],
            [0, 0, 1],
          ],
        ],
      }),
    },
    { ...values, defaults: [11, 5] },
    {
      ...values,
      area: area({
        type: 'Polygon',
        coordinates: [
          [
            [179, 0],
            [-179, 0],
            [-179, 1],
            [179, 0],
          ],
        ],
      }),
    },
    {
      ...values,
      area: area({
        type: 'Polygon',
        coordinates: [Array.from({ length: 4097 }, () => [0, 0])],
      }),
    },
  ]) {
    const before = await read();
    assert.equal(
      (await send(attempt(before, v))).status,
      400,
      JSON.stringify(v).slice(0, 250),
    );
    assert.deepEqual(await read(), before);
  }
  const deeplyNested = JSON.stringify(attempt(current, empty)).replace(
    '"defaults":null',
    '"defaults":' + '['.repeat(10000) + '0' + ']'.repeat(10000),
  );
  assert.equal((await send(deeplyNested)).status, 400);
  // Non-finite JSON number is rejected as null after transport; in-process validator rejects Infinity/NaN directly.
  for (const n of [Infinity, NaN])
    assert.throws(
      () => geographyValues({ ...empty, defaults: [n, 0] }),
      GeographyInputError,
    );
  assert.equal(
    (await send(attempt(current, { ...empty, defaults: [Infinity, 0] })))
      .status,
    400,
  );
  await redis.del('myims:limiter:v1:platform.protected');
  // Coordinate extremes are valid when unbounded by a configured area. Axes are not swapped.
  for (const defaults of [
    [-180, -90],
    [180, 90],
    [0, 0],
    [0.001534354784326925, 0.0003835888371234568],
    [13, 123],
  ]) {
    const r = await send(attempt(await read(), { ...empty, defaults }));
    assert.equal(r.status, defaults[1] > 90 ? 400 : 200);
    if (r.status === 200)
      assert.deepEqual(r.data.current.tenant.geography.defaults, defaults);
  }
  const hole = {
    type: 'Polygon',
    coordinates: [
      polygon().coordinates[0],
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
        [3, 3],
      ],
    ],
  };
  for (const [defaults, status] of [
    [[0, 5], 200],
    [[3, 5], 200],
    [[5, 5], 400],
  ])
    assert.equal(
      (
        await send(
          attempt(await read(), { ...empty, area: area(hole), defaults }),
        )
      ).status,
      status,
    );
  const multi = {
    type: 'MultiPolygon',
    coordinates: [polygon().coordinates, polygon(20, 0, 5).coordinates],
  };
  assert.equal(
    (
      await send(
        attempt(await read(), {
          ...empty,
          area: area(multi),
          defaults: [22, 2],
        }),
      )
    ).status,
    200,
  );
  const municipality = {
    municipalityId: 'PHL.TEST',
    municipalityName: 'Test municipality',
  };
  const brgy = (id, g) => ({ id, name: id, municipality, geometry: g });
  const layers = {
    ...empty,
    area: area(polygon()),
    barangays: [brgy('west', polygon(0, 0, 5)), brgy('east', polygon(5, 0, 5))],
    defaults: [8, 8],
  };
  assert.equal((await send(attempt(await read(), layers))).status, 200); // shared boundary and gap accepted
  for (const barangays of [
    [brgy('a', polygon(0, 0, 6)), brgy('b', polygon(5, 0, 5))],
    [brgy('outside', polygon(9, 0, 2))],
    [brgy('same', polygon(0, 0, 2)), brgy('same', polygon(2, 0, 2))],
    [
      {
        ...brgy('a', polygon()),
        municipality: { ...municipality, municipalityId: 'different' },
      },
      brgy('b', polygon(0, 0, 1)),
    ],
  ])
    assert.equal(
      (await send(attempt(await read(), { ...layers, barangays }))).status,
      400,
    );
  assert.equal(
    (await send(attempt(await read(), { ...layers, area: null }))).status,
    400,
  );
  assert.equal(
    (
      await send(
        attempt(await read(), { ...layers, area: area(polygon(20, 20, 1)) }),
      )
    ).status,
    400,
  );
  const clear = await send(
    attempt(await read(), { ...empty, defaults: [0, 0] }),
  );
  assert.equal(clear.status, 200);
  const old = body;
  const recoveredOld = await send(old, b);
  assert.equal(recoveredOld.status, 200);
  assert.equal(recoveredOld.data.replayed, true);
  assert.equal(recoveredOld.data.current.tenant.geography.area, null);
  // Cross-section stale race and preservation of unrelated saved fields.
  current = await read();
  const contacts = {
    requestId: randomUUID(),
    expectedVersion: current.tenant.version,
    expectedAuthorityVersion: current.tenant.authorityVersion,
    section: 'contacts',
    values: { name: 'Geography preserved desk' },
  };
  const cross = await Promise.all([
    send(attempt(current, values), a),
    send(contacts, b),
  ]);
  assert.deepEqual(cross.map((r) => r.status).sort(), [200, 409]);
  if (cross[1].status === 409) {
    current = await read();
    assert.equal(
      (
        await send({
          ...contacts,
          requestId: randomUUID(),
          expectedVersion: current.tenant.version,
        })
      ).status,
      200,
    );
  }
  for (const [revoke, grant] of [
    [
      'REVOKE UPDATE(service_area) ON public.tenant_geography FROM myims_runtime',
      'GRANT UPDATE(service_area) ON public.tenant_geography TO myims_runtime',
    ],
    [
      'REVOKE INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events FROM myims_runtime',
      'GRANT INSERT(id,event_type,schema_version,actor_kind,actor_reference,identity_plane,actor_tenant_id,system_reason,target_type,target_reference,tenant_id,correlation_id,metadata) ON public.audit_events TO myims_runtime',
    ],
    [
      'REVOKE INSERT(geography_version) ON public.tenant_edit_receipts FROM myims_runtime',
      'GRANT INSERT(geography_version) ON public.tenant_edit_receipts TO myims_runtime',
    ],
  ]) {
    const before = await read(),
      counts = await count();
    await owner.query(revoke);
    try {
      assert.equal((await send(attempt(before, values))).status, 503);
    } finally {
      await owner.query(grant);
    }
    assert.deepEqual(await read(), before);
    assert.deepEqual(await count(), counts);
  }
  body = attempt(await read(), values);
  assert.equal((await send(body, a, session, { drop: true })).lost, true);
  assert.equal((await send(body, b)).data.replayed, true);
  const proxy = await commitProxy(/INSERT INTO public\.tenant_edit_receipts/),
    uncertainReplica = await replica({ runtimeUrl: proxy.url });
  body = attempt(await read(), { ...values, defaults: [1, 1] });
  assert.equal((await send(body, uncertainReplica)).status, 503);
  assert.equal(proxy.dropped(), true);
  await uncertainReplica('close');
  assert.equal((await send(body, b)).data.replayed, true);
  await redis.del('myims:limiter:v1:platform.protected');
  // Exercise the accepted position ceiling against PostGIS, not only the parser.
  const ring = Array.from({ length: 4095 }, (_, i) => [
    Math.cos((i * 2 * Math.PI) / 4095),
    Math.sin((i * 2 * Math.PI) / 4095),
  ]);
  ring.push(ring[0]);
  const maximum = await send(
    attempt(await read(), {
      ...empty,
      area: area({ type: 'Polygon', coordinates: [ring] }),
      defaults: [0, 0],
    }),
  );
  assert.equal(maximum.status, 200);
  assert.deepEqual(
    maximum.data.current.tenant.geography.area.geometry.coordinates[0],
    ring,
  );
  const maximumBarangays = Array.from({ length: 1000 }, (_, i) => {
    const x = (i % 32) * 0.2,
      y = Math.floor(i / 32) * 0.2;
    return brgy(`bounded-${i}`, {
      type: 'Polygon',
      coordinates: [
        [
          [x, y],
          [x + 0.1, y],
          [x, y + 0.1],
          [x, y],
        ],
      ],
    });
  });
  const maximumFeatures = await send(
    attempt(await read(), {
      ...empty,
      area: area(polygon()),
      barangays: maximumBarangays,
    }),
  );
  assert.equal(maximumFeatures.status, 200);
  assert.equal(
    maximumFeatures.data.current.tenant.geography.barangays.length,
    1000,
  );
  // Supplied files are parsed without repair and checked against actual approved PostGIS rules.
  const nagaArea = serviceAreaUpload(
    JSON.parse(
      readFileSync(
        new URL('../reference/map/naga_admin_ADM_ADM_3.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const nagaBarangays = barangayUpload(
    JSON.parse(
      readFileSync(
        new URL('../reference/map/naga_brgy_ADM_ADM_3.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  assert.equal(nagaBarangays.length, 27);
  const naga = await send(
    attempt(await read(), {
      area: nagaArea,
      barangays: nagaBarangays,
      defaults: null,
    }),
  );
  assert.equal(
    naga.status,
    200,
    `Naga prepared files: ${JSON.stringify(naga.data)}`,
  );
  assert.deepEqual((await read()).tenant.geography.barangays, nagaBarangays);
  assert.deepEqual((await read()).tenant.geography.area, nagaArea);
  // Real geometry types/SRID and runtime database constraints, not only DTO fixtures.
  const stored = (
    await runtime.query(
      'SELECT ST_SRID(service_area) srid,GeometryType(service_area) type,ST_NumGeometries(barangays) count FROM public.tenant_geography WHERE tenant_id=$1',
      [id],
    )
  ).rows[0];
  assert.deepEqual(stored, { srid: 4326, type: 'POLYGON', count: 27 });
  await assert.rejects(
    runtime.query(
      'UPDATE public.tenant_geography SET default_point=ST_SetSRID(ST_MakePoint($2,$3),4326) WHERE tenant_id=$1',
      [id, 0, 91],
    ),
    (error) =>
      error.code === '23514' &&
      error.constraint === 'tenant_geography_valid' &&
      error.message === 'Invalid tenant geography' &&
      error.detail === undefined,
  );
  await assert.rejects(
    runtime.query('DELETE FROM public.tenant_geography WHERE tenant_id=$1', [
      id,
    ]),
  );
  const audit = (
    await runtime.query(
      "SELECT metadata FROM public.audit_events WHERE target_reference=$1 AND event_type='locations.configuration.changed'",
      [id],
    )
  ).rows;
  assert.ok(
    audit.some(
      (r) => r.metadata.change === 'geography_upload_ownership_confirmed',
    ),
  );
  assert.ok(!JSON.stringify(audit).includes('Naga'));
  assert.ok(!JSON.stringify(audit).includes('coordinates'));
  // Canonical intake consumer uses trusted staff principal and owner ports in one snapshot.
  const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
  const { TenantGeographyRepository } = load(
    'modules/locations/adapters/db/tenant-geography',
  );
  const { IntakeGeography } = load(
    'modules/locations/application/intake-geography',
  );
  const { StaffAuthorityRepository } = load(
    'modules/identity/adapters/db/authority-read',
  );
  const { TenantAdmissionRepository } = load(
    'modules/tenancy/adapters/db/admission-read',
  );
  const { TenantRepository } = load(
    'modules/tenancy/adapters/db/tenant-repository',
  );
  const db = new SnapshotDatabase(appUrl);
  try {
    const port = new IntakeGeography(
      db,
      new TenantGeographyRepository(),
      new StaffAuthorityRepository(db, new TenantAdmissionRepository()),
      new TenantRepository(),
    );
    assert.equal((await port.read({ plane: 'platform' }, id)).kind, 'denied');
    const staffId = created.data.administrator.id;
    await owner.query(
      "UPDATE public.staff_users SET roles=ARRAY['call_taker'],credential_state='ready',password_hash='geography-fixture',credential_changed_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",
      [id, staffId],
    );
    await owner.query(
      "UPDATE public.tenants SET status='active',authority_version=authority_version+1,version=version+1 WHERE id=$1",
      [id],
    );
    current = await read();
    const principal = {
      plane: 'tenant',
      tenantId: id,
      staffId,
      authenticationVersion: 1,
      tenantAuthorityVersion: current.tenant.authorityVersion,
      roles: ['call_taker'],
      grants: ['incident.create'],
    };
    const intake = await port.read(principal, id);
    assert.equal(intake.kind, 'found');
    assert.deepEqual(intake.geography.area, nagaArea);
    assert.equal(intake.geography.srid, 4326);
    assert.equal((await port.read(principal, randomUUID())).kind, 'denied');
    assert.equal(
      (await port.read({ ...principal, staffId: randomUUID() }, id)).kind,
      'denied',
    );
    assert.equal(
      (await port.read({ ...principal, tenantAuthorityVersion: 1 }, id)).kind,
      'denied',
    );
    await owner.query(
      'REVOKE SELECT ON public.tenant_geography FROM myims_runtime',
    );
    try {
      assert.equal((await port.read(principal, id)).kind, 'unavailable');
    } finally {
      await owner.query(
        'GRANT SELECT ON public.tenant_geography TO myims_runtime',
      );
    }
    await owner.query("UPDATE public.tenants SET status='draft' WHERE id=$1", [
      id,
    ]);
    assert.equal((await send(attempt(await read(), empty))).status, 200);
    await owner.query("UPDATE public.tenants SET status='active' WHERE id=$1", [
      id,
    ]);
    const cleared = await port.read(principal, id);
    assert.equal(cleared.kind, 'found');
    assert.equal(cleared.geography.area, null);
    assert.equal(cleared.geography.defaults, null);
    assert.ok(cleared.geography.version > 0);
    const virgin = await post(a, session, data());
    assert.equal(virgin.status, 201);
    await owner.query("UPDATE public.tenants SET status='active' WHERE id=$1", [
      virgin.data.tenant.id,
    ]);
    await owner.query(
      "UPDATE public.staff_users SET roles=ARRAY['call_taker'],credential_state='ready',password_hash='geography-fixture',credential_changed_at=clock_timestamp() WHERE id=$1",
      [virgin.data.administrator.id],
    );
    const missing = await port.read(
      {
        ...principal,
        tenantId: virgin.data.tenant.id,
        staffId: virgin.data.administrator.id,
        tenantAuthorityVersion: 1,
      },
      virgin.data.tenant.id,
    );
    assert.equal(missing.kind, 'found');
    assert.deepEqual(missing.geography, {
      area: null,
      defaults: null,
      version: 0,
      srid: 4326,
    });
    await owner.query(
      "UPDATE public.staff_users SET roles=ARRAY['tenant_admin'] WHERE id=$1",
      [staffId],
    );
    assert.equal((await port.read(principal, id)).kind, 'denied');
  } finally {
    await db.close();
  }
  await owner.query("UPDATE public.tenants SET status='draft' WHERE id=$1", [
    id,
  ]);
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    'UPDATE public.tenants SET authority_version=authority_version+1 WHERE id=$1',
    [id],
  );
  const staleAuthority = send(attempt(current, empty));
  try {
    await barrier('%public.tenants%FOR UPDATE');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await staleAuthority).status, 409);
  const staleOperator = await operator(a);
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    "UPDATE public.platform_operators SET status='disabled',authentication_version=authentication_version+1 WHERE id=$1",
    [staleOperator.record.identityId],
  );
  const revoked = send(attempt(current, empty), a, staleOperator);
  try {
    await barrier('%public.platform_operators%FOR SHARE');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await revoked).status, 403);
  // Held lifecycle/authority changes fence geography saves before tenant owner lock.
  await redis.del('myims:limiter:v1:platform.protected');
  for (const status of ['active', 'suspended', 'retired']) {
    await owner.query('UPDATE public.tenants SET status=$2 WHERE id=$1', [
      id,
      status,
    ]);
    assert.equal((await send(attempt(await read(), empty))).status, 409);
  }
  await owner.query("UPDATE public.tenants SET status='draft' WHERE id=$1", [
    id,
  ]);
  current = await read();
  await owner.query('BEGIN');
  await owner.query(
    "UPDATE public.tenants SET status='active',version=version+1,authority_version=authority_version+1 WHERE id=$1",
    [id],
  );
  const pending = send(attempt(current, empty));
  try {
    await barrier('%public.tenants%FOR UPDATE');
  } finally {
    await owner.query('COMMIT');
  }
  assert.equal((await pending).status, 409);
  console.log(
    'PASS geography API/PostGIS: bounded prepared Naga uploads, topology/containment/holes/components/zero/extremes, confirmation, atomic versions/audit/receipts, A/B and cross-section races, rollback, lost/uncertain exact recovery, canonical qualified intake read and lifecycle fencing',
  );
}
