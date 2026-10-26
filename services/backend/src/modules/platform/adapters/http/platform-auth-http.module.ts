import { LiveController } from '../../../telephony/adapters/http/live.controller';
import { PbxLive } from '../../../telephony/application/pbx-live';
import { RevisionsController } from '../../../telephony/adapters/http/revisions.controller';
import { PbxRevisions } from '../../../telephony/application/pbx-revisions';
import { RoutingController } from '../../../telephony/adapters/http/routing.controller';
import { Routing } from '../../../telephony/application/routing';
import { PeersController } from '../../../telephony/adapters/http/peers.controller';
import { Peers } from '../../../telephony/application/peers';
import { FilePbxCatalog } from '../../../telephony/adapters/connectivity/catalog';
import { EndpointCredentialsController } from '../../../telephony/adapters/http/endpoint-credentials.controller';
import { EndpointCredentialRuntime } from '../../../telephony/adapters/db/endpoint-credential-runtime';
import { EndpointCredentials } from '../../../telephony/application/endpoint-credentials';
import { InventoryController } from '../../../telephony/adapters/http/inventory.controller';
import { InventoryRuntime } from '../../../telephony/adapters/db/inventory-runtime';
import { ExtensionInventory } from '../../../telephony/application/extension-inventory';
import { PbxController } from '../../../telephony/adapters/http/pbx.controller';
import { PbxRuntime } from '../../../telephony/adapters/db/pbx-runtime';
import { PbxNodes } from '../../../telephony/application/pbx-nodes';
import { PlatformCredentialActionsController } from './credential-actions.controller';
import { PlatformTenantsController } from './tenants.controller';
import { DraftTenants } from '../../application/draft-tenants';
import { DraftTenantRuntime } from '../db/draft-tenant-runtime';
import { TransactionAuthority } from '../../../identity/application/transaction-authority';
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
      controllers: [
        LiveController,
        PbxController,
        InventoryController,
        PeersController,
        RoutingController,
        RevisionsController,
        EndpointCredentialsController,
        PlatformAuthController,
        PlatformTenantsController,
        PlatformCredentialActionsController,
      ],
      providers: [
        {
          provide: PbxLive,
          inject: [InventoryRuntime],
          useFactory: (runtime: InventoryRuntime) => runtime.live,
        },
        {
          provide: PbxRevisions,
          inject: [InventoryRuntime],
          useFactory: (runtime: InventoryRuntime) => runtime.revisions,
        },
        {
          provide: Routing,
          inject: [InventoryRuntime],
          useFactory: (runtime: InventoryRuntime) => runtime.routing,
        },
        {
          provide: Peers,
          inject: [InventoryRuntime],
          useFactory: (runtime: InventoryRuntime) => runtime.peers,
        },
        PlatformCurrentSession,
        {
          provide: EndpointCredentialRuntime,
          inject: [TransactionAuthority, ExtensionInventory],
          useFactory: (
            authority: TransactionAuthority,
            inventory: ExtensionInventory,
          ) =>
            new EndpointCredentialRuntime(
              config.database.url,
              authority,
              inventory,
            ),
        },
        {
          provide: EndpointCredentials,
          inject: [EndpointCredentialRuntime],
          useFactory: (runtime: EndpointCredentialRuntime) => runtime.service,
        },
        {
          provide: InventoryRuntime,
          inject: [TransactionAuthority],
          useFactory: (authority: TransactionAuthority) =>
            new InventoryRuntime(
              config.database.url,
              authority,
              undefined,
              (installationId) =>
                new FilePbxCatalog(config.pbxCatalogFile).reservedSources(
                  installationId,
                ),
            ),
        },
        {
          provide: ExtensionInventory,
          inject: [InventoryRuntime],
          useFactory: (runtime: InventoryRuntime) => runtime.service,
        },
        {
          provide: PbxRuntime,
          inject: [TransactionAuthority],
          useFactory: (authority: TransactionAuthority) =>
            new PbxRuntime(
              config.database.url,
              authority,
              config.pbxCatalogFile,
            ),
        },
        {
          provide: PbxNodes,
          inject: [PbxRuntime],
          useFactory: (runtime: PbxRuntime) => runtime.service,
        },
        {
          provide: DraftTenantRuntime,
          inject: [TransactionAuthority],
          useFactory: (authority: TransactionAuthority) =>
            new DraftTenantRuntime(config.database.url, authority),
        },
        {
          provide: DraftTenants,
          inject: [DraftTenantRuntime],
          useFactory: (runtime: DraftTenantRuntime) => runtime.service,
        },
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
