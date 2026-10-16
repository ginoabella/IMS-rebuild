import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import type {
  EndpointSecretCleanup,
  CredentialDependencyPort,
} from '../../application/credential-ports';
import { CredentialProviderError } from '../../application/credential-ports';
import { CredentialRepository, binding } from '../db/credential-repository';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
import { uuid } from '../../../identity/domain/storage';
const maintenanceAudit = {
  type: 'endpoint.credential.maintenance',
  version: 1,
  fields: {
    action: {
      kind: 'enum' as const,
      values: [
        'requeue',
        'destroyed',
        'absent',
        'cleanup_required',
        'cleanup_retry',
      ],
    },
    operationId: { kind: 'uuid' as const },
    cleanupAttempts: { kind: 'integer' as const, min: 0, max: 2147483647 },
  },
};
export class CredentialMaintenance {
  private readonly store = new CredentialRepository();
  constructor(
    private readonly pool: Pool,
    private readonly cleanup?: EndpointSecretCleanup,
    private readonly dependencies?: CredentialDependencyPort,
  ) {}
  async run(
    action: 'requeue' | 'cleanup' | 'cleanup-retry',
    installation: string,
    ids: string[],
  ) {
    if (
      !uuid(installation) ||
      ids.length < 1 ||
      ids.length > 50 ||
      new Set(ids).size !== ids.length ||
      ids.some((x) => !uuid(x))
    )
      throw new Error('Exact bounded scope required');
    const results: { operationId: string; outcome: string }[] = [];
    for (const id of ids) {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
          `endpoint-operation:${id}`,
        ]);
        const row = await this.store.operation(client, id);
        if (!row || row.installation_id !== installation)
          throw new Error('Invalid maintenance scope');
        const context = {
          actor: {
            kind: 'system',
            reference: 'endpoint-credential-maintenance',
            plane: 'system',
            tenantId: null,
            reason: action,
          },
          target: {
            type: 'endpoint-credential-operation',
            reference: id,
            tenantId: null,
          },
          correlationId: row.correlation_id,
        };
        if (action === 'requeue') {
          if (
            row.state !== 'needs_reconciliation' ||
            row.terminal_at ||
            !row.work_id
          ) {
            results.push({ operationId: id, outcome: 'denied' });
            continue;
          }
          await Transaction.runWithClient(
            client,
            context,
            'endpoint.requeue',
            new SafeLogger('deployment'),
            async (tx) => {
              // Existing intent, generation and key survive. A new standard queue execution gets a fresh finite budget.
              await tx.query(
                "UPDATE public.endpoint_credential_operations SET state='queued',failure_code=NULL,budget=budget+1 WHERE id=$1 AND state='needs_reconciliation'",
                [id],
              );
              await tx.query(
                `INSERT INTO pgboss.job(name,data,retry_limit,retry_delay,retry_backoff,expire_in) VALUES('committed-work-v1',jsonb_build_object('workId',$1::text),5,5,true,interval '60 seconds')`,
                [row.work_id],
              );
              await new AuditRepository().append(tx, maintenanceAudit, {
                action: 'requeue',
                operationId: id,
                cleanupAttempts: row.cleanup_attempts,
              });
            },
          );
          results.push({ operationId: id, outcome: 'queued' });
          continue;
        }
        if (action === 'cleanup-retry') {
          if (
            row.cleanup_state !== 'cleanup_required' ||
            row.cleanup_attempts < 6 ||
            !row.terminal_at ||
            row.associated_at
          ) {
            results.push({ operationId: id, outcome: 'denied' });
            continue;
          }
          await Transaction.runWithClient(
            client,
            context,
            'endpoint.cleanup-retry',
            new SafeLogger('deployment'),
            async (tx) => {
              await tx.query(
                'UPDATE public.endpoint_credential_operations SET cleanup_attempts=0 WHERE id=$1',
                [id],
              );
              await new AuditRepository().append(tx, maintenanceAudit, {
                action: 'cleanup_retry',
                operationId: id,
                cleanupAttempts: row.cleanup_attempts,
              });
            },
          );
          results.push({ operationId: id, outcome: 'cleanup_retry' });
          continue;
        }
        const eligibility = (
          await client.query<{ eligible: boolean }>(
            `SELECT terminal_at IS NOT NULL AND terminal_at<=clock_timestamp()-interval '24 hours' AND associated_at IS NULL AND state IN ('cancelled','conflict','failed') AND NOT EXISTS(SELECT 1 FROM public.extensions e WHERE e.credential_generation_id=o.generation_id) AS eligible FROM public.endpoint_credential_operations o WHERE id=$1`,
            [id],
          )
        ).rows[0]?.eligible;
        // No associated-generation consumer is provisioned by b. Exact never-associated
        // canonical history proves this generation was never exposed to a revision.
        if (
          !eligibility ||
          !this.cleanup ||
          !(await this.dependencies?.neverAssociatedMayDestroy(binding(row)))
        ) {
          results.push({
            operationId: id,
            outcome: 'retained_dependency_unknown',
          });
          continue;
        }
        if (
          row.cleanup_attempts >= 6 &&
          row.cleanup_state === 'cleanup_required'
        ) {
          results.push({ operationId: id, outcome: 'cleanup_required' });
          continue;
        }
        let outcome: 'destroyed' | 'absent' | 'cleanup_required' =
          'cleanup_required';
        let attempt = row.cleanup_attempts;
        do {
          attempt++;
          // Record potential effect before provider I/O. A new sweep always inspects
          // absent/destroyed tombstones, including keys with late in-flight writes.
          await client.query(
            'UPDATE public.endpoint_credential_operations SET cleanup_attempts=$2 WHERE id=$1',
            [id, attempt],
          );
          let retryable = false;
          try {
            outcome = await this.cleanup.destroy(binding(row));
          } catch (e) {
            if (!(e instanceof CredentialProviderError)) throw e;
            retryable = e.retryable;
          }
          await Transaction.runWithClient(
            client,
            context,
            'endpoint.cleanup',
            new SafeLogger('deployment'),
            async (tx) => {
              await tx.query(
                'UPDATE public.endpoint_credential_operations SET cleanup_state=$2,cleanup_checked_at=clock_timestamp() WHERE id=$1',
                [id, outcome],
              );
              await new AuditRepository().append(tx, maintenanceAudit, {
                action: outcome,
                operationId: id,
                cleanupAttempts: attempt,
              });
            },
          );
          if (outcome !== 'cleanup_required' || !retryable || attempt >= 6)
            break;
          await delay(Math.min(300000, 5000 * 2 ** (attempt - 1)));
        } while (attempt < 6);
        results.push({ operationId: id, outcome });
      } finally {
        await client
          .query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
            `endpoint-operation:${id}`,
          ])
          .catch(() => {});
        client.release();
      }
    }
    return results;
  }
}
