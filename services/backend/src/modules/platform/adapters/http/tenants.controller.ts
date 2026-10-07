import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { TenantApiErrorDto } from '@myims/contracts';
import { correlationId } from '../../../../infrastructure/execution/context';
import {
  requestPrincipal,
  httpFailure,
} from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import {
  DraftTenants,
  type DraftTenantFailure,
} from '../../application/draft-tenants';
interface Response {
  statusCode: number;
  setHeader(name: string, value: string): void;
}
function failure(result: DraftTenantFailure, response: Response): never {
  if (result.kind === 'invalid')
    throw new HttpException(
      {
        statusCode: 400,
        message: 'Invalid tenant request',
        fieldErrors: result.fieldErrors,
      } satisfies TenantApiErrorDto,
      400,
    );
  if (result.kind === 'conflict')
    throw new HttpException(
      {
        statusCode: 409,
        message: 'Tenant creation conflict',
        reason: result.reason,
      } satisfies TenantApiErrorDto,
      409,
    );
  if (result.kind === 'unavailable') response.setHeader('Retry-After', '1');
  if (result.kind === 'missing')
    throw new HttpException(
      { statusCode: 404, message: 'Tenant not found' },
      404,
    );
  throw httpFailure(result.kind === 'denied' ? 403 : 503);
}
@HttpAccess({
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  sourceFailureStatus: 403,
  permissions: ['platform_operator'],
  activity: 'passive',
})
@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(@Inject(DraftTenants) private readonly tenants: DraftTenants) {}
  @HttpAccess({
    access: 'protected',
    channel: 'platform-cookie',
    plane: 'platform',
    sourceFailureStatus: 403,
    permissions: ['platform_operator'],
    activity: 'operational',
  })
  @Post()
  async create(
    @Req() request: object,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.tenants.create(
      requestPrincipal(request),
      body,
      correlationId(),
    );
    if (!('value' in result)) return failure(result, response);
    response.statusCode = result.kind === 'created' ? 201 : 200;
    return result.value;
  }
  @Get()
  async list(
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.tenants.list(query);
    return result.kind === 'found' ? result.value : failure(result, response);
  }
  @Get(':tenantId')
  async detail(
    @Param('tenantId') id: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (Object.keys(query).length)
      return failure(
        { kind: 'invalid', fieldErrors: { body: 'Invalid query' } },
        response,
      );
    const result = await this.tenants.detail(id);
    return result.kind === 'found' ? result.value : failure(result, response);
  }
}
