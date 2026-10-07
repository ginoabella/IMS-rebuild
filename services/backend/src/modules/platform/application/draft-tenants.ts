import { createHash, randomUUID } from 'node:crypto';
import type {
  TenantDetailDto,
  TenantListDto,
  TenantSummaryDto,
} from '@myims/contracts';
import type {
  ReadSnapshot,
  SnapshotDatabase,
} from '../../../infrastructure/database/read-snapshot';
import type { Transaction } from '../../../infrastructure/database/transaction';
import type { ExecutionContext } from '../../../infrastructure/execution/context';
import {
  principalActor,
  type Principal,
} from '../../identity/application/request-authority';
import type { TransactionAuthority } from '../../identity/application/transaction-authority';
import { uuid } from '../../identity/domain/storage';
import type { TenantRecord } from '../../tenancy/domain/tenant-record';
import type {
  DraftCreationReceipts,
  DraftTenantRegistry,
  FirstAdministrator,
} from './draft-tenant-ports';
import {
  draftTenantInput,
  invalidReference,
  tenantListInput,
  type FieldErrors,
} from './draft-tenant-input';
export interface DraftTenantTransactions {
  run<T>(
    context: ExecutionContext,
    action: (tx: Transaction) => Promise<T>,
  ): Promise<T>;
}
export type DraftTenantFailure =
  | { kind: 'invalid'; fieldErrors: FieldErrors }
  | { kind: 'denied' | 'unavailable' | 'missing' }
  | { kind: 'conflict'; reason: 'tenant_code_conflict' | 'request_conflict' };
class RejectedCreation extends Error {
  constructor(readonly outcome: DraftTenantFailure) {
    super('Draft creation rejected');
  }
}
function summary(row: TenantRecord): TenantSummaryDto {
  return {
    id: row.id,
    tenantCode: row.normalized_code,
    displayName: row.display_name,
    status: row.status,
  };
}
export class DraftTenants {
  constructor(
    private readonly transactions: DraftTenantTransactions,
    private readonly database: SnapshotDatabase,
    private readonly authority: TransactionAuthority,
    private readonly tenants: DraftTenantRegistry,
    private readonly administrators: FirstAdministrator,
    private readonly receipts: DraftCreationReceipts,
  ) {}
  async create(
    principal: Principal,
    input: unknown,
    correlationId: string,
  ): Promise<
    | DraftTenantFailure
    | { kind: 'created' | 'replayed'; value: TenantDetailDto }
  > {
    if (
      principal.plane !== 'platform' ||
      !principal.grants.includes('platform_operator')
    )
      return { kind: 'denied' };
    const parsed = draftTenantInput(input);
    if (parsed.kind !== 'valid') return parsed;
    const data = parsed.value;
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          data.tenantCode,
          data.displayName,
          data.administratorUsername,
        ]),
      )
      .digest('hex');
    const tenantId = randomUUID(),
      staffId = randomUUID();
    try {
      const outcome = await this.transactions.run(
        {
          actor: principalActor(principal),
          correlationId,
          target: { type: 'tenant', reference: tenantId, tenantId: null },
        },
        async (tx) => {
          if (!(await this.authority.validate(tx, principal)))
            throw new RejectedCreation({ kind: 'denied' });
          const receipt = await this.receipts.inspect(
            tx,
            principal.operatorId,
            data.requestId,
          );
          if (receipt) {
            if (receipt.fingerprint !== fingerprint)
              throw new RejectedCreation({
                kind: 'conflict',
                reason: 'request_conflict',
              });
            return { kind: 'replayed' as const, tenantId: receipt.tenant_id };
          }
          const tenant = await this.tenants.createDraft(tx, {
            id: tenantId,
            code: data.tenantCode,
            displayName: data.displayName,
          });
          if (tenant.kind !== 'found')
            throw new RejectedCreation(
              tenant.kind === 'duplicate'
                ? { kind: 'conflict', reason: 'tenant_code_conflict' }
                : { kind: 'unavailable' },
            );
          const administrator = await tx.withStaffCreationTarget(
            staffId,
            (scoped) =>
              this.administrators.create(scoped, {
                id: staffId,
                tenantId,
                username: data.administratorUsername,
              }),
          );
          if (administrator.kind !== 'found')
            throw new RejectedCreation({ kind: 'unavailable' });
          await this.receipts.save(tx, principal.operatorId, data.requestId, {
            fingerprint,
            tenant_id: tenantId,
            staff_id: staffId,
          });
          return { kind: 'created' as const, tenantId };
        },
      );
      // Only the outer runner can acknowledge COMMIT. Read live canonical values.
      const value = await this.database.read((snapshot) =>
        this.readDetail(snapshot, outcome.tenantId),
      );
      if (!value) return { kind: 'unavailable' };
      return { kind: outcome.kind, value };
    } catch (error) {
      return error instanceof RejectedCreation
        ? error.outcome
        : { kind: 'unavailable' };
    }
  }
  async list(
    input: unknown,
  ): Promise<DraftTenantFailure | { kind: 'found'; value: TenantListDto }> {
    const parsed = tenantListInput(input);
    if (parsed.kind !== 'valid') return parsed;
    try {
      const { limit, after } = parsed.value;
      const rows = await this.database.read((snapshot) =>
        this.tenants.list(snapshot, limit + 1, after),
      );
      const items = rows.slice(0, limit).map(summary);
      return {
        kind: 'found',
        value: {
          items,
          nextCursor:
            rows.length > limit ? (items[items.length - 1]?.id ?? null) : null,
        },
      };
    } catch {
      return { kind: 'unavailable' };
    }
  }
  async detail(
    id: unknown,
  ): Promise<DraftTenantFailure | { kind: 'found'; value: TenantDetailDto }> {
    if (!uuid(id)) return invalidReference('tenantId');
    try {
      const value = await this.database.read((snapshot) =>
        this.readDetail(snapshot, id),
      );
      return value ? { kind: 'found', value } : { kind: 'missing' };
    } catch {
      return { kind: 'unavailable' };
    }
  }
  private async readDetail(
    snapshot: ReadSnapshot,
    id: string,
  ): Promise<TenantDetailDto | null> {
    const row = await this.tenants.byId(snapshot, id);
    if (!row) return null;
    const staffId = await this.receipts.linked(snapshot, id);
    const staff = staffId
      ? await this.administrators.read(snapshot, id, staffId)
      : null;
    if (staffId && !staff) throw new Error('Unavailable linked administrator');
    return {
      tenant: {
        ...summary(row),
        version: row.version,
        authorityVersion: row.authority_version,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      },
      administrator: staff
        ? {
            kind: 'available',
            id: staff.id,
            tenantId: staff.tenant_id,
            username: staff.normalized_username,
            roles: staff.roles,
            status: staff.status,
            credentialState: staff.credential_state,
          }
        : { kind: 'unavailable' },
    };
  }
}
