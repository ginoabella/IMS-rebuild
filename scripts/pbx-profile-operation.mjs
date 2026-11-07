// Trusted workspace deployment only; no listener, provider access or PBX command.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const load = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { Pool } = load('pg');
const { Transaction } = load('./dist/infrastructure/database/transaction.js');
const { SafeLogger } = load('./dist/infrastructure/execution/logging.js');
const { AuditRepository } = load(
  './dist/modules/audit/adapters/db/audit-repository.js',
);
const { profileAudit } = load(
  './dist/modules/telephony/adapters/live/profile-transition.js',
);
const { canonical } = load(
  './dist/modules/telephony/domain/revision-snapshot.js',
);
const [action, raw] = process.argv.slice(2);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hex = /^[a-f0-9]{64}$/;
let pool;
try {
  if (
    !['accept', 'status', 'dispatch'].includes(action) ||
    Buffer.byteLength(raw ?? '') > 8192
  )
    throw new Error();
  const input = JSON.parse(raw);
  if (
    !uuid.test(input.operationId) ||
    !uuid.test(input.nodeId) ||
    !uuid.test(input.installationId)
  )
    throw new Error();
  const url = new URL(process.env.MIGRATION_DATABASE_URL);
  if (
    url.username !== 'myims' ||
    url.hostname !== 'postgres' ||
    (url.pathname !== '/myims' &&
      !/^\/myims_session_[a-f0-9]{12}$/.test(url.pathname))
  )
    throw new Error();
  url.password = readFileSync(
    process.env.MIGRATION_DATABASE_PASSWORD_FILE,
    'utf8',
  ).trim();
  pool = new Pool({
    connectionString: url.href,
    max: 1,
    connectionTimeoutMillis: 2000,
    statement_timeout: 3000,
    lock_timeout: 3000,
  });
  pool.on('error', () => {});
  const context = {
    actor: {
      kind: 'system',
      plane: 'system',
      reference: 'trusted-profile-deployment',
      tenantId: null,
      reason: 'approved-retained-profile-transition',
    },
    target: { type: 'pbx-node', reference: input.nodeId, tenantId: null },
    correlationId: input.operationId,
  };
  const transaction = (fn) =>
    Transaction.run(
      pool,
      context,
      'telephony.profile-deployment',
      new SafeLogger('deployment'),
      fn,
    );
  if (action === 'accept') {
    const keys = [
      'operationId',
      'nodeId',
      'installationId',
      'kind',
      'sourceArtifactId',
      'sourceDigest',
      'targetArtifactId',
      'targetDigest',
      'nodeVersion',
      'compilerVersion',
      'policyVersion',
      'initialBaselineId',
      'predecessorId',
    ];
    if (
      Object.keys(input).sort().join() !== keys.sort().join() ||
      !['upgrade', 'rollback'].includes(input.kind) ||
      ![
        input.sourceArtifactId,
        input.targetArtifactId,
        input.initialBaselineId,
      ].every((v) => typeof v === 'string' && uuid.test(v)) ||
      ![input.sourceDigest, input.targetDigest].every(
        (v) => typeof v === 'string' && hex.test(v),
      ) ||
      !Number.isSafeInteger(input.nodeVersion) ||
      input.nodeVersion < 1 ||
      (input.predecessorId !== null && !uuid.test(input.predecessorId)) ||
      (input.kind === 'upgrade' &&
        (input.targetArtifactId !== input.operationId ||
          input.predecessorId !== null))
    )
      throw new Error();
    const fingerprint = createHash('sha256')
      .update(canonical(input))
      .digest('hex');
    const saved = await transaction(async (tx) => {
      await tx.query('SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE', [
        input.nodeId,
      ]);
      const prior = (
        await tx.query(
          'SELECT fingerprint FROM public.pbx_profile_operations WHERE id=$1',
          [input.operationId],
        )
      ).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new Error();
        return { state: 'existing', operationId: input.operationId };
      }
      if (
        input.kind === 'upgrade' &&
        (input.sourceDigest === input.targetDigest ||
          (
            await tx.query(
              'SELECT 1 FROM public.pbx_live_artifacts WHERE id=$1 UNION ALL SELECT 1 FROM public.pbx_revisions WHERE id=$1 LIMIT 1',
              [input.targetArtifactId],
            )
          ).rows.length)
      )
        throw new Error();
      const row = (
        await tx.query(
          `SELECT n.version,n.installation_id,r.*,a.revision_id,COALESCE(v.compiler_version,'baseline-1') AS compiler_version,COALESCE(v.policy_version,'deny-unbound-1') AS policy_version,
        o.expires_at>clock_timestamp() AS owner_current,r.executor_seen_at>clock_timestamp()-interval '15 seconds' AS executor_current
        FROM public.pbx_nodes n JOIN public.pbx_live_runtime r ON r.node_id=n.id JOIN public.pbx_live_artifacts a ON a.id=r.verified_id
        LEFT JOIN public.pbx_revisions v ON v.id=a.revision_id JOIN public.pbx_ownership o ON o.node_id=n.id WHERE n.id=$1 FOR UPDATE OF r,o`,
          [input.nodeId],
        )
      ).rows[0];
      if (
        !row ||
        row.installation_id !== input.installationId ||
        row.version !== input.nodeVersion ||
        row.verified_id !== input.sourceArtifactId ||
        row.active_operation_id ||
        row.active_retirement_id ||
        !row.owner_current ||
        !row.executor_current ||
        (input.kind === 'upgrade' &&
          (row.runtime_state !== 'verified' ||
            row.installed_id !== row.verified_id ||
            row.known_good_id !== row.verified_id)) ||
        (row.active_profile_operation_id ?? null) !== input.predecessorId ||
        row.compiler_version !== input.compilerVersion ||
        row.policy_version !== input.policyVersion
      )
        throw new Error();
      if (
        !(
          await tx.query(
            'SELECT 1 FROM public.pbx_live_artifacts WHERE node_id=$1 AND id=$2 AND initial_baseline',
            [input.nodeId, input.initialBaselineId],
          )
        ).rows.length
      )
        throw new Error();
      if (
        (
          await tx.query(
            `SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown') LIMIT 1`,
            [input.nodeId],
          )
        ).rows.length
      )
        throw new Error();
      if (
        input.kind === 'rollback' &&
        !(
          await tx.query(
            `SELECT 1 FROM public.pbx_live_artifacts a WHERE a.id=$2 AND a.node_id=$1 AND NOT EXISTS(SELECT 1 FROM public.pbx_artifact_retirements t WHERE t.artifact_id=a.id)`,
            [input.nodeId, input.targetArtifactId],
          )
        ).rows.length
      )
        throw new Error();
      if (
        input.predecessorId &&
        !(
          await tx.query(
            'SELECT 1 FROM public.pbx_profile_operations WHERE id=$1 AND node_id=$2 AND installation_id=$3',
            [input.predecessorId, input.nodeId, input.installationId],
          )
        ).rows.length
      )
        throw new Error();
      await tx.query(
        `INSERT INTO public.pbx_profile_operations(id,node_id,installation_id,kind,predecessor_id,source_artifact_id,source_digest,target_artifact_id,target_digest,source_revision_id,expected_node_version,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          input.operationId,
          input.nodeId,
          input.installationId,
          input.kind,
          input.predecessorId,
          input.sourceArtifactId,
          input.sourceDigest,
          input.targetArtifactId,
          input.targetDigest,
          row.revision_id,
          input.nodeVersion,
          fingerprint,
        ],
      );
      await tx.query(
        'INSERT INTO public.pbx_profile_progress(operation_id) VALUES($1)',
        [input.operationId],
      );
      await tx.query(
        "UPDATE public.pbx_live_runtime SET active_profile_operation_id=$2,runtime_state='unknown',updated_at=clock_timestamp() WHERE node_id=$1",
        [input.nodeId, input.operationId],
      );
      await new AuditRepository().append(tx, profileAudit, {
        operationId: input.operationId,
        nodeId: input.nodeId,
        action: 'queued',
      });
      return { state: 'queued', operationId: input.operationId };
    });
    console.log(JSON.stringify(saved));
  } else if (action === 'status') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const row = (
        await client.query(
          `SELECT i.id,i.node_id,i.installation_id,i.kind,i.source_artifact_id,i.source_digest,i.target_artifact_id,i.target_digest,i.predecessor_id,p.state,p.failure,p.owner_epoch::text FROM public.pbx_profile_operations i JOIN public.pbx_profile_progress p ON p.operation_id=i.id WHERE i.id=$1 AND i.node_id=$2 AND i.installation_id=$3`,
          [input.operationId, input.nodeId, input.installationId],
        )
      ).rows[0];
      if (!row) throw new Error();
      await client.query('COMMIT');
      console.log(JSON.stringify(row));
    } finally {
      client.release();
    }
  } else {
    // Commit dispatch uncertainty first. A lost host response cannot authorize replay.
    await transaction(async (tx) => {
      await tx.query('SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE', [
        input.nodeId,
      ]);
      const changed = await tx.query(
        `UPDATE public.pbx_profile_progress p SET state='restart_dispatched',updated_at=clock_timestamp() FROM public.pbx_profile_operations i JOIN public.pbx_live_runtime r ON r.active_profile_operation_id=i.id JOIN public.pbx_nodes n ON n.id=i.node_id AND n.installation_id=i.installation_id AND n.version=i.expected_node_version WHERE p.operation_id=i.id AND i.id=$1 AND i.node_id=$2 AND i.installation_id=$3 AND p.state='prepared' RETURNING p.operation_id`,
        [input.operationId, input.nodeId, input.installationId],
      );
      if (!changed.rows.length) throw new Error();
      await new AuditRepository().append(tx, profileAudit, {
        operationId: input.operationId,
        nodeId: input.nodeId,
        action: 'restart_dispatched',
      });
    });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT id FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
        [input.nodeId],
      );
      const owner = (
        await client.query(
          `SELECT o.epoch::text,o.incarnation,o.expires_at,r.verified_id FROM public.pbx_ownership o JOIN public.pbx_live_runtime r ON r.node_id=o.node_id JOIN public.pbx_profile_operations i ON i.id=r.active_profile_operation_id JOIN public.pbx_nodes n ON n.id=o.node_id WHERE o.node_id=$1 AND n.installation_id=$3 AND n.version=i.expected_node_version AND o.desired_version=n.version AND o.expires_at>clock_timestamp()+interval '10 seconds' AND o.epoch=r.boundary_epoch AND r.active_profile_operation_id=$2 FOR UPDATE OF o,r`,
          [input.nodeId, input.operationId, input.installationId],
        )
      ).rows[0];
      if (!owner) throw new Error();
      console.log(
        JSON.stringify({
          dispatchReady: true,
          epoch: owner.epoch,
          incarnation: owner.incarnation,
        }),
      );
      const outcome = await new Promise((resolve, reject) => {
        let data = '';
        const timer = setTimeout(() => reject(new Error()), 60000);
        process.stdin.on('data', (chunk) => {
          data += chunk;
          if (data.length > 1024) {
            clearTimeout(timer);
            reject(new Error());
          } else if (data.includes('\n')) {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error());
            }
          }
        });
        process.stdin.on('end', () => {
          clearTimeout(timer);
          reject(new Error());
        });
      });
      if (outcome?.dispatched !== true) throw new Error();
      await client.query('COMMIT');
      console.log(JSON.stringify({ dispatchRecorded: true }));
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  }
} catch {
  console.error(
    'Profile operation rejected or unresolved; inspect the exact operation before further effects.',
  );
  process.exitCode = 2;
} finally {
  await pool?.end().catch(() => {});
}
