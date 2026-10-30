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
import { TenantAllocation } from '../../application/tenant-allocation';
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
function noQuery(q: Record<string, unknown>) {
  if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
}
@HttpAccess(read)
@Controller('platform/tenants/:tenantId/allocations/:nodeId')
export class AllocationController {
  constructor(
    @Inject(TenantAllocation) private readonly allocation: TenantAllocation,
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
      await this.allocation.read(
        requestPrincipal(req),
        t,
        n,
        'claims',
        q,
        correlationId(),
      ),
      res,
    );
  }
  @Get('stock')
  async stock(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.allocation.read(
        requestPrincipal(req),
        t,
        n,
        'stock',
        q,
        correlationId(),
      ),
      res,
    );
  }
  @Get(':claimId')
  async detail(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Param('claimId') c: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.allocation.read(
        requestPrincipal(req),
        t,
        n,
        'claims',
        q,
        correlationId(),
        c,
      ),
      res,
    );
  }
  @HttpAccess(read)
  @Post('preview')
  async preview(
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(await this.allocation.preview(t, n, body), res);
  }
  @HttpAccess(write)
  @Post()
  async create(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.allocation.write(
        requestPrincipal(req),
        t,
        n,
        null,
        'create',
        body,
        correlationId(),
      ),
      res,
    );
  }
  @HttpAccess(write)
  @Post(':claimId/:action')
  async change(
    @Req() req: object,
    @Param('tenantId') t: string,
    @Param('nodeId') n: string,
    @Param('claimId') c: string,
    @Param('action') action: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    if (action !== 'promote' && action !== 'release')
      throw new HttpException('Resource not found', 404);
    return result(
      await this.allocation.write(
        requestPrincipal(req),
        t,
        n,
        c,
        action,
        body,
        correlationId(),
      ),
      res,
    );
  }
}
