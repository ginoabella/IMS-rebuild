// Trusted workspace coordinator: owned isolated DB only, never retained PBX state.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Client } = load('pg');
const [action, name, details] = process.argv.slice(2);
if (
  !['prepare', 'cleanup', 'bind-material', 'bind-existing-material'].includes(
    action,
  ) ||
  !/^myims_session_[a-f0-9]{12}$/.test(name ?? '')
)
  throw new Error('Owned native fixture database required');
const url = new URL(process.env.MIGRATION_DATABASE_URL);
url.password = readFileSync(
  process.env.MIGRATION_DATABASE_PASSWORD_FILE,
  'utf8',
).trim();
const owner = new Client({ connectionString: url.href });
await owner.connect();
try {
  if (action === 'cleanup') {
    await owner.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
      [name],
    );
    await owner.query(`DROP DATABASE IF EXISTS "${name}"`);
    console.log(JSON.stringify({ state: 'fixture_removed', database: name }));
  } else if (
    action === 'bind-material' ||
    action === 'bind-existing-material'
  ) {
    const data = JSON.parse(details);
    if (
      [
        'nodeId',
        'installationId',
        'operatorId',
        ...(action === 'bind-material' ? ['credentialId'] : []),
      ].some(
        (key) =>
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
            data[key] ?? '',
          ),
      )
    )
      throw new Error('Owned fixture material references required');
    const fixtureUrl = new URL(url.href);
    fixtureUrl.pathname = '/' + name;
    const fixture = new Client({ connectionString: fixtureUrl.href });
    await fixture.connect();
    try {
      if (action === 'bind-existing-material') {
        // Copy only confirmed, available canonical identity/version metadata. No
        // provider access or material bytes occur in this trusted SQL coordinator.
        const credential = (
          await owner.query(
            `SELECT c.id,c.installation_id,c.purpose FROM public.sip_credentials c
           WHERE c.installation_id=$1 AND c.available AND c.purpose='outbound-digest'
           AND c.label='Owned acceptance ' || left(c.id::text,8)
           AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY[1,2]) wanted(version)
             WHERE NOT EXISTS(SELECT 1 FROM public.sip_credential_versions v
               JOIN public.sip_credential_imports i ON i.credential_id=v.credential_id
                 AND i.expected_version=v.material_version-1 AND i.state='confirmed'
               WHERE v.credential_id=c.id AND v.material_version=wanted.version AND v.available))
           ORDER BY c.id LIMIT 1`,
            [data.installationId],
          )
        ).rows[0];
        if (!credential)
          throw new Error(
            'Existing canonical two-version metadata unavailable',
          );
        const retained = (
          await owner.query(
            `SELECT v.material_version,v.confirmed_at,i.operation_id,i.expected_version
           FROM public.sip_credential_versions v JOIN public.sip_credential_imports i
           ON i.credential_id=v.credential_id AND i.expected_version=v.material_version-1
           WHERE v.credential_id=$1 AND v.material_version=ANY(ARRAY[1,2])
             AND v.available AND i.state='confirmed' ORDER BY v.material_version`,
            [credential.id],
          )
        ).rows;
        if (retained.length !== 2)
          throw new Error('Canonical retained metadata changed');
        data.credentialId = credential.id;
        await fixture.query(
          "INSERT INTO public.sip_credentials(id,installation_id,label,purpose) VALUES($1,$2,'Retained canonical read fixture',$3)",
          [credential.id, credential.installation_id, credential.purpose],
        );
        for (const version of retained) {
          await fixture.query(
            'INSERT INTO public.sip_credential_versions(credential_id,material_version,confirmed_at) VALUES($1,$2,$3)',
            [credential.id, version.material_version, version.confirmed_at],
          );
          await fixture.query(
            "INSERT INTO public.sip_credential_imports(operation_id,credential_id,expected_version,state) VALUES($1,$2,$3,'confirmed')",
            [version.operation_id, credential.id, version.expected_version],
          );
        }
      }
      const { SnapshotDatabase } = load(
        './dist/infrastructure/database/read-snapshot.js',
      );
      const { TransactionAuthority } = load(
        './dist/modules/identity/application/transaction-authority.js',
      );
      const { PlatformAuthorityRepository } = load(
        './dist/modules/platform/adapters/db/authority-read.js',
      );
      const { InventoryRuntime } = load(
        './dist/modules/telephony/adapters/db/inventory-runtime.js',
      );
      const runtimeUrl = new URL(process.env.DATABASE_URL);
      runtimeUrl.pathname = '/' + name;
      runtimeUrl.password = readFileSync(
        process.env.DATABASE_PASSWORD_FILE,
        'utf8',
      ).trim();
      const snapshot = new SnapshotDatabase(runtimeUrl.href);
      const http = new InventoryRuntime(
        runtimeUrl.href,
        new TransactionAuthority(
          { lockedById: async () => ({ kind: 'denied' }) },
          new PlatformAuthorityRepository(snapshot),
        ),
      );
      const principal = {
        plane: 'platform',
        operatorId: data.operatorId,
        authenticationVersion: 1,
        grants: ['platform_operator'],
      };
      const trunk = randomUUID();
      const settings = {
        host: '127.0.0.1',
        port: 5060,
        transport: 'udp',
        media: 'rtp',
        codecs: ['ulaw'],
        directMedia: false,
        rtpSymmetric: true,
        forceRport: true,
        authentication: 'outbound-digest',
        credential: { id: data.credentialId, version: 1 },
      };
      await fixture.query(
        'INSERT INTO public.sip_trunks(id,node_id,installation_id,name,direction,settings,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',
        [
          trunk,
          data.nodeId,
          data.installationId,
          'Owned live exact-version fixture',
          'both',
          settings,
          data.operatorId,
        ],
      );
      try {
        for (const version of [1, 2]) {
          if (version === 2)
            await fixture.query(
              "UPDATE public.sip_trunks SET settings=jsonb_set(settings,'{credential,version}','2'),version=version+1 WHERE id=$1",
              [trunk],
            );
          const captured = await http.revisions.write(
            principal,
            data.nodeId,
            null,
            { requestId: randomUUID() },
            randomUUID(),
          );
          if (captured.status !== 201)
            throw new Error('Canonical fixture capture failed');
        }
      } finally {
        await http.onApplicationShutdown();
        await snapshot.close();
      }
      console.log(
        JSON.stringify({
          state: 'canonical_material_fixture_bound',
          database: name,
          nodeId: data.nodeId,
        }),
      );
    } finally {
      await fixture.end();
    }
  } else {
    if (
      details &&
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(details)
    )
      throw new Error('Invalid owned fixture installation');
    await owner.query(`CREATE DATABASE "${name}"`);
    const migration = new URL(process.env.MIGRATION_DATABASE_URL);
    migration.pathname = '/' + name;
    const runtime = new URL(process.env.DATABASE_URL);
    runtime.pathname = '/' + name;
    const result = spawnSync(
      process.execPath,
      ['services/backend/dist/entrypoints/deployment/main.js', 'migrate'],
      {
        cwd: '/workspace',
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: migration.href,
          DATABASE_URL: runtime.href,
        },
        encoding: 'utf8',
        timeout: 60000,
      },
    );
    if (result.status !== 0)
      throw new Error(
        'Owned native fixture migration failed: ' + result.stderr.slice(-500),
      );
    const metadata = {
      database: name,
      nodeId: randomUUID(),
      installationId: details ?? randomUUID(),
      operatorId: randomUUID(),
    };
    const db = new URL(url.href);
    db.pathname = '/' + name;
    const fixture = new Client({ connectionString: db.href });
    await fixture.connect();
    try {
      await fixture.query(
        "INSERT INTO public.platform_operators(id,normalized_username,status,credential_state,password_hash,credential_changed_at) VALUES($1,$2,'active','ready','fixture',clock_timestamp())",
        [metadata.operatorId, 'live.' + metadata.operatorId],
      );
      await fixture.query(
        "INSERT INTO public.pbx_nodes(id,installation_id,display_name,target_alias,host,transport,port,tls_server_name,credential_alias,created_by,updated_by) VALUES($1,$2,'Native live fixture','native-fixture','native-fixture.invalid','ami-tls',5039,'native-fixture.invalid','native-fixture',$3,$3)",
        [metadata.nodeId, metadata.installationId, metadata.operatorId],
      );
      await fixture.query(
        'INSERT INTO public.pbx_observations(node_id,desired_version) VALUES($1,1)',
        [metadata.nodeId],
      );
      await fixture.query(
        'INSERT INTO public.pbx_ownership(node_id,desired_version) VALUES($1,1)',
        [metadata.nodeId],
      );
    } finally {
      await fixture.end();
    }
    console.log(JSON.stringify(metadata));
  }
} finally {
  await owner.end();
}
