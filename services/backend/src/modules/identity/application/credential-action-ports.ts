import type { Transaction } from '../../../infrastructure/database/transaction';
import type { AuthorityResult, PlatformAuthority } from '../domain/authority';
export interface CredentialTenant {
  id: string;
  status: string;
  authority_version: number;
  version: number;
}
// Caller-owned ports keep tenancy/provenance SQL in their canonical owners.
export interface CredentialTenancy {
  lock(tx: Transaction, tenantId: string): Promise<CredentialTenant | null>;
}
export interface CredentialProvenance {
  linked(tx: Transaction, tenantId: string): Promise<string | null>;
}
export interface CredentialOperator {
  lockedById(
    tx: Transaction,
    operatorId: string,
  ): Promise<AuthorityResult<PlatformAuthority>>;
}

import type { Principal } from './request-authority';
import type {
  CredentialAction,
  CredentialPurpose,
} from '../domain/credential-action';
import type { ExecutionContext } from '../../../infrastructure/execution/context';
export interface CredentialTarget {
  id: string;
  tenant_id: string;
  roles: string[];
  status: string;
  credential_state: string;
  version: number;
  authentication_version: number;
  credential_coherent: boolean;
}
export interface QualifiedCredentialTarget {
  target: CredentialTarget;
  tenant: CredentialTenant;
}
export interface CredentialActionStore {
  now(tx: Transaction): Promise<Date>;
  linked(tx: Transaction, tenantId: string): Promise<string | null>;
  managementTarget(
    tx: Transaction,
    tenantId: string,
    actionId: string,
  ): Promise<{ tenant_id: string; staff_id: string } | null>;
  qualify(
    tx: Transaction,
    p: Principal,
    tenantId: string,
    staffId: string,
    purpose: CredentialPurpose,
  ): Promise<QualifiedCredentialTarget | null>;
  find(
    tx: Transaction,
    key: string,
    by: 'lookup_hash' | 'id',
  ): Promise<CredentialAction | null>;
  pending(
    tx: Transaction,
    tenantId: string,
    staffId: string,
  ): Promise<CredentialAction | null>;
  latest(
    tx: Transaction,
    tenantId: string,
    staffId: string,
  ): Promise<CredentialAction | null>;
  insert(tx: Transaction, a: CredentialAction): Promise<void>;
  terminal(
    tx: Transaction,
    a: CredentialAction,
    state: 'consumed' | 'cancelled',
  ): Promise<void>;
  audit(
    tx: Transaction,
    a: CredentialAction,
    operation: 'issued' | 'reissued' | 'cancelled' | 'consumed',
  ): Promise<string>;
  valid(
    tx: Transaction,
    a: CredentialAction,
  ): Promise<QualifiedCredentialTarget | null>;
  replace(tx: Transaction, a: CredentialAction, hash: string): Promise<void>;
  clean(tx: Transaction, limit: number): Promise<number>;
  context(
    p: Principal,
    tenantId: string,
    staffId: string,
    correlationId: string,
  ): ExecutionContext;
}
