// Private server-only verifier result. Never export through snapshots or clients.
export interface CredentialMaterial {
  passwordHash: string;
  authenticationVersion: number;
}
export interface StaffCredentialRead {
  read(input: {
    plane: 'tenant';
    tenantId: string;
    staffId: string;
  }): Promise<
    | { kind: 'ready'; credential: CredentialMaterial }
    | { kind: 'denied' | 'unavailable' }
  >;
}
