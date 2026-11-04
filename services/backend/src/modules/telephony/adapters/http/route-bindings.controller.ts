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
import { correlationId } from '../../../../infrastructure/execution/context';
import { requestPrincipal } from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import { TenantRouteBindings } from '../../application/tenant-route-bindings';
const read = {
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  sourceFailureStatus: 403,
  activity: 'passive',
} as const;
const write = { ...read, activity: 'operational' } as const;
interface Response {
  statusCode: number;
  setHeader(name: string, value: string): void;
}
function result(
  r: { status: number; value: Record<string, unknown> },
  res: Response,
) {
  res.statusCode = r.status;
  if (r.status === 503) res.setHeader('Retry-After', '1');
  if (r.status >= 400) throw new HttpException(r.value, r.status);
  return r.value;
}
@HttpAccess(read)
@Controller('platform/tenants/:tenantId/route-bindings/:nodeId')
export class RouteBindingsController {
  constructor(
    @Inject(TenantRouteBindings) private readonly bindings: TenantRouteBindings,
  ) {}
  @Get()
  async list(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.bindings.read(
        requestPrincipal(req),
        t,
        n,
        false,
        q,
        correlationId(),
      ),
      res,
    );
  }
  @Get('selection')
  async selection(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.bindings.read(
        requestPrincipal(req),
        t,
        n,
        true,
        q,
        correlationId(),
      ),
      res,
    );
  }
  @Post('preview')
  async preview(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
    return result(
      await this.bindings.preview(
        requestPrincipal(req),
        t,
        n,
        body,
        correlationId(),
      ),
      res,
    );
  }
  @Post('outbound-preview')
  async outbound(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
    return result(
      await this.bindings.preview(
        requestPrincipal(req),
        t,
        n,
        body,
        correlationId(),
        true,
      ),
      res,
    );
  }
  @HttpAccess(write)
  @Post()
  async save(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
    return result(
      await this.bindings.write(
        requestPrincipal(req),
        t,
        n,
        null,
        body,
        correlationId(),
      ),
      res,
    );
  }
  @HttpAccess(write)
  @Post(':id/revoke')
  async revoke(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
    return result(
      await this.bindings.write(
        requestPrincipal(req),
        t,
        n,
        id,
        body,
        correlationId(),
      ),
      res,
    );
  }
}
