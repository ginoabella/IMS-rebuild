import { HttpAccess } from '../../modules/identity/adapters/http/policy';
import { IdentityHttpModule } from '../../modules/identity/adapters/http/identity-http.module';
import type { BackendConfig } from '@myims/config';
import { HealthModule } from '../../infrastructure/health/health.module';
import { Controller, Get, Module, type DynamicModule } from '@nestjs/common';

@HttpAccess({ access: 'public' })
@Controller()
class FoundationController {
  @Get()
  foundation() {
    return { application: 'MyIMS', status: 'foundation', operational: false };
  }
}

@Module({ controllers: [FoundationController] })
export class HttpModule {
  static register(config: BackendConfig): DynamicModule {
    return {
      module: HttpModule,
      imports: [
        HealthModule.register(config),
        IdentityHttpModule.register(config),
      ],
    };
  }
}
