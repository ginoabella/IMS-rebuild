import type {
  EndpointCredentialOperationDto,
  EndpointCredentialState,
  EndpointCredentialFailure,
} from '@myims/contracts';
import type { CredentialBinding } from '../application/credential-ports';
export interface CredentialOperation {
  id: string;
  request_id: string;
  operator_id: string;
  authentication_version: number;
  action: 'setup' | 'reset';
  node_id: string;
  extension_id: string;
  installation_id: string;
  expected_version: number;
  expected_generation_id: string | null;
  node_version: number;
  capability_revision: number;
  generation_id: string;
  ordinal: number;
  fingerprint: string;
  correlation_id: string;
  work_id: string | null;
  state: EndpointCredentialState;
  failure_code: EndpointCredentialFailure | null;
  attempts: number;
  budget: number;
  material_health: 'unknown' | 'verified' | 'unavailable';
  verified_at: Date | null;
  created_at: Date;
  terminal_at: Date | null;
  associated_at: Date | null;
  resulting_version: number | null;
  result: EndpointCredentialOperationDto | null;
  cleanup_state: 'retained' | 'cleanup_required' | 'destroyed' | 'absent';
  cleanup_attempts: number;
  expired: boolean;
}
export function binding(row: CredentialOperation): CredentialBinding {
  return {
    installationId: row.installation_id,
    extensionId: row.extension_id,
    operationId: row.id,
    generationId: row.generation_id,
  };
}
export function operationDto(
  row: CredentialOperation,
): EndpointCredentialOperationDto {
  return (
    row.result ?? {
      operationId: row.id,
      intentId: row.request_id,
      nodeId: row.node_id,
      extensionId: row.extension_id,
      action: row.action,
      state: row.state,
      expectedVersion: row.expected_version,
      resultingVersion: row.resulting_version,
      generationId: row.generation_id,
      generationOrdinal: row.ordinal,
      createdAt: row.created_at.toISOString(),
      completedAt: row.terminal_at?.toISOString() ?? null,
      retryable: row.state === 'queued' || row.state === 'retrying',
      failure: row.failure_code,
    }
  );
}
