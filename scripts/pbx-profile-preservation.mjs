// Sanitized before/after evidence; SQL and native reads only, no protected archives.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const [action, input, output] = process.argv.slice(2);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
if (action === '--database') {
  const request = JSON.parse(input);
  if (
    !uuid.test(request.nodeId) ||
    request.artifactIds?.some((id) => !uuid.test(id))
  )
    throw new Error('Exact preservation target required');
  const load = createRequire(
    new URL('../services/backend/package.json', import.meta.url),
  );
  const { Client } = load('pg');
  const url = new URL(process.env.MIGRATION_DATABASE_URL);
  url.password = readFileSync(
    process.env.MIGRATION_DATABASE_PASSWORD_FILE,
    'utf8',
  ).trim();
  const client = new Client({
    connectionString: url.href,
    statement_timeout: 15000,
  });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const artifactIds =
      request.artifactIds ??
      (
        await client.query(
          'SELECT id FROM public.pbx_live_artifacts WHERE node_id=$1 ORDER BY id',
          [request.nodeId],
        )
      ).rows.map((r) => r.id);
    const excluded = [
      '_prisma_migrations',
      'audit_events',
      'outbox_work',
      'pbx_observations',
      'pbx_ownership',
      'pbx_live_runtime',
      'tenant_runtime_proofs',
      'pbx_static_profiles',
      'pbx_profile_operations',
      'pbx_profile_progress',
      'pbx_artifact_profiles',
      'pbx_profile_artifact_bindings',
    ];
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows
      .map((r) => r.tablename)
      .filter((n) => !excluded.includes(n));
    const hashes = {};
    for (const table of tables) {
      if (!/^[a-z_][a-z0-9_]*$/.test(table))
        throw new Error('Unexpected table');
      const artifacts = table === 'pbx_live_artifacts';
      hashes[table] = (
        await client.query(
          `SELECT count(*)::text AS rows,encode(sha256(convert_to(coalesce(jsonb_agg(${artifacts ? "to_jsonb(t)-'profile_operation_id'" : 'to_jsonb(t)'} ORDER BY to_jsonb(t)::text)::text,'[]'),'UTF8')),'hex') AS sha256 FROM public."${table}" t ${artifacts ? 'WHERE id=ANY($1::uuid[])' : ''}`,
          artifacts ? [artifactIds] : [],
        )
      ).rows[0];
    }
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        nodeId: request.nodeId,
        artifactIds,
        hashes,
        excludedVolatileOrTransitionTables: excluded,
      }),
    );
  } finally {
    await client.end();
  }
} else {
  if (!['before', 'after'].includes(action) || !output)
    throw new Error(
      'Use preservation before NODE_UUID OUTPUT.json | after BEFORE.json OUTPUT.json',
    );
  const before =
    action === 'after' ? JSON.parse(readFileSync(input, 'utf8')) : null;
  const nodeId = before?.nodeId ?? input;
  if (!uuid.test(nodeId)) throw new Error('Exact preservation target required');
  function docker(args, source) {
    const r = spawnSync('docker', args, {
      input: source,
      encoding: 'utf8',
      timeout: 180000,
      maxBuffer: 2097152,
    });
    if (r.status !== 0) throw new Error('Preservation inspection unavailable');
    return JSON.parse(r.stdout);
  }
  const sql = docker([
    'exec',
    '--user',
    'node',
    'myims-rebuild-dev-workspace-1',
    'node',
    '/workspace/scripts/pbx-profile-preservation.mjs',
    '--database',
    JSON.stringify({ nodeId, artifactIds: before?.sql.artifactIds }),
  ]);
  const native = docker(
    [
      'exec',
      '-i',
      '--user',
      '0',
      'myims-rebuild-dev-asterisk-1',
      'node',
      '--input-type=module',
      '-',
      JSON.stringify({ nodeId, artifactIds: sql.artifactIds }),
    ],
    `
    import fs from 'node:fs'; import {createHash} from 'node:crypto';
    const v=JSON.parse(process.argv[2]);const c=JSON.parse(fs.readFileSync('/run/pbx-live-native/configuration.json','utf8'));if(c.nodeId!==v.nodeId)throw Error();
    const root='/var/lib/myims-pbx/control/'+v.nodeId;
    const paths=['/etc/asterisk',root+'/initial-baseline',root+'/baseline-facts.json',...v.artifactIds.flatMap(id=>[root+'/plans/'+id+'.json',root+'/staging/'+id])];
    function snapshot(path,entries=[]) { const s=fs.lstatSync(path);if(s.isSymbolicLink())throw Error();entries.push({path,uid:s.uid,gid:s.gid,mode:s.mode,nlink:s.nlink,sha256:s.isFile()?createHash('sha256').update(fs.readFileSync(path)).digest('hex'):null});if(s.isDirectory())for(const name of fs.readdirSync(path).sort())snapshot(path+'/'+name,entries);return entries; }
    const boundary=JSON.parse(fs.readFileSync(root+'/boundary.json','utf8'));
    console.log(JSON.stringify({files:paths.flatMap(p=>snapshot(p)),sequence:boundary.sequence,receiptsSha256:createHash('sha256').update(JSON.stringify(boundary.receipts)).digest('hex')}));
  `,
  );
  const directory = new URL('../reference/asterisk_config/', import.meta.url);
  const reference = readdirSync(directory)
    .sort()
    .map((name) => ({
      name,
      sha256: createHash('sha256')
        .update(readFileSync(new URL(name, directory)))
        .digest('hex'),
    }));
  const result = { nodeId, sql, native, reference };
  if (
    before &&
    JSON.stringify(result) !==
      JSON.stringify({
        nodeId: before.nodeId,
        sql: before.sql,
        native: before.native,
        reference: before.reference,
      })
  )
    throw new Error('Retained history or unrelated data changed');
  writeFileSync(
    output,
    JSON.stringify({ ...result, preservationVerified: !!before }, null, 2) +
      '\n',
  );
  console.log(
    JSON.stringify({
      preservation: action,
      passed: true,
      unrelatedTables: Object.keys(sql.hashes).length,
      originalArtifacts: sql.artifactIds.length,
    }),
  );
}
