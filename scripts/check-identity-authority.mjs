import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const load = (path) => backend(`./dist/${path}.js`);
const { SnapshotDatabase } = load('infrastructure/database/read-snapshot');
const { TenantAdmissionRepository } = load(
  'modules/tenancy/adapters/db/admission-read',
);
const { StaffAuthorityRepository } = load(
  'modules/identity/adapters/db/authority-read',
);
const { PlatformAuthorityRepository } = load(
  'modules/platform/adapters/db/authority-read',
);
const { StaffCredentialRepository } = load(
  'modules/identity/adapters/db/credential-read',
);
const { PlatformCredentialRepository } = load(
  'modules/platform/adapters/db/credential-read',
);
const { StaffAuthorityMutations } = load(
  'modules/identity/adapters/db/authority-mutations',
);
const { OperatorAuthorityMutations } = load(
  'modules/platform/adapters/db/authority-mutations',
);
const { TenantAuthorityMutations } = load(
  'modules/tenancy/adapters/db/authority-mutations',
);
const { StaffRepository } = load(
  'modules/identity/adapters/db/staff-repository',
);
const { canonicalRoles, permissions, incidentClosureGrant, staffRoles } = load(
  'modules/identity/domain/roles',
);
const { staffAuthority, platformAuthority } = load(
  'modules/identity/domain/authority',
);
function barrier() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
export async function checkAuthority({
  appUrl,
  owner,
  runtime,
  run,
  rejected,
  logs,
}) {
  const database = new SnapshotDatabase(appUrl.href);
  const tenants = new TenantAdmissionRepository();
  const staff = new StaffAuthorityRepository(database, tenants);
  const platform = new PlatformAuthorityRepository(database);
  const credentials = new StaffCredentialRepository(database);
  const platformCredentials = new PlatformCredentialRepository(database);
  const staffWrites = new StaffAuthorityMutations();
  const operatorWrites = new OperatorAuthorityMutations();
  const tenantWrites = new TenantAuthorityMutations();
  const staffStore = new StaffRepository();
  const snapshots = [];
  const hash = 'AUTHORITY_HASH_SENTINEL_Private:MiXeD';
  const username = 'authority_identity_sentinel';
  const tenantId = randomUUID(),
    otherTenant = randomUUID(),
    staffId = randomUUID(),
    otherStaff = randomUUID(),
    operatorId = randomUUID();
  const reference = { plane: 'tenant', tenantId, staffId };
  const opReference = { plane: 'platform', operatorId };
  const changedAt = new Date('2026-10-05T00:00:00Z');
  const staffChange = (expected, change, ref = reference) =>
    run('staff', ref.staffId, ref.tenantId, (tx) =>
      staffWrites.change(tx, ref, expected, change),
    );
  const opChange = (expected, change) =>
    run('operator', operatorId, null, (tx) =>
      operatorWrites.change(tx, opReference, expected, change),
    );
  const tenantChange = (expected, status) =>
    run('tenant', tenantId, null, (tx) =>
      tenantWrites.status(tx, { tenantId }, expected, status),
    );
  const read = async () => {
    const result = await staff.byId(reference);
    snapshots.push(result);
    return result;
  };
  const facts = async () =>
    (
      await runtime.query(
        'SELECT roles,status,credential_state,password_hash,credential_changed_at,version,authentication_version FROM public.staff_users WHERE id=$1',
        [staffId],
      )
    ).rows[0];
  const auditCount = async (id) =>
    Number(
      (
        await runtime.query(
          'SELECT count(*)::int AS n FROM public.audit_events WHERE target_reference=$1',
          [id],
        )
      ).rows[0].n,
    );
  let phase = 'pure role and admission rules';
  try {
    for (let mask = 1; mask < 16; mask++) {
      const roles = staffRoles.filter((_, bit) => (mask & (1 << bit)) !== 0);
      assert.deepEqual(canonicalRoles([...roles].reverse()), roles);
      assert.equal(incidentClosureGrant(roles, true), true);
      assert.equal(
        incidentClosureGrant(roles, false),
        roles.includes('dispatcher'),
      );
      assert.ok(permissions(roles).includes('incident.own.close'));
    }
    for (const roles of [
      [],
      ['unknown'],
      Array(1),
      ['platform_operator'],
      ['dispatcher', 'dispatcher'],
      null,
      [null],
    ]) {
      assert.equal(canonicalRoles(roles), null);
      assert.equal(incidentClosureGrant(roles, true), false);
    }
    assert.ok(!permissions(['tenant_admin']).includes('assignment.dispatch'));
    assert.ok(!permissions(['call_taker']).includes('incident.close'));
    const goodTenant = {
      id: tenantId,
      status: 'active',
      version: 1,
      authority_version: 1,
    };
    const goodStaff = {
      id: staffId,
      tenant_id: tenantId,
      status: 'active',
      credential_state: 'ready',
      credential_coherent: true,
      roles: ['call_taker'],
      version: 1,
      authentication_version: 1,
    };
    for (const value of [0, -1, NaN, 1.5, '1', 2147483648, null]) {
      assert.deepEqual(
        staffAuthority(
          { ...goodStaff, authentication_version: value },
          goodTenant,
        ),
        { kind: 'denied' },
      );
      assert.deepEqual(
        staffAuthority(goodStaff, { ...goodTenant, authority_version: value }),
        { kind: 'denied' },
      );
    }
    assert.deepEqual(
      staffAuthority({ ...goodStaff, credential_coherent: false }, goodTenant),
      { kind: 'denied' },
    );
    assert.deepEqual(
      platformAuthority({ ...goodStaff, authority: 'platform_operator' }),
      { kind: 'denied' },
    );
    phase = 'plane-qualified fixtures and matrix';
    for (const [id, code] of [
      [tenantId, 'authority.first'],
      [otherTenant, 'authority.second'],
    ])
      await runtime.query(
        'INSERT INTO public.tenants(id,normalized_code,display_name,status) VALUES($1,$2,$3,$4)',
        [id, code, 'Authority fixture', 'active'],
      );
    for (const [id, tenant] of [
      [staffId, tenantId],
      [otherStaff, otherTenant],
    ]) {
      const result = await run('staff', id, tenant, (tx) =>
        staffStore.create(tx, {
          plane: 'tenant',
          id,
          tenantId: tenant,
          username,
          roles: ['call_taker'],
          status: 'active',
          credentialState: 'ready',
          passwordHash: hash,
          credentialChangedAt: changedAt,
        }),
      );
      assert.equal(result.kind, 'found');
    }
    await owner.query(
      'INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,$3,$4,$5,$6)',
      [operatorId, username, 'active', 'ready', hash, changedAt],
    );
    // Deliberately identical UUIDs in different stores remain plane-qualified.
    await owner.query(
      'INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,$3,$4,$5,$6)',
      [staffId, 'authority.same.uuid', 'active', 'ready', hash, changedAt],
    );
    for (const [tenantCode, id] of [
      [' AUTHORITY.First ', staffId],
      ['authority.second', otherStaff],
    ]) {
      const result = await staff.candidate({
        plane: 'tenant',
        tenantCode,
        username: ` ${username.toUpperCase()} `,
      });
      assert.equal(result.snapshot.staffId, id);
      snapshots.push(result);
    }
    assert.equal(
      (
        await platform.candidate({
          plane: 'platform',
          username: ` ${username.toUpperCase()} `,
        })
      ).snapshot.operatorId,
      operatorId,
    );
    assert.equal(
      (await platform.byId({ plane: 'platform', operatorId: staffId })).snapshot
        .operatorId,
      staffId,
    );
    for (const input of [
      { ...reference, plane: 'platform' },
      { ...reference, tenantId: otherTenant },
      { ...reference, staffId: operatorId },
      { ...reference, roles: ['dispatcher'] },
      { ...reference, staffId: randomUUID() },
    ])
      assert.deepEqual(await staff.byId(input), { kind: 'denied' });
    for (const input of [
      {
        plane: 'tenant',
        tenantCode: 'authority.first',
        username,
        tenantId: otherTenant,
      },
      {
        plane: 'tenant',
        tenantCode: 'authority.first',
        username,
        roles: ['dispatcher'],
      },
      { plane: 'platform', tenantCode: 'authority.first', username },
      { plane: 'tenant', tenantCode: 'missing', username },
    ])
      assert.deepEqual(await staff.candidate(input), { kind: 'denied' });
    for (const input of [
      { ...opReference, plane: 'tenant' },
      { ...opReference, tenantId },
      { ...opReference, operatorId: otherStaff },
      { ...opReference, authority: 'platform_operator' },
    ])
      assert.deepEqual(await platform.byId(input), { kind: 'denied' });
    assert.deepEqual(
      await credentials.read({ ...reference, tenantId: otherTenant }),
      { kind: 'denied' },
    );
    assert.equal(
      (await credentials.read(reference)).credential.passwordHash,
      hash,
    );
    assert.equal(
      (await platformCredentials.read(opReference)).credential.passwordHash,
      hash,
    );
    for (const roles of [
      [],
      ['unknown'],
      ['platform_operator'],
      ['dispatcher', 'dispatcher'],
      [null],
      ['call_taker', 'unknown'],
    ])
      await rejected(
        runtime,
        'UPDATE public.staff_users SET roles=$2 WHERE id=$1',
        [staffId, roles],
        '23514',
      );
    for (const tenantStatus of ['draft', 'active', 'suspended', 'retired']) {
      await runtime.query('UPDATE public.tenants SET status=$2 WHERE id=$1', [
        tenantId,
        tenantStatus,
      ]);
      for (const status of ['active', 'disabled'])
        for (const credential of ['ready', 'unset']) {
          await runtime.query(
            'UPDATE public.staff_users SET status=$2,credential_state=$3,password_hash=$4,credential_changed_at=$5 WHERE id=$1',
            [
              staffId,
              status,
              credential,
              credential === 'ready' ? hash : null,
              credential === 'ready' ? changedAt : null,
            ],
          );
          assert.equal(
            (await read()).kind,
            tenantStatus === 'active' &&
              status === 'active' &&
              credential === 'ready'
              ? 'eligible'
              : 'denied',
          );
          // Operator eligibility is independent of this tenant's lifecycle.
          assert.equal((await platform.byId(opReference)).kind, 'eligible');
        }
    }
    for (const status of ['active', 'disabled'])
      for (const credential of ['ready', 'unset']) {
        await runtime.query(
          'UPDATE public.platform_operators SET status=$2,credential_state=$3,password_hash=$4,credential_changed_at=$5 WHERE id=$1',
          [
            operatorId,
            status,
            credential,
            credential === 'ready' ? hash : null,
            credential === 'ready' ? changedAt : null,
          ],
        );
        assert.equal(
          (await platform.byId(opReference)).kind,
          status === 'active' && credential === 'ready' ? 'eligible' : 'denied',
        );
      }
    await runtime.query('UPDATE public.tenants SET status=$2 WHERE id=$1', [
      tenantId,
      'active',
    ]);
    await runtime.query(
      'UPDATE public.staff_users SET status=$2,credential_state=$3,password_hash=$4,credential_changed_at=$5 WHERE id=$1',
      [staffId, 'active', 'ready', hash, changedAt],
    );
    await runtime.query(
      'UPDATE public.platform_operators SET status=$2,credential_state=$3,password_hash=$4,credential_changed_at=$5 WHERE id=$1',
      [operatorId, 'active', 'ready', hash, changedAt],
    );
    // PostgreSQL accepts infinite timestamps; malformed ready metadata must deny.
    for (const [table, id, reader, verifier, ref] of [
      ['staff_users', staffId, staff, credentials, reference],
      [
        'platform_operators',
        operatorId,
        platform,
        platformCredentials,
        opReference,
      ],
    ]) {
      await owner.query(
        `UPDATE public.${table} SET credential_changed_at='infinity' WHERE id=$1`,
        [id],
      );
      assert.deepEqual(await reader.byId(ref), { kind: 'denied' });
      assert.deepEqual(await verifier.read(ref), { kind: 'denied' });
      await owner.query(
        `UPDATE public.${table} SET credential_changed_at=$2 WHERE id=$1`,
        [id, changedAt],
      );
    }
    // Trusted disposable-fixture injection; restore the exact migrated constraint.
    const rolesConstraint = (
      await owner.query(
        "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.staff_users'::regclass AND conname='staff_roles_valid'",
      )
    ).rows[0].definition;
    await owner.query(
      'ALTER TABLE public.staff_users DROP CONSTRAINT staff_roles_valid',
    );
    await owner.query('UPDATE public.staff_users SET roles=$2 WHERE id=$1', [
      staffId,
      ['call_taker', 'unknown'],
    ]);
    assert.deepEqual(await read(), { kind: 'denied' });
    await owner.query('UPDATE public.staff_users SET roles=$2 WHERE id=$1', [
      staffId,
      ['call_taker'],
    ]);
    await owner.query(
      `ALTER TABLE public.staff_users ADD CONSTRAINT staff_roles_valid ${rolesConstraint}`,
    );
    console.log(
      'PASS: approved role/creator grants; plane-qualified same-name/UUID fixtures; 16 staff and four operator eligibility combinations; invalid roles deny',
    );
    phase = 'atomic mutations and audit';
    let version = 1;
    for (const change of [
      { kind: 'roles', roles: ['dispatcher', 'call_taker'] },
      { kind: 'status', status: 'disabled' },
      { kind: 'status', status: 'active' },
      {
        kind: 'credential',
        credentialState: 'unset',
        passwordHash: null,
        credentialChangedAt: null,
      },
      {
        kind: 'credential',
        credentialState: 'ready',
        passwordHash: hash,
        credentialChangedAt: changedAt,
      },
      {
        kind: 'credential',
        credentialState: 'ready',
        passwordHash: hash + 'Replacement',
        credentialChangedAt: new Date(changedAt.getTime() + 1000),
      },
    ]) {
      const count = await auditCount(staffId);
      const result = await staffChange(version, change);
      assert.equal(result.kind, 'found');
      version++;
      assert.equal(result.value.version, version);
      assert.equal(result.value.authentication_version, version);
      assert.equal(await auditCount(staffId), count + 1);
      const noop = await staffChange(version, change);
      assert.equal(noop.value.version, version);
      assert.equal(await auditCount(staffId), count + 1);
      assert.deepEqual(await staffChange(version - 1, change), {
        kind: 'stale',
      });
      const row = await facts();
      assert.equal(row.version, version);
      assert.equal(row.authentication_version, version);
    }
    const before = await facts(),
      beforeAudit = await auditCount(staffId);
    for (const change of [
      { kind: 'roles', roles: [] },
      { kind: 'roles', roles: ['platform_operator'] },
      { kind: 'status', status: 'unknown' },
      {
        kind: 'credential',
        credentialState: 'ready',
        passwordHash: hash,
        credentialChangedAt: null,
      },
    ])
      assert.deepEqual(await staffChange(version, change), { kind: 'invalid' });
    assert.deepEqual(await facts(), before);
    assert.equal(await auditCount(staffId), beforeAudit);
    assert.deepEqual(
      await run('staff', staffId, otherTenant, (tx) =>
        staffWrites.change(tx, reference, version, {
          kind: 'status',
          status: 'disabled',
        }),
      ),
      { kind: 'invalid' },
    );
    assert.deepEqual(
      await staffChange(
        version,
        { kind: 'status', status: 'disabled' },
        { ...reference, tenantId: otherTenant },
      ),
      { kind: 'missing' },
    );
    // Every changed-fact category is rolled back if its required audit fails.
    await owner.query(
      `ALTER TABLE public.audit_events ADD CONSTRAINT authority_fixture_failure CHECK (target_reference <> '${staffId}') NOT VALID`,
    );
    try {
      for (const change of [
        { kind: 'roles', roles: ['responder'] },
        { kind: 'status', status: 'disabled' },
        {
          kind: 'credential',
          credentialState: 'unset',
          passwordHash: null,
          credentialChangedAt: null,
        },
      ]) {
        let outcome;
        await assert.rejects(
          run('staff', staffId, tenantId, async (tx) => {
            outcome = await staffWrites.change(tx, reference, version, change);
          }),
        );
        assert.deepEqual(outcome, { kind: 'invalid' });
        assert.deepEqual(await facts(), before);
        assert.equal(await auditCount(staffId), beforeAudit);
      }
    } finally {
      await owner.query(
        'ALTER TABLE public.audit_events DROP CONSTRAINT authority_fixture_failure',
      );
    }
    let opVersion = 1;
    for (const change of [
      { kind: 'status', status: 'disabled' },
      { kind: 'status', status: 'active' },
      {
        kind: 'credential',
        credentialState: 'unset',
        passwordHash: null,
        credentialChangedAt: null,
      },
      {
        kind: 'credential',
        credentialState: 'ready',
        passwordHash: hash,
        credentialChangedAt: changedAt,
      },
    ]) {
      const result = await opChange(opVersion, change);
      assert.equal(result.kind, 'found');
      opVersion++;
      assert.equal(result.value.authentication_version, opVersion);
      assert.equal(
        (await opChange(opVersion, change)).value.version,
        opVersion,
      );
      assert.deepEqual(await opChange(opVersion - 1, change), {
        kind: 'stale',
      });
    }
    assert.deepEqual(
      await opChange(opVersion, { kind: 'roles', roles: ['dispatcher'] }),
      { kind: 'invalid' },
    );
    const oldTenant = await runtime.query(
      'SELECT * FROM public.tenants WHERE id=$1',
      [tenantId],
    );
    const tenantAudit = await auditCount(tenantId);
    await owner.query(
      `ALTER TABLE public.audit_events ADD CONSTRAINT authority_fixture_failure CHECK (target_reference NOT IN ('${tenantId}','${operatorId}')) NOT VALID`,
    );
    try {
      await assert.rejects(tenantChange(1, 'suspended'));
      await assert.rejects(
        opChange(opVersion, { kind: 'status', status: 'disabled' }),
      );
    } finally {
      await owner.query(
        'ALTER TABLE public.audit_events DROP CONSTRAINT authority_fixture_failure',
      );
    }
    assert.deepEqual(
      (
        await runtime.query('SELECT * FROM public.tenants WHERE id=$1', [
          tenantId,
        ])
      ).rows,
      oldTenant.rows,
    );
    assert.equal(await auditCount(tenantId), tenantAudit);
    assert.equal(
      (await platform.byId(opReference)).snapshot.authenticationVersion,
      opVersion,
    );
    console.log(
      'PASS: role/status/credential and operator mutations advance versions with audit; no-op/stale/invalid/foreign writes and forced audit failures preserve facts',
    );
    phase = 'coherent independent read and suspend/reactivate';
    const beforeSnapshot = await read();
    const loaded = barrier(),
      resume = barrier();
    const pausedStaff = new StaffAuthorityRepository(database, {
      byId: async (snapshot, id) => {
        const value = await tenants.byId(snapshot, id);
        loaded.release();
        await resume.promise;
        return value;
      },
      byCode: (snapshot, code) => tenants.byCode(snapshot, code),
    });
    const pending = pausedStaff.byId(reference);
    await loaded.promise;
    try {
      assert.equal(
        (await staffChange(version, { kind: 'roles', roles: ['responder'] }))
          .kind,
        'found',
      );
      version++;
      assert.equal(
        (await tenantChange(1, 'suspended')).value.authority_version,
        2,
      );
    } finally {
      resume.release();
    }
    assert.deepEqual(await pending, beforeSnapshot);
    assert.deepEqual(await read(), { kind: 'denied' });
    const reactivate = await tenantChange(2, 'active');
    assert.equal(reactivate.value.authority_version, 3);
    const current = await read();
    assert.equal(current.snapshot.authenticationVersion, version);
    assert.deepEqual(current.snapshot.roles, ['responder']);
    assert.equal(current.snapshot.tenantAuthorityVersion, 3);
    assert.notEqual(
      current.snapshot.tenantAuthorityVersion,
      beforeSnapshot.snapshot.tenantAuthorityVersion,
    );
    const tenantEvents = await auditCount(tenantId);
    assert.equal((await tenantChange(3, 'active')).value.authority_version, 3);
    assert.equal(await auditCount(tenantId), tenantEvents);
    assert.deepEqual(await tenantChange(1, 'active'), { kind: 'stale' });
    phase = 'concurrent stale role restoration';
    const written = barrier(),
      commit = barrier(),
      contenderStarted = barrier();
    const winner = run('staff', staffId, tenantId, async (tx) => {
      const result = await staffWrites.change(tx, reference, version, {
        kind: 'roles',
        roles: ['call_taker'],
      });
      written.release();
      await commit.promise;
      return result;
    });
    await written.promise;
    let contenderPid;
    const contender = run('staff', staffId, tenantId, async (tx) => {
      contenderPid = (await tx.query('SELECT pg_backend_pid() AS pid')).rows[0]
        .pid;
      contenderStarted.release();
      return staffWrites.change(tx, reference, version, {
        kind: 'roles',
        roles: ['dispatcher'],
      });
    });
    try {
      await contenderStarted.promise;
      let blocked = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const state = await owner.query(
          'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',
          [contenderPid],
        );
        if (state.rows[0]?.wait_event_type === 'Lock') {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(blocked, 'role restore must wait on the winner lock');
      assert.deepEqual(
        await read(),
        current,
        'independent observer sees only committed authority',
      );
    } finally {
      commit.release();
    }
    const [won, lost] = await Promise.all([winner, contender]);
    assert.equal(won.kind, 'found');
    version++;
    assert.deepEqual(lost, { kind: 'stale' });
    assert.deepEqual((await read()).snapshot.roles, ['call_taker']);
    assert.equal((await read()).snapshot.authenticationVersion, version);
    console.log(
      'PASS: independent repeatable-read snapshot spans committed tenant/role changes; suspend/reactivate stales old authority; concurrent restore loses with typed conflict',
    );
    phase = 'exhaustion and canonical database interruption';
    const maxId = randomUUID();
    await run('staff', maxId, tenantId, (tx) =>
      staffStore.create(tx, {
        plane: 'tenant',
        id: maxId,
        tenantId,
        username: 'authority.max',
        roles: ['call_taker'],
        status: 'active',
        credentialState: 'ready',
        passwordHash: hash,
        credentialChangedAt: changedAt,
      }),
    );
    await owner.query(
      'UPDATE public.staff_users SET version=2147483647,authentication_version=2147483647 WHERE id=$1',
      [maxId],
    );
    const maxReference = { plane: 'tenant', tenantId, staffId: maxId };
    assert.equal((await staff.byId(maxReference)).kind, 'eligible');
    let exhausted;
    await assert.rejects(
      run('staff', maxId, tenantId, async (tx) => {
        exhausted = await staffWrites.change(tx, maxReference, 2147483647, {
          kind: 'status',
          status: 'disabled',
        });
      }),
    );
    assert.deepEqual(exhausted, { kind: 'unavailable' });
    const maxRow = (
      await runtime.query(
        'SELECT status,version,authentication_version FROM public.staff_users WHERE id=$1',
        [maxId],
      )
    ).rows[0];
    assert.deepEqual(maxRow, {
      status: 'active',
      version: 2147483647,
      authentication_version: 2147483647,
    });
    const interrupted = new StaffAuthorityRepository(database, {
      byId: async (snapshot, id) => {
        const value = await tenants.byId(snapshot, id);
        const pid = (await snapshot.query('SELECT pg_backend_pid() AS pid'))
          .rows[0].pid;
        await owner.query('SELECT pg_terminate_backend($1)', [pid]);
        return value;
      },
      byCode: (snapshot, code) => tenants.byCode(snapshot, code),
    });
    assert.deepEqual(await interrupted.byId(reference), {
      kind: 'unavailable',
    });
    assert.equal((await read()).kind, 'eligible');
    const bounded = new StaffAuthorityRepository(database, {
      byId: async (snapshot) => {
        await snapshot.query('SELECT pg_sleep(5)');
        return goodTenant;
      },
      byCode: (snapshot, code) => tenants.byCode(snapshot, code),
    });
    const start = Date.now();
    assert.deepEqual(await bounded.byId(reference), { kind: 'unavailable' });
    assert.ok(
      Date.now() - start < 4000,
      'statement timeout must bound authority loading',
    );
    const badUrl = new URL(appUrl);
    badUrl.port = '1';
    const offline = new SnapshotDatabase(badUrl.href);
    try {
      assert.deepEqual(
        await new PlatformAuthorityRepository(offline).byId(opReference),
        { kind: 'unavailable' },
      );
      assert.deepEqual(
        await new StaffAuthorityRepository(offline, tenants).byId(reference),
        { kind: 'unavailable' },
      );
    } finally {
      await offline.close();
    }
    phase = 'audit allowlists and sentinel exclusion';
    const audit = (
      await runtime.query(
        "SELECT event_type,metadata FROM public.audit_events WHERE event_type LIKE '%.authority.%.changed'",
      )
    ).rows;
    assert.ok(audit.length > 10);
    for (const row of audit) {
      assert.deepEqual(
        Object.keys(row.metadata).sort(),
        [
          'oldCode',
          'newCode',
          'oldRowVersion',
          'newRowVersion',
          'oldAuthorityVersion',
          'newAuthorityVersion',
        ].sort(),
      );
      assert.equal(row.metadata.newRowVersion, row.metadata.oldRowVersion + 1);
      assert.equal(
        row.metadata.newAuthorityVersion,
        row.metadata.oldAuthorityVersion + 1,
      );
    }
    snapshots.push(await platform.byId(opReference));
    const exported =
      JSON.stringify(snapshots) + JSON.stringify(audit) + logs.join('\n');
    for (const sentinel of [
      hash,
      username,
      'password_hash',
      'normalized_username',
    ])
      assert.ok(!exported.includes(sentinel));
    assert.ok(!('tenantId' in snapshots.at(-1).snapshot));
    console.log(
      'PASS: integer exhaustion rolls back; real connection interruption and bounded SQL timeout fail unavailable; recovery, audit allowlists and credential/identity sentinels verified',
    );
  } catch (error) {
    throw new Error(`Authority acceptance failed during ${phase}`, {
      cause: error,
    });
  } finally {
    await database.close();
  }
}
