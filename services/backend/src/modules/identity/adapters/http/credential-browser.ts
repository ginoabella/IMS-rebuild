import type { PlatformAuthConfig } from '@myims/config';
import { PlatformBrowser } from './platform-browser';
export class StaffIssuerBrowser extends PlatformBrowser {
  constructor(config?: PlatformAuthConfig) {
    super(config, {
      cookie: '__Host-myims-staff',
      context: '__Host-myims-staff-csrf',
      proxy: 'x-staff-proxy',
      csrf: 'x-staff-csrf',
    });
  }
}
export class CredentialExchangeBrowser extends PlatformBrowser {
  constructor(config?: PlatformAuthConfig) {
    super(config, {
      cookie: '__Host-myims-exchange-none',
      context: '__Host-myims-exchange-csrf',
      proxy: 'x-credential-proxy',
      csrf: 'x-credential-csrf',
    });
  }
}
