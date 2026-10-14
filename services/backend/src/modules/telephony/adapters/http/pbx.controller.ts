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
import type { PbxApiErrorDto } from '@myims/contracts';
import { correlationId } from '../../../../infrastructure/execution/context';
import {
  requestPrincipal,
  httpFailure,
} from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import { PbxNodes, type PbxFailure } from '../../application/pbx-nodes';
interface Response {
  statusCode: number;
  setHeader(name: string, value: string): void;
}
function failure(result: PbxFailure, response: Response): never {
  if (result.kind === 'invalid')
    throw new HttpException(
      {
        statusCode: 400,
        message: 'Invalid PBX request',
        fieldErrors: result.fieldErrors,
      } satisfies PbxApiErrorDto,
      400,
    );
  if (result.kind === 'conflict')
    throw new HttpException(
      {
        statusCode: 409,
        message: 'PBX registry conflict',
        reason: result.reason,
      } satisfies PbxApiErrorDto,
      409,
    );
  if (result.kind === 'missing')
    throw new HttpException(
      { statusCode: 404, message: 'PBX node not found' },
      404,
    );
  if (result.kind === 'unavailable') response.setHeader('Retry-After', '1');
  throw httpFailure(result.kind === 'denied' ? 403 : 503);
}
const readPolicy = {
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  sourceFailureStatus: 403,
  activity: 'passive',
} as const;
const writePolicy = { ...readPolicy, activity: 'operational' } as const;
@HttpAccess(readPolicy)
@Controller('platform/pbx-nodes')
export class PbxController {
  constructor(@Inject(PbxNodes) private readonly nodes: PbxNodes) {}
  @HttpAccess(writePolicy)
  @Post()
  async create(
    @Req() request: object,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.nodes.create(
      requestPrincipal(request),
      body,
      correlationId(),
    );
    if (!('value' in result)) return failure(result, response);
    response.statusCode = result.kind === 'created' ? 201 : 200;
    return result.value;
  }
  @HttpAccess(writePolicy)
  @Patch(':nodeId')
  async edit(
    @Req() request: object,
    @Param('nodeId') id: string,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (Object.keys(query).length)
      return failure(
        { kind: 'invalid', fieldErrors: { body: 'Invalid query' } },
        response,
      );
    const result = await this.nodes.edit(
      requestPrincipal(request),
      id,
      body,
      correlationId(),
    );
    return 'value' in result ? result.value : failure(result, response);
  }
  @Get()
  async list(
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.nodes.list(query);
    return 'value' in result ? result.value : failure(result, response);
  }
  @Get(':nodeId')
  async detail(
    @Param('nodeId') id: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (Object.keys(query).length)
      return failure(
        { kind: 'invalid', fieldErrors: { body: 'Invalid query' } },
        response,
      );
    const result = await this.nodes.detail(id);
    return 'value' in result ? result.value : failure(result, response);
  }
}
