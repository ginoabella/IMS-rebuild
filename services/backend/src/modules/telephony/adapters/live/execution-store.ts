import { Pool } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { captureSnapshot } from '../db/revision-snapshot';
import {
  canonical,
  COMPILER_VERSION,
  POLICY_VERSION,
} from '../../domain/revision-snapshot';
import type { PbxOwnershipToken } from '../../application/observation-ports';
import { ObservationRepository } from '../db/observation-repository';
import { observationSettings } from '../../domain/observation-settings';
import { SnapshotDatabase } from '../../../../infrastructure/database/read-snapshot';
import { PlatformAuthorityRepository } from '../../../platform/adapters/db/authority-read';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { liveAuditContract } from '../../application/pbx-live';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
import type { PbxLiveState } from '@myims/contracts';
import type { BoundaryResult } from './mutation-boundary';
export interface LiveIntentRow {
  id: string;
  node_id: string;
  installation_id: string;
  sequence: number;
  kind: 'apply' | 'recover' | 'reconcile';
  revision_id: string | null;
  expected_baseline_id: string;
  target_id: string;
  operator_id: string;
  authentication_version: number;
  fingerprint: string;
  state: PbxLiveState;
  snapshot: RevisionSnapshot | null;
  predecessor_id: string | null;
  revision_sequence: number | null;
  source_digest: string | null;
  compiler_version: string | null;
  policy_version: string | null;
}
export class LiveExecutionStore {
  readonly ownership: ObservationRepository;
  readonly database: SnapshotDatabase;
  readonly pool: Pool;
  private readonly platform: PlatformAuthorityRepository;
  private readonly audit = new AuditRepository();
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: 2000,
      statement_timeout: 2000,
      lock_timeout: 2000,
      idle_in_transaction_session_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.pool.on('connect', (c) => c.on('error', () => {}));
    this.database = new SnapshotDatabase(url);
    this.platform = new PlatformAuthorityRepository(this.database);
    this.ownership = new ObservationRepository(url, observationSettings());
  }
  async intent(node: string, operation: string): Promise<LiveIntentRow | null> {
    return (
      (
        await this.pool.query<LiveIntentRow>(
          `SELECT o.*,p.state,r.snapshot,r.sequence AS revision_sequence,r.source_digest,r.compiler_version,r.policy_version FROM public.pbx_live_operations o JOIN public.pbx_live_progress p ON p.operation_id=o.id LEFT JOIN public.pbx_revisions r ON r.id=o.revision_id WHERE o.node_id=$1 AND o.id=$2`,
          [node, operation],
        )
      ).rows[0] ?? null
    );
  }
  async next(node: string): Promise<string | null> {
    return (
      (
        await this.pool.query<{ id: string }>(
          `SELECT o.id FROM public.pbx_live_runtime r JOIN public.pbx_live_operations o ON o.id=r.active_operation_id JOIN public.pbx_live_progress p ON p.operation_id=o.id WHERE r.node_id=$1 AND p.state NOT IN ('verified','recovered','validation_failed','revoked','unknown','failed')`,
          [node],
        )
      ).rows[0]?.id ?? null
    );
  }
  async authorized(row: LiveIntentRow): Promise<boolean> {
    const p = await this.platform.byId({
      plane: 'platform',
      operatorId: row.operator_id,
    });
    return (
      p.kind === 'eligible' &&
      p.snapshot.authenticationVersion === row.authentication_version
    );
  }
  async dependenciesCurrent(
    token: PbxOwnershipToken,
    row: LiveIntentRow,
  ): Promise<boolean> {
    if (
      !row.snapshot ||
      !row.source_digest ||
      row.compiler_version !== COMPILER_VERSION ||
      row.policy_version !== POLICY_VERSION
    )
      return false;
    const result = await this.ownership.fenced(token, async (tx) => {
      const active = await tx.query(
        'SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND active_operation_id=$2 FOR UPDATE',
        [row.node_id, row.id],
      );
      if (!active.rows[0]) return false;
      const current = await captureSnapshot(tx, row.node_id);
      return (
        createHash('sha256').update(canonical(current)).digest('hex') ===
        row.source_digest
      );
    });
    return result.accepted && result.value === true;
  }
  async phase(
    token: PbxOwnershipToken,
    row: LiveIntentRow,
    state: PbxLiveState,
    values: Partial<
      Record<
        'validation' | 'installation' | 'verification' | 'recovery' | 'failure',
        string | null
      >
    > = {},
  ) {
    const allowed = [
      'validation',
      'installation',
      'verification',
      'recovery',
      'failure',
    ];
    if (Object.keys(values).some((k) => !allowed.includes(k)))
      throw new Error('Live phase unavailable');
    const result = await this.ownership.fenced(token, async (tx) => {
      const active = await tx.query(
        'SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND active_operation_id=$2 FOR UPDATE',
        [row.node_id, row.id],
      );
      if (!active.rows[0]) throw new Error('Live operation unavailable');
      const fields = Object.entries(values),
        args: unknown[] = [row.id, state, ...fields.map(([, v]) => v)];
      await tx.query(
        `UPDATE public.pbx_live_progress SET state=$2${fields.map(([k], i) => `,${k}=$${i + 3}`).join('')},updated_at=clock_timestamp() WHERE operation_id=$1`,
        args,
      );
      if (
        [
          'installing',
          'reloading',
          'verifying',
          'recovering',
          'unknown',
          'failed',
        ].includes(state)
      )
        await tx.query(
          `UPDATE public.pbx_live_runtime SET runtime_state=$2,updated_at=clock_timestamp() WHERE node_id=$1`,
          [row.node_id, state === 'failed' ? 'failed' : 'unknown'],
        );
      await this.audit.append(tx, liveAuditContract, {
        operationId: row.id,
        nodeId: row.node_id,
        action: state,
      });
    });
    if (!result.accepted) throw new Error('Live owner expired');
  }
  async finish(
    token: PbxOwnershipToken,
    row: LiveIntentRow,
    result: BoundaryResult,
  ) {
    const saved = await this.ownership.fenced(token, async (tx) => {
      const active = await tx.query(
        'SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND active_operation_id=$2 FOR UPDATE',
        [row.node_id, row.id],
      );
      if (!active.rows[0]) return;
      if (result.kind === 'verified' || result.kind === 'recovered') {
        if (!result.verifiedId) throw new Error('Missing verified identity');
        const revision = await tx.query(
          'SELECT id FROM public.pbx_revisions WHERE id=$1 AND node_id=$2',
          [result.verifiedId, row.node_id],
        );
        await tx.query(
          'INSERT INTO public.pbx_live_artifacts(id,node_id,revision_id,initial_baseline,verified_at,operation_id) VALUES($1,$2,$3,$4,clock_timestamp(),$5) ON CONFLICT DO NOTHING',
          [
            result.verifiedId,
            row.node_id,
            revision.rows[0] ? result.verifiedId : null,
            !revision.rows[0],
            row.id,
          ],
        );
        await tx.query(
          `UPDATE public.pbx_live_progress SET state=$2,installation=CASE WHEN $5='install_failed' THEN 'failed' WHEN $5 IS NOT NULL THEN installation ELSE 'installed' END,verification=$4,recovery=$3,failure=$5,updated_at=clock_timestamp() WHERE operation_id=$1`,
          [
            row.id,
            result.kind,
            result.kind === 'recovered' ? 'passed' : 'not_required',
            result.kind === 'recovered' && result.failure
              ? result.failure === 'verification_failed'
                ? 'failed'
                : 'pending'
              : 'passed',
            result.failure ?? null,
          ],
        );
        await tx.query(
          `UPDATE public.pbx_live_runtime SET runtime_state='verified',installed_id=$2,verified_id=$2,known_good_id=$2,active_operation_id=NULL,boundary_epoch=$3,updated_at=clock_timestamp() WHERE node_id=$1`,
          [row.node_id, result.verifiedId, token.epoch],
        );
      } else if (
        result.kind === 'validation_failed' ||
        result.kind === 'revoked'
      ) {
        await tx.query(
          `UPDATE public.pbx_live_progress SET state=$2,validation=CASE WHEN $2='validation_failed' THEN 'failed' ELSE validation END,failure=$3,updated_at=clock_timestamp() WHERE operation_id=$1`,
          [
            row.id,
            result.kind,
            result.failure ??
              (result.kind === 'revoked'
                ? 'originator_revoked'
                : 'validation_failed'),
          ],
        );
        await tx.query(
          `UPDATE public.pbx_live_runtime SET active_operation_id=NULL,updated_at=clock_timestamp() WHERE node_id=$1`,
          [row.node_id],
        );
        await tx.query(
          `UPDATE public.pbx_live_pins SET released_at=clock_timestamp(),release_operation_id=$2 WHERE revision_id=$1 AND released_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.pbx_live_artifacts WHERE revision_id=$1)`,
          [row.revision_id, row.id],
        );
      } else {
        await tx.query(
          `UPDATE public.pbx_live_progress SET state='unknown',verification='unknown',recovery='unknown',failure='reconciliation_required',updated_at=clock_timestamp() WHERE operation_id=$1`,
          [row.id],
        );
        await tx.query(
          `UPDATE public.pbx_live_runtime SET runtime_state='unknown',installed_id=$2,updated_at=clock_timestamp() WHERE node_id=$1`,
          [row.node_id, result.installedId],
        );
      }
      if (
        row.predecessor_id &&
        (result.kind === 'verified' || result.kind === 'recovered')
      ) {
        await tx.query(
          "UPDATE public.pbx_live_progress SET state='recovered',recovery='passed',failure=NULL,updated_at=clock_timestamp() WHERE operation_id=$1 AND node_id=$2",
          [row.predecessor_id, row.node_id],
        );
        await this.audit.append(tx, liveAuditContract, {
          operationId: row.predecessor_id,
          nodeId: row.node_id,
          action: 'recovered',
        });
      }
      await this.audit.append(tx, liveAuditContract, {
        operationId: row.id,
        nodeId: row.node_id,
        action: result.kind,
      });
    });
    if (!saved.accepted) throw new Error('Live owner expired');
  }
  async beginAttempt(
    token: PbxOwnershipToken,
    row: LiveIntentRow,
  ): Promise<boolean> {
    const result = await this.ownership.fenced(token, async (tx) => {
      const active = await tx.query(
        'SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND active_operation_id=$2 FOR UPDATE',
        [row.node_id, row.id],
      );
      if (!active.rows[0]) return false;
      const claimed = await tx.query(
        'UPDATE public.pbx_live_progress SET attempt=attempt+1,updated_at=clock_timestamp() WHERE operation_id=$1 AND attempt<6 RETURNING attempt',
        [row.id],
      );
      return !!claimed.rows[0];
    });
    if (!result.accepted) throw new Error('Live owner expired');
    return result.value;
  }
  async heartbeat(token: PbxOwnershipToken) {
    const result = await this.ownership.fenced(token, (tx) =>
      tx.query(
        'UPDATE public.pbx_live_runtime SET executor_seen_at=clock_timestamp(),boundary_epoch=$2 WHERE node_id=$1',
        [token.nodeId, token.epoch],
      ),
    );
    if (!result.accepted) throw new Error('Live owner expired');
  }
  async recordBaseline(
    token: PbxOwnershipToken,
    installationId: string,
    baselineId: string,
  ) {
    const result = await this.ownership.fenced(token, async (tx) => {
      const node = await tx.query(
        'SELECT 1 FROM public.pbx_nodes WHERE id=$1 AND installation_id=$2',
        [token.nodeId, installationId],
      );
      if (!node.rows[0]) throw new Error('Baseline installation mismatch');
      const old = (
        await tx.query<{ baseline_verified_at: Date | null }>(
          'SELECT baseline_verified_at FROM public.pbx_live_runtime WHERE node_id=$1 FOR UPDATE',
          [token.nodeId],
        )
      ).rows[0];
      if (old) {
        const baseline = await tx.query(
          'SELECT 1 FROM public.pbx_live_artifacts WHERE id=$1 AND node_id=$2 AND initial_baseline',
          [baselineId, token.nodeId],
        );
        if (!old.baseline_verified_at || !baseline.rows[0])
          throw new Error('Baseline already established');
        return;
      }
      await tx.query(
        'INSERT INTO public.pbx_live_artifacts(id,node_id,revision_id,initial_baseline,verified_at) VALUES($1,$2,NULL,true,clock_timestamp())',
        [baselineId, token.nodeId],
      );
      await tx.query(
        `INSERT INTO public.pbx_live_runtime(node_id,installed_id,verified_id,known_good_id,runtime_state,baseline_verified_at,executor_seen_at,boundary_epoch) VALUES($1,$2,$2,$2,'verified',clock_timestamp(),clock_timestamp(),$3)`,
        [token.nodeId, baselineId, token.epoch],
      );
      await this.audit.append(tx, liveAuditContract, {
        operationId: baselineId,
        nodeId: token.nodeId,
        action: 'baseline',
      });
    });
    if (!result.accepted) throw new Error('Live owner expired');
  }
  async close() {
    await Promise.all([
      this.pool.end(),
      this.database.close(),
      this.ownership.close(),
    ]);
  }
  static correlation() {
    return randomUUID();
  }
}
