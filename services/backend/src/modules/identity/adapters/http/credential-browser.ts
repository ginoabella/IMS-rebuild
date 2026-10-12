import type { PlatformAuthConfig } from '@myims/config';
import { singleHeader } from './platform-browser';
import { httpFailure } from './http-errors';
import type { SourceRequest } from './trusted-source';
import { PlatformBrowser } from './platform-browser';
export class StaffIssuerBrowser extends PlatformBrowser {
  override cookies(request: SourceRequest) {
    try {
      return super.cookies(request);
    } catch {
      throw httpFailure(403);
    }
  }
  override boundary(request: SourceRequest) {
    if (singleHeader(request, 'x-staff-mobile-proxy') !== undefined)
      throw httpFailure(403);
    super.boundary(request);
  }
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
