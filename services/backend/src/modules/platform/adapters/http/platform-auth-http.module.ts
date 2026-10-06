import { PlatformLogout } from '../../application/logout';
import { PlatformCurrentSession } from '../../application/current-session';
import { Module, type DynamicModule } from '@nestjs/common';
import type { BackendConfig } from '@myims/config';
import { IdentityHttpModule } from '../../../identity/adapters/http/identity-http.module';
import { Admission } from '../../../identity/application/admission';
import { RequestAuthority } from '../../../identity/application/request-authority';
import { PlatformSignIn } from '../../application/sign-in';
import {
  PLATFORM_AUTHENTICATION_PORTS,
  type PlatformAuthenticationPorts,
} from '../../application/authentication-ports';
import { PlatformAuthController } from './auth.controller';
@Module({})
export class PlatformAuthHttpModule {
  static register(config: BackendConfig): DynamicModule {
    return {
      module: PlatformAuthHttpModule,
      imports: [IdentityHttpModule.register(config)],
      controllers: [PlatformAuthController],
      providers: [
        PlatformCurrentSession,
        {
          provide: PlatformLogout,
          inject: [RequestAuthority, Admission],
          useFactory: (authority: RequestAuthority, admission: Admission) =>
            new PlatformLogout(authority, admission),
        },
        {
          provide: PlatformSignIn,
          inject: [Admission, RequestAuthority, PLATFORM_AUTHENTICATION_PORTS],
          useFactory: (
            admission: Admission,
            authority: RequestAuthority,
            ports: PlatformAuthenticationPorts,
          ) =>
            new PlatformSignIn(
              admission,
              ports.candidates,
              ports.credentials,
              authority.lifecycle,
            ),
        },
      ],
    };
  }
}
