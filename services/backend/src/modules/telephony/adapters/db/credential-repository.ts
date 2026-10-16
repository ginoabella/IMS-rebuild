import type {
  CredentialStore,
  CredentialReservation,
} from '../../application/credential-store';
import type { EndpointCredentialFailure } from '@myims/contracts';
import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../../infrastructure/database/transaction';
export {
  binding,
  operationDto,
  type CredentialOperation,
} from '../../domain/credential-operation';
import {
  operationDto,
  type CredentialOperation,
} from '../../domain/credential-operation';
const select = `SELECT *,terminal_at<=clock_timestamp()-interval '30 days' AS expired FROM public.endpoint_credential_operations`;
export class CredentialRepository implements CredentialStore {
  async operation(s: ReadSnapshot, id: string) {
    return (
      (await s.query<CredentialOperation>(`${select} WHERE id=$1`, [id]))
        .rows[0] ?? null
    );
  }
  async receipt(
    tx: Transaction,
    operator: string,
    action: string,
    request: string,
  ) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `endpoint-intent:${operator}:${action}:${request}`,
    ]);
    return (
      (
        await tx.query<CredentialOperation>(
          `${select} WHERE operator_id=$1 AND action=$2 AND request_id=$3`,
          [operator, action, request],
        )
      ).rows[0] ?? null
    );
  }
  async current(s: ReadSnapshot, node: string, extension: string) {
    return (
      (
        await s.query<{
          installation_id: string;
          credential_generation_id: string | null;
          version: number;
        }>(
          'SELECT installation_id,credential_generation_id,version FROM public.extensions WHERE node_id=$1 AND id=$2',
          [node, extension],
        )
      ).rows[0] ?? null
    );
  }
  async active(s: ReadSnapshot, extension: string) {
    return (
      (
        await s.query<CredentialOperation>(
          `${select} WHERE extension_id=$1 AND state IN ('queued','retrying','needs_reconciliation')`,
          [extension],
        )
      ).rows[0] ?? null
    );
  }
  async generation(s: ReadSnapshot, extension: string, generation: string) {
    return (
      (
        await s.query<CredentialOperation>(
          `${select} WHERE extension_id=$1 AND generation_id=$2 AND state='associated'`,
          [extension, generation],
        )
      ).rows[0] ?? null
    );
  }
  async dependencies(tx: Transaction, node: string, installation: string) {
    const n = (
      await tx.query<{ version: number }>(
        'SELECT version FROM public.pbx_nodes WHERE id=$1 AND installation_id=$2 FOR SHARE',
        [node, installation],
      )
    ).rows[0];
    const c = (
      await tx.query<{
        revision: number;
        credential_auth_max: number | null;
        credential_hex_max: number | null;
      }>(
        'SELECT revision,credential_auth_max,credential_hex_max FROM public.endpoint_capabilities WHERE installation_id=$1 FOR SHARE',
        [installation],
      )
    ).rows[0];
    return n && c
      ? {
          nodeVersion: n.version,
          capabilityRevision: c.revision,
          compatible:
            (c.credential_auth_max ?? 0) >= 71 &&
            (c.credential_hex_max ?? 0) >= 64,
        }
      : null;
  }
  async reserve(tx: Transaction, data: CredentialReservation) {
    const ordinal = (
      await tx.query<{ ordinal: number }>(
        'SELECT COALESCE(max(ordinal),0)+1 AS ordinal FROM public.endpoint_credential_operations WHERE extension_id=$1',
        [data.extension],
      )
    ).rows[0]!.ordinal;
    await tx.query(
      `INSERT INTO public.endpoint_credential_operations
      (id,request_id,operator_id,authentication_version,action,node_id,extension_id,installation_id,expected_version,expected_generation_id,node_version,capability_revision,generation_id,ordinal,fingerprint,correlation_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        data.id,
        data.request,
        data.operator,
        data.authenticationVersion,
        data.action,
        data.node,
        data.extension,
        data.installation,
        data.expectedVersion,
        data.expectedGeneration,
        data.nodeVersion,
        data.capabilityRevision,
        data.generation,
        ordinal,
        data.fingerprint,
        data.correlation,
      ],
    );
    return (await this.operation(tx, data.id))!;
  }
  async terminal(
    tx: Transaction,
    operation: CredentialOperation,
    state: 'associated' | 'cancelled' | 'conflict' | 'failed',
    failure: EndpointCredentialFailure | null,
  ) {
    await tx.query(
      `UPDATE public.endpoint_credential_operations SET state=$2,failure_code=$3,terminal_at=clock_timestamp(),associated_at=CASE WHEN $2='associated' THEN clock_timestamp() END,resulting_version=CASE WHEN $2='associated' THEN expected_version+1 END,cleanup_state=CASE WHEN $2='associated' THEN 'retained' ELSE 'cleanup_required' END WHERE id=$1 AND terminal_at IS NULL`,
      [operation.id, state, failure],
    );
    const row = (await this.operation(tx, operation.id))!;
    const dto = operationDto(row);
    await tx.query(
      'UPDATE public.endpoint_credential_operations SET result=$2 WHERE id=$1',
      [operation.id, dto],
    );
    return dto;
  }
}
