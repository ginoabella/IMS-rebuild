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
import { PbxLive } from '../../application/pbx-live';
const access = {
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  sourceFailureStatus: 403,
  activity: 'passive',
} as const;
interface Response {
  statusCode: number;
  setHeader(name: string, value: string): void;
}
function result(
  r: { status: number; value: Record<string, unknown> },
  res: Response,
) {
  res.statusCode = r.status;
  res.setHeader('Cache-Control', 'no-store');
  if (r.status === 503) res.setHeader('Retry-After', '1');
  if (r.status >= 400) throw new HttpException(r.value, r.status);
  return r.value;
}
@HttpAccess(access)
@Controller('platform/pbx-nodes/:nodeId/revisions/live')
export class LiveController {
  constructor(@Inject(PbxLive) private readonly live: PbxLive) {}
  @Get()
  async status(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.live.read(requestPrincipal(req), node, null, null, q),
      res,
    );
  }
  @Get('operations/:id')
  async operation(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('id') id: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.live.read(requestPrincipal(req), node, id, null, q),
      res,
    );
  }
  @Get('receipts/:id')
  async receipt(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('id') id: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.live.read(requestPrincipal(req), node, null, id, q),
      res,
    );
  }
  @HttpAccess({ ...access, activity: 'operational' })
  @Post(':action')
  async write(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('action') action: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (
      Object.keys(q).length ||
      !['apply', 'recover', 'reconcile'].includes(action)
    )
      throw new HttpException('Invalid live operation', 400);
    return result(
      await this.live.accept(
        requestPrincipal(req),
        node,
        action as 'apply' | 'recover' | 'reconcile',
        body,
        correlationId(),
      ),
      res,
    );
  }
}
