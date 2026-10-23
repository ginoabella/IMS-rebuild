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
import { Peers, type PeerResult } from '../../application/peers';
import type { PeerResource } from '@myims/contracts';
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
function result(r: PeerResult, res: Response) {
  res.statusCode = r.status;
  if (r.status === 503) res.setHeader('Retry-After', '1');
  if (r.status >= 400) throw new HttpException(r.value, r.status);
  return r.value;
}
function kind(value: string): PeerResource {
  if (value !== 'trunks' && value !== 'gateways')
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
@Controller('platform/pbx-nodes/:nodeId/peers/:kind')
export class PeersController {
  constructor(@Inject(Peers) private readonly peers: Peers) {}
  @Get('credentials/selections')
  async credentials(
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (kind(k) !== 'trunks')
      throw new HttpException('Resource not found', 404);
    return result(await this.peers.credentials(node, q), res);
  }
  @Get()
  async list(
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(await this.peers.read(kind(k), node, null, q), res);
  }
  @Get(':id')
  async detail(
    @Param('nodeId') node: string,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(await this.peers.read(kind(k), node, id, q), res);
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
      await this.peers.write(
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
      await this.peers.write(
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
      await this.peers.write(
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
      await this.peers.write(
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
