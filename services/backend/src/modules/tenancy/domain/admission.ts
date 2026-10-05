import { uuid } from '../../identity/domain/storage';
export function authorityVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}
export interface TenantAdmissionFacts {
  id: string;
  status: 'draft' | 'active' | 'suspended' | 'retired';
  version: number;
  authority_version: number;
}
export function ordinaryAdmission(
  input: unknown,
): input is TenantAdmissionFacts {
  if (!input || typeof input !== 'object') return false;
  const row = input as Record<string, unknown>;
  return (
    uuid(row.id) &&
    row.status === 'active' &&
    authorityVersion(row.version) &&
    authorityVersion(row.authority_version)
  );
}
