import type { StaffAuthorityRead } from './authority-read';
import type { StaffCredentialRead } from './credential-read';
export const STAFF_AUTHENTICATION_PORTS = Symbol('STAFF_AUTHENTICATION_PORTS');
export interface StaffAuthenticationPorts {
  candidates: StaffAuthorityRead;
  credentials: StaffCredentialRead;
}
