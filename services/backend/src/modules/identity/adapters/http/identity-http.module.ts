import { StaffSignIn } from '../../application/sign-in';
import { StaffLogout } from '../../application/logout';
import { StaffCurrentSession } from '../../application/current-session';
import {
  STAFF_AUTHENTICATION_PORTS,
  type StaffAuthenticationPorts,
} from '../../application/authentication-ports';
import { StaffAuthController } from './staff-auth.controller';
import { StaffMobile } from './staff-mobile';
import { CredentialRuntime } from '../db/credential-runtime';
import { CredentialActions } from '../../application/credential-actions';
import { CredentialExchangeController } from './credential-exchange.controller';
import { StaffCredentialActionsController } from './staff-credential-actions.controller';
import { CredentialExchangeBrowser } from './credential-browser';
import { StaffIssuerBrowser } from './credential-browser';
import { PlatformBrowser } from './platform-browser';
import { PLATFORM_AUTHENTICATION_PORTS } from '../../../platform/application/authentication-ports';
import { Admission } from '../../application/admission';
import { TrustedSource } from './trusted-source';
import {
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { BackendConfig } from '@myims/config';
import { TransactionAuthority } from '../../application/transaction-authority';
import { RequestAuthority } from '../../application/request-authority';
import { sessionRuntime } from '../session/runtime';
import { AuthorityGuard, ActivityInterceptor } from './guards';
class SessionShutdown implements OnApplicationShutdown {
  constructor(private readonly close: () => Promise<void>) {}
  onApplicationShutdown() {
    return this.close();
  }
}
@Module({})
export class IdentityHttpModule {
  static register(config: BackendConfig): DynamicModule {
    const runtime = Symbol('HTTP_SESSION_RUNTIME');
    return {
      module: IdentityHttpModule,
      controllers: [
        StaffAuthController,
        CredentialExchangeController,
        StaffCredentialActionsController,
      ],
      providers: [
        StaffCurrentSession,
        {
          provide: StaffMobile,
          useFactory: () => new StaffMobile(config.staffIssuer),
        },
        {
          provide: STAFF_AUTHENTICATION_PORTS,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) => ({
            candidates: r.staff,
            credentials: r.staffCredentials,
          }),
        },
        {
          provide: StaffSignIn,
          inject: [Admission, RequestAuthority, STAFF_AUTHENTICATION_PORTS],
          useFactory: (
            admission: Admission,
            authority: RequestAuthority,
            ports: StaffAuthenticationPorts,
          ) =>
            new StaffSignIn(
              admission,
              ports.candidates,
              ports.credentials,
              authority.lifecycle,
            ),
        },
        {
          provide: StaffLogout,
          inject: [RequestAuthority, Admission],
          useFactory: (authority: RequestAuthority, admission: Admission) =>
            new StaffLogout(authority, admission),
        },
        {
          provide: CredentialRuntime,
          useFactory: () => new CredentialRuntime(config),
        },
        {
          provide: CredentialActions,
          inject: [CredentialRuntime],
          useFactory: (r: CredentialRuntime) => r.service,
        },
        {
          provide: CredentialExchangeBrowser,
          useFactory: () =>
            new CredentialExchangeBrowser(config.credentialExchange),
        },
        {
          provide: StaffIssuerBrowser,
          useFactory: () => new StaffIssuerBrowser(config.staffIssuer),
        },
        {
          provide: PlatformBrowser,
          useFactory: () => new PlatformBrowser(config.platformAuth),
        },
        {
          provide: PLATFORM_AUTHENTICATION_PORTS,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) => ({
            candidates: r.platform,
            credentials: r.platformCredentials,
          }),
        },
        {
          provide: Admission,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) =>
            r.admission,
        },
        {
          provide: TrustedSource,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) =>
            r.source,
        },
        { provide: runtime, useFactory: () => sessionRuntime(config, false) },
        {
          provide: RequestAuthority,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) =>
            r.authority,
        },
        {
          provide: TransactionAuthority,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) =>
            r.transactionAuthority,
        },
        {
          provide: SessionShutdown,
          inject: [runtime],
          useFactory: (r: Awaited<ReturnType<typeof sessionRuntime>>) =>
            new SessionShutdown(r.close),
        },
        { provide: APP_GUARD, useClass: AuthorityGuard },
        { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
      ],
      exports: [
        CredentialActions,
        StaffIssuerBrowser,
        PlatformBrowser,
        PLATFORM_AUTHENTICATION_PORTS,
        RequestAuthority,
        TransactionAuthority,
        Admission,
        TrustedSource,
      ],
    };
  }
}
