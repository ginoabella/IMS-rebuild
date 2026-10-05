import type { ReadSnapshot } from '../../../../infrastructure/database/read-snapshot';
import type { TenantAdmissionRead } from '../../../identity/application/authority-read';
export class TenantAdmissionRepository implements TenantAdmissionRead {
  async byCode(snapshot: ReadSnapshot, code: string): Promise<unknown> {
    return this.read(snapshot, 'normalized_code', code);
  }
  async byId(snapshot: ReadSnapshot, tenantId: string): Promise<unknown> {
    return this.read(snapshot, 'id', tenantId);
  }
  private async read(
    snapshot: ReadSnapshot,
    column: 'id' | 'normalized_code',
    value: string,
  ): Promise<unknown> {
    const result = await snapshot.query(
      `SELECT id,status,version,authority_version FROM public.tenants WHERE ${column}=$1`,
      [value],
    );
    return result.rows[0] ?? null;
  }
}
