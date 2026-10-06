import { HttpAccess } from '../../modules/identity/adapters/http/policy';
import type { LivenessResponse } from '@myims/contracts';
import {
  Controller,
  Inject,
  Get,
  Header,
  Module,
  ServiceUnavailableException,
  type DynamicModule,
} from '@nestjs/common';
import type { BackendConfig } from '@myims/config';
import { BACKEND_CONFIG, SharedServices } from './shared-services';
@HttpAccess({ access: 'public' })
@Controller('health')
class HealthController {
  constructor(
    @Inject(SharedServices) private readonly services: SharedServices,
  ) {}
  @Get('live')
  @Header('Cache-Control', 'no-store')
  live(): LivenessResponse {
    return { status: 'alive' };
  }
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    const result = await this.services.readiness();
    if (result.status !== 'ready')
      throw new ServiceUnavailableException(result);
    return result;
  }
}
@Module({})
export class HealthModule {
  static register(config: BackendConfig): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        { provide: BACKEND_CONFIG, useValue: config },
        SharedServices,
      ],
    };
  }
}
