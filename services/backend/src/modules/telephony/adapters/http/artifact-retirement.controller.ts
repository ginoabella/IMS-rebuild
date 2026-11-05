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
import { ArtifactRetirement } from '../../application/artifact-retirement';
const read = {
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  sourceFailureStatus: 403,
  activity: 'passive',
} as const;
@Controller('platform/pbx-nodes/:nodeId/artifact-retirements')
@HttpAccess(read)
export class ArtifactRetirementController {
  constructor(
    @Inject(ArtifactRetirement) private readonly service: ArtifactRetirement,
  ) {}
  private result(
    r: { status: number; value: Record<string, unknown> },
    response?: {
      statusCode: number;
      setHeader(name: string, value: string): void;
    },
  ) {
    if (response) {
      response.statusCode = r.status;
      if (r.status === 503) response.setHeader('Retry-After', '1');
    }
    if (r.status >= 400) throw new HttpException(r.value, r.status);
    return r.value;
  }
  @Get() async list(
    @Req() req: object,
    @Param('nodeId') nodeId: string,
    @Query() q: unknown,
  ) {
    return this.result(
      await this.service.read(requestPrincipal(req), nodeId, q),
    );
  }
  @Post()
  @HttpAccess({ ...read, activity: 'operational' })
  async create(
    @Req() req: object,
    @Param('nodeId') nodeId: string,
    @Query() q: Record<string, unknown>,
    @Body() body: unknown,
    @Res({ passthrough: true })
    response: {
      statusCode: number;
      setHeader(name: string, value: string): void;
    },
  ) {
    if (Object.keys(q).length) throw new HttpException('Invalid query', 400);
    return this.result(
      await this.service.write(
        requestPrincipal(req),
        nodeId,
        body,
        correlationId(),
      ),
      response,
    );
  }
}
