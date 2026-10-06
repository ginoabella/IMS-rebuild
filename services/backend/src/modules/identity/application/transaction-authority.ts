import type { Transaction } from '../../../infrastructure/database/transaction';
import type {
  AuthorityResult,
  StaffAuthority,
  PlatformAuthority,
} from '../domain/authority';
import type { Principal } from './request-authority';
export interface TenantAuthorityLock {
  lockedById(transaction: Transaction, tenantId: string): Promise<unknown>;
}
export interface StaffAuthorityLock {
  lockedById(
    transaction: Transaction,
    tenantId: string,
    staffId: string,
  ): Promise<AuthorityResult<StaffAuthority>>;
}
export interface PlatformAuthorityLock {
  lockedById(
    transaction: Transaction,
    operatorId: string,
  ): Promise<AuthorityResult<PlatformAuthority>>;
}
// Owners retain SHARE locks until the caller commits its sensitive write. Use
// tenant -> staff order; all participating multi-row mutations must use that order.
export class TransactionAuthority {
  constructor(
    private readonly staff: StaffAuthorityLock,
    private readonly platform: PlatformAuthorityLock,
  ) {}
  async validate(
    transaction: Transaction,
    expected: Principal,
  ): Promise<boolean> {
    if (expected.plane === 'platform') {
      const result = await this.platform.lockedById(
        transaction,
        expected.operatorId,
      );
      return (
        result.kind === 'eligible' &&
        result.snapshot.authenticationVersion === expected.authenticationVersion
      );
    }
    const result = await this.staff.lockedById(
      transaction,
      expected.tenantId,
      expected.staffId,
    );
    return (
      result.kind === 'eligible' &&
      result.snapshot.authenticationVersion ===
        expected.authenticationVersion &&
      result.snapshot.tenantAuthorityVersion === expected.tenantAuthorityVersion
    );
  }
}
