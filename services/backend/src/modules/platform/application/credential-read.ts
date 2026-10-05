import type { CredentialMaterial } from '../../identity/application/credential-read';
export interface PlatformCredentialRead {
  read(input: {
    plane: 'platform';
    operatorId: string;
  }): Promise<
    | { kind: 'ready'; credential: CredentialMaterial }
    | { kind: 'denied' | 'unavailable' }
  >;
}
