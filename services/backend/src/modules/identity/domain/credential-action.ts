import type { DataContract } from '../../../infrastructure/execution/context';
export type CredentialPurpose = 'setup' | 'reset';
export type VerificationMethod = 'in_person' | 'known_contact_call';
export interface CredentialAction {
  id: string;
  lookup_hash: string;
  tenant_id: string;
  staff_id: string;
  purpose: CredentialPurpose;
  target_version: number;
  target_authentication_version: number;
  tenant_authority_version: number;
  issuer_plane: 'platform' | 'tenant';
  issuer_operator_id: string | null;
  issuer_staff_id: string | null;
  issuer_tenant_id: string | null;
  issuer_authentication_version: number;
  verification_method: VerificationMethod;
  issued_at: Date;
  expires_at: Date;
  state: 'pending' | 'consumed' | 'cancelled';
  terminal_at: Date | null;
}
export const credentialEvent: DataContract = {
  type: 'identity.credential-action',
  version: 1,
  fields: {
    operation: {
      kind: 'enum',
      values: ['issued', 'reissued', 'cancelled', 'consumed'],
    },
    purpose: { kind: 'enum', values: ['setup', 'reset'] },
    method: { kind: 'enum', values: ['in_person', 'known_contact_call'] },
    actionId: { kind: 'uuid' },
    issuerId: { kind: 'uuid' },
    issuerPlane: { kind: 'enum', values: ['platform', 'tenant'] },
  },
};
export function actionDto(a: CredentialAction, now: Date) {
  return {
    id: a.id,
    purpose: a.purpose,
    state: a.state === 'pending' && a.expires_at <= now ? 'expired' : a.state,
    issuedAt: a.issued_at.toISOString(),
    expiresAt: a.expires_at.toISOString(),
  };
}
