import type { ReadSnapshot } from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { CredentialOperation } from '../domain/credential-operation';
export interface CredentialReservation {
  id: string;
  request: string;
  operator: string;
  authenticationVersion: number;
  action: string;
  node: string;
  extension: string;
  installation: string;
  expectedVersion: number;
  expectedGeneration: string | null;
  nodeVersion: number;
  capabilityRevision: number;
  generation: string;
  fingerprint: string;
  correlation: string;
}
export interface CredentialStore {
  operation(s: ReadSnapshot, id: string): Promise<CredentialOperation | null>;
  receipt(
    tx: Transaction,
    operator: string,
    action: string,
    request: string,
  ): Promise<CredentialOperation | null>;
  current(
    s: ReadSnapshot,
    node: string,
    extension: string,
  ): Promise<{
    installation_id: string;
    credential_generation_id: string | null;
    version: number;
  } | null>;
  active(
    s: ReadSnapshot,
    extension: string,
  ): Promise<CredentialOperation | null>;
  generation(
    s: ReadSnapshot,
    extension: string,
    generation: string,
  ): Promise<CredentialOperation | null>;
  dependencies(
    tx: Transaction,
    node: string,
    installation: string,
  ): Promise<{
    nodeVersion: number;
    capabilityRevision: number;
    compatible: boolean;
  } | null>;
  reserve(
    tx: Transaction,
    data: CredentialReservation,
  ): Promise<CredentialOperation>;
}
