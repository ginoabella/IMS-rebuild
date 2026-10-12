export interface StaffSignInDto {
  tenantCode: string;
  username: string;
  password: string;
}
export interface StaffSessionDto {
  plane: 'tenant';
  tenantId: string;
  staffId: string;
  roles: readonly (
    'tenant_admin' | 'call_taker' | 'dispatcher' | 'responder'
  )[];
  consumer: 'web' | 'mobile';
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}
export interface StaffBrowserSessionDto extends StaffSessionDto {
  proof: string;
}
export interface StaffMobileSignInDto extends StaffSessionDto {
  token: string;
}
/** c implements this on native protected storage; never browser storage. */
export interface StaffSecureStorage {
  save(token: string): Promise<'stored' | 'failed' | 'uncertain'>;
  read(): Promise<
    { kind: 'found'; token: string } | { kind: 'absent' | 'unavailable' }
  >;
  clear(): Promise<'cleared' | 'failed' | 'uncertain'>;
}
