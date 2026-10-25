import type { RevisionSummary, RevisionValidation } from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { RevisionSnapshot } from '../../domain/revision-snapshot';
const columns = `id,node_id AS "nodeId",installation_id AS "installationId",sequence,parent_id AS "parentId",baseline_id AS "baselineId",compiler_version AS "compilerVersion",policy_version AS "policyVersion",created_by AS "createdBy",created_at AS "createdAt"`;
export interface SavedRevision extends Omit<RevisionSummary, 'createdAt'> {
  createdAt: Date;
  snapshot: RevisionSnapshot;
  sourceDigest: string;
}
export function summary(r: SavedRevision): RevisionSummary {
  return {
    id: r.id,
    nodeId: r.nodeId,
    installationId: r.installationId,
    sequence: r.sequence,
    parentId: r.parentId,
    baselineId: r.baselineId,
    compilerVersion: r.compilerVersion,
    policyVersion: r.policyVersion,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}
export class RevisionRepository {
  async detail(s: ReadSnapshot, node: string, id: string) {
    return (
      (
        await s.query<SavedRevision>(
          `SELECT ${columns},snapshot,source_digest AS "sourceDigest" FROM public.pbx_revisions WHERE node_id=$1 AND id=$2`,
          [node, id],
        )
      ).rows[0] ?? null
    );
  }
  async list(s: ReadSnapshot, node: string, after: number, limit: number) {
    return (
      await s.query<SavedRevision>(
        `SELECT ${columns} FROM public.pbx_revisions WHERE node_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3`,
        [node, after, limit],
      )
    ).rows.map(summary);
  }
  async latest(s: ReadSnapshot, node: string) {
    return (
      await s.query<{ id: string; sequence: number }>(
        'SELECT id,sequence FROM public.pbx_revisions WHERE node_id=$1 ORDER BY sequence DESC LIMIT 1',
        [node],
      )
    ).rows[0];
  }
  async receipt(tx: Transaction, requestId: string) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `pbx-revision:${tx.context.actor.reference}:${requestId}`,
    ]);
    return (
      await tx.query<{
        fingerprint: string;
        revisionId: string;
        expired: boolean;
      }>(
        `SELECT fingerprint,revision_id AS "revisionId",created_at<=clock_timestamp()-interval '30 days' AS expired FROM public.pbx_revision_receipts WHERE operator_id=$1 AND request_id=$2`,
        [tx.context.actor.reference, requestId],
      )
    ).rows[0];
  }
  async receiptRead(s: ReadSnapshot, operator: string, requestId: string) {
    return (
      await s.query<{ revisionId: string }>(
        `SELECT revision_id AS "revisionId" FROM public.pbx_revision_receipts WHERE operator_id=$1 AND request_id=$2`,
        [operator, requestId],
      )
    ).rows[0];
  }
  async validation(s: ReadSnapshot, revisionId: string) {
    const r = (
      await s.query<{ result: RevisionValidation }>(
        `SELECT result FROM public.pbx_revision_validations WHERE revision_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,
        [revisionId],
      )
    ).rows[0];
    return r?.result ?? null;
  }
}
