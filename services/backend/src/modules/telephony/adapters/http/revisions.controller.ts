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
import { PbxRevisions } from '../../application/pbx-revisions';
const read = {
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
function noQuery(q: Record<string, unknown>) {
  if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
}
@HttpAccess(read)
@Controller('platform/pbx-nodes/:nodeId/revisions')
export class RevisionsController {
  constructor(@Inject(PbxRevisions) private readonly revisions: PbxRevisions) {}
  @Get()
  async list(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.revisions.read(requestPrincipal(req), node, null, q),
      res,
    );
  }
  @Get('receipts/:requestId')
  async recover(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('requestId') id: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.revisions.recover(requestPrincipal(req), node, id, q),
      res,
    );
  }
  @Get(':id')
  async detail(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('id') id: string,
    @Query() q: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return result(
      await this.revisions.read(requestPrincipal(req), node, id, q),
      res,
    );
  }
  @HttpAccess({ ...read, activity: 'operational' })
  @Post()
  async capture(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.revisions.write(
        requestPrincipal(req),
        node,
        null,
        body,
        correlationId(),
      ),
      res,
    );
  }
  @HttpAccess({ ...read, activity: 'operational' })
  @Post(':id/validate')
  async validate(
    @Req() req: object,
    @Param('nodeId') node: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() q: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    noQuery(q);
    return result(
      await this.revisions.write(
        requestPrincipal(req),
        node,
        id,
        body,
        correlationId(),
      ),
      res,
    );
  }
}
