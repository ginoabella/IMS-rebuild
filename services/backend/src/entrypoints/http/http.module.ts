import type { BackendConfig } from '@myims/config';
import { HealthModule } from '../../infrastructure/health/health.module';
import { Controller, Get, Module, type DynamicModule } from '@nestjs/common';

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
    return { module: HttpModule, imports: [HealthModule.register(config)] };
  }
}
