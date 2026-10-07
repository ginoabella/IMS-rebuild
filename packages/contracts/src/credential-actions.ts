export type CredentialPurpose = 'setup' | 'reset';
export type VerificationMethod = 'in_person' | 'known_contact_call';
export interface IssueCredentialActionDto {
  operation: 'issue' | 'reissue';
  purpose: CredentialPurpose;
  verificationMethod: VerificationMethod;
}
export interface CredentialActionDto {
  id: string;
  purpose: CredentialPurpose;
  state: 'pending' | 'consumed' | 'cancelled' | 'expired';
  issuedAt: string;
  expiresAt: string;
}
export interface IssuedCredentialActionDto {
  action: CredentialActionDto;
  capability: string;
}
export interface CredentialActionStatusDto {
  credentialState: 'unset' | 'ready';
  action: CredentialActionDto | null;
}
export function credentialActionDto(
  value: unknown,
): value is CredentialActionDto {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      v.id,
    ) &&
    typeof v.purpose === 'string' &&
    ['setup', 'reset'].includes(v.purpose) &&
    typeof v.state === 'string' &&
    ['pending', 'consumed', 'cancelled', 'expired'].includes(v.state) &&
    typeof v.issuedAt === 'string' &&
    Number.isFinite(Date.parse(v.issuedAt)) &&
    typeof v.expiresAt === 'string' &&
    Number.isFinite(Date.parse(v.expiresAt))
  );
}
