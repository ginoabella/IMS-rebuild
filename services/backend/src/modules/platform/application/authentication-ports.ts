import type { PlatformAuthorityRead } from './authority-read';
import type { PlatformCredentialRead } from './credential-read';
export const PLATFORM_AUTHENTICATION_PORTS = Symbol(
  'PLATFORM_AUTHENTICATION_PORTS',
);
export interface PlatformAuthenticationPorts {
  candidates: PlatformAuthorityRead;
  credentials: PlatformCredentialRead;
}
