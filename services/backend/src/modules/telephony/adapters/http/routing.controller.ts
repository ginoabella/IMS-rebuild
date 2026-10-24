import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { correlationId } from '../../../../infrastructure/execution/context';
import { requestPrincipal } from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import { Routing } from '../../application/routing';
type RoutingResult = { status: number; value: Record<string, unknown> };
import type { RoutingKind } from '@myims/contracts';
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
function result(r: RoutingResult, res: Response) {
  res.statusCode = r.status;
  if (r.status === 503) res.setHeader('Retry-After', '1');
  if (r.status >= 400) throw new HttpException(r.value, r.status);
  return r.value;
}
function kind(value: string): RoutingKind {
  if (value !== 'groups' && value !== 'reservations')
    throw new HttpException(
      { statusCode: 404, message: 'Resource not found' },
      404,
    );
  return value;
}
function noQuery(q: Record<string, unknown>) {
  if (Object.keys(q).length)
    throw new HttpException({ statusCode: 400, message: 'Invalid query' }, 400);
}
@HttpAccess(read)
@Controller('platform/pbx-nodes/:nodeId/routing/:kind')
export class RoutingController {
  constructor(@Inject(Routing) private readonly routing: Routing) {}
  @HttpAccess(read)
  @Post('preview')
  async preview(
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    if (kind(k) !== 'groups')
      throw new HttpException('Resource not found', 404);
    return result(await this.routing.preview(node, body), res);
  }
  @Get()
  async list(
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(await this.routing.read(kind(k), node, null, q), res);
  }
  @Get(':id')
  async detail(
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(await this.routing.read(kind(k), node, id, q), res);
  }
  @HttpAccess(write)
  @Post()
  async create(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.routing.write(
        requestPrincipal(req),
        kind(k),
        node,
        null,
        'create',
        body,
        correlationId(),
      ),
      res,
    );
  }
  @HttpAccess(write)
  @Patch(':id')
  async edit(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.routing.write(
        requestPrincipal(req),
        kind(k),
        node,
        id,
        'edit',
        body,
        correlationId(),
      ),
      res,
    );
  }
  @HttpAccess(write)
  @Patch(':id/status')
  async status(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.routing.write(
        requestPrincipal(req),
        kind(k),
        node,
        id,
        'status',
        body,
        correlationId(),
      ),
      res,
    );
  }
  @HttpAccess(write)
  @Post(':id/remove')
  async remove(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.routing.write(
        requestPrincipal(req),
        kind(k),
        node,
        id,
        'remove',
        body,
        correlationId(),
      ),
      res,
    );
  }
}
