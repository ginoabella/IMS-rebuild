import type { Pool, PoolClient } from 'pg';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import type { ExecutionContext } from '../../../../infrastructure/execution/context';
import type { TransactionAuthority } from '../../../identity/application/transaction-authority';
import type { InventoryVersionPort } from '../../application/inventory-ports';
import { InventoryRejected } from '../../domain/inventory';
import { credentialAuditContract } from '../../application/endpoint-credentials';
import {
  CredentialProviderError,
  type EndpointSecretProvider,
} from '../../application/credential-ports';
import type { AuditWrite } from '../../../audit/application/audit-write';
import {
  CredentialRepository,
  binding,
  type CredentialOperation,
} from '../db/credential-repository';
export interface CredentialHooks {
  barrier?: (
    stage: 'before_prepare' | 'after_prepare' | 'before_association',
    operationId: string,
  ) => Promise<void>;
}
export class CredentialHandler {
  private readonly store = new CredentialRepository();
  private readonly logger = new SafeLogger('worker');
  constructor(
    private readonly pool: Pool,
    private readonly authority: TransactionAuthority,
    private readonly inventory: InventoryVersionPort,
    private readonly audit: AuditWrite,
    private readonly provider: EndpointSecretProvider,
    private readonly hooks: CredentialHooks = {},
  ) {}
  private context(row: CredentialOperation): ExecutionContext {
    return {
      actor: {
        kind: 'platform_operator',
        reference: row.operator_id,
        plane: 'platform',
        tenantId: null,
      },
      target: {
        type: 'endpoint-credential-operation',
        reference: row.id,
        tenantId: null,
      },
      correlationId: row.correlation_id,
    };
  }
  private transaction<T>(
    client: PoolClient,
    row: CredentialOperation,
    action: (tx: Transaction) => Promise<T>,
  ) {
    return Transaction.runWithClient(
      client,
      this.context(row),
      'endpoint.credentials',
      this.logger,
      action,
    );
  }
  private async fenced(tx: Transaction, row: CredentialOperation) {
    const authorized = await this.authority.validate(tx, {
      plane: 'platform',
      operatorId: row.operator_id,
      authenticationVersion: row.authentication_version,
      grants: ['platform_operator'],
    });
    if (!authorized) {
      await this.store.terminal(tx, row, 'cancelled', 'originator_revoked');
      return false;
    }
    try {
      await this.inventory.lockUnallocated(
        tx,
        row.node_id,
        row.extension_id,
        row.expected_version,
      );
    } catch (e) {
      if (!(e instanceof InventoryRejected)) throw e;
      if (e.outcome.kind === 'unavailable') throw e;
      await this.store.terminal(
        tx,
        row,
        'conflict',
        e.outcome.kind === 'conflict' && e.outcome.reason === 'stale_version'
          ? 'stale_version'
          : 'dependency_changed',
      );
      return false;
    }
    const current = await this.store.current(tx, row.node_id, row.extension_id);
    const dependencies = await this.store.dependencies(
      tx,
      row.node_id,
      row.installation_id,
    );
    if (
      current?.credential_generation_id !== row.expected_generation_id ||
      !dependencies?.compatible ||
      dependencies.nodeVersion !== row.node_version ||
      dependencies.capabilityRevision !== row.capability_revision
    ) {
      await this.store.terminal(tx, row, 'conflict', 'dependency_changed');
      return false;
    }
    return true;
  }
  async execute(operationId: string, workId: string, queueAttempt: number) {
    const client = await this.pool.connect();
    let locked = false;
    try {
      // Session coordination spans external calls and commits; no open DB transaction during provider I/O.
      await client.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
        `endpoint-operation:${operationId}`,
      ]);
      locked = true;
      const found = await this.store.operation(client, operationId);
      if (!found || found.work_id !== workId) throw new Error('invalid_work');
      let row: CredentialOperation = found;
      if (row.terminal_at || row.state === 'needs_reconciliation') return;
      const active = await this.transaction(client, row, async (tx) => {
        row = (await this.store.operation(tx, operationId))!;
        if (row.terminal_at || row.state === 'needs_reconciliation')
          return false;
        if (!(await this.fenced(tx, row))) return false;
        const attempt = Math.max(
          row.attempts + 1,
          (row.budget - 1) * 6 + queueAttempt,
        );
        if (attempt > row.budget * 6) {
          await tx.query(
            "UPDATE public.endpoint_credential_operations SET state='needs_reconciliation',failure_code='needs_reconciliation' WHERE id=$1",
            [row.id],
          );
          return false;
        }
        await tx.query(
          "UPDATE public.endpoint_credential_operations SET attempts=$2,state='retrying' WHERE id=$1",
          [row.id, attempt],
        );
        return true;
      });
      if (!active) return;
      row = (await this.store.operation(client, operationId))!;
      try {
        await this.hooks.barrier?.('before_prepare', row.id);
        await this.provider.prepare(binding(row));
        await this.hooks.barrier?.('after_prepare', row.id);
      } catch (e) {
        const error =
          e instanceof CredentialProviderError
            ? e
            : new CredentialProviderError('provider_unavailable', true);
        await this.transaction(client, row, async (tx) => {
          const current = (await this.store.operation(tx, operationId))!;
          if (current.terminal_at) return;
          if (!error.retryable)
            await this.store.terminal(tx, current, 'failed', error.code);
          else
            await tx.query(
              `UPDATE public.endpoint_credential_operations SET state=$2,failure_code=$3 WHERE id=$1`,
              [
                row.id,
                row.attempts >= row.budget * 6
                  ? 'needs_reconciliation'
                  : 'retrying',
                error.code,
              ],
            );
        });
        if (error.retryable && row.attempts < row.budget * 6)
          throw new Error('retryable_delivery', { cause: e });
        return;
      }
      await this.hooks.barrier?.('before_association', row.id);
      await this.transaction(client, row, async (tx) => {
        const current = (await this.store.operation(tx, operationId))!;
        if (current.terminal_at || current.state === 'needs_reconciliation')
          return;
        if (!(await this.fenced(tx, current))) return;
        await tx.query(
          'UPDATE public.extensions SET credential_generation_id=$2,version=version+1,updated_at=clock_timestamp(),updated_by=$3 WHERE id=$1 AND version=$4',
          [
            row.extension_id,
            row.generation_id,
            row.operator_id,
            row.expected_version,
          ],
        );
        await tx.query(
          "UPDATE public.endpoint_credential_operations SET material_health='verified',verified_at=clock_timestamp() WHERE id=$1",
          [row.id],
        );
        await this.audit.append(tx, credentialAuditContract, {
          action: row.action,
          operationId: row.id,
          generationId: row.generation_id,
          ordinal: row.ordinal,
          desiredVersion: row.expected_version + 1,
        });
        await this.store.terminal(tx, current, 'associated', null);
        await tx.query(
          `INSERT INTO public.work_results(work_id,handler,attempts,outcome,first_attempt_at,last_attempt_at,finished_at) VALUES($1,'endpoint.credential.prepare',$2,'succeeded',clock_timestamp(),clock_timestamp(),clock_timestamp()) ON CONFLICT(work_id) DO UPDATE SET outcome='succeeded',failure_code=NULL,attempts=EXCLUDED.attempts,last_attempt_at=clock_timestamp(),finished_at=clock_timestamp()`,
          [workId, Math.min(row.attempts, 1000)],
        );
        await tx.query(
          "INSERT INTO public.work_receipts(work_id,handler) VALUES($1,'endpoint.credential.prepare') ON CONFLICT DO NOTHING",
          [workId],
        );
      });
    } finally {
      // A lost connection releases the server lock. Any late provider key was already durably reserved.
      if (locked)
        await client
          .query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
            `endpoint-operation:${operationId}`,
          ])
          .catch(() => {});
      client.release();
    }
  }
  async reconcileExhausted(installationId: string) {
    await this.pool.query(
      `UPDATE public.endpoint_credential_operations o SET state='needs_reconciliation',failure_code='needs_reconciliation'
      WHERE o.installation_id=$1::uuid AND o.state IN ('queued','retrying') AND EXISTS (SELECT 1 FROM pgboss.job j WHERE j.data->>'workId'=o.work_id::text AND j.state='failed')
      AND NOT EXISTS (SELECT 1 FROM pgboss.job j WHERE j.data->>'workId'=o.work_id::text AND j.state<'completed')`,
      [installationId],
    );
  }
  async verify(operationId: string) {
    const row = await this.store.operation(this.pool, operationId);
    if (!row || row.state !== 'associated')
      throw new Error('Invalid reconciliation target');
    let health: 'verified' | 'unknown' | 'unavailable' = 'unknown';
    try {
      health = await this.provider.verify(binding(row));
    } catch (e) {
      if (e instanceof CredentialProviderError && e.code === 'material_invalid')
        health = 'unavailable';
    }
    await this.pool.query(
      "UPDATE public.endpoint_credential_operations SET material_health=$2,verified_at=CASE WHEN $2='verified' THEN clock_timestamp() ELSE verified_at END WHERE id=$1 AND state='associated'",
      [operationId, health],
    );
  }
}
