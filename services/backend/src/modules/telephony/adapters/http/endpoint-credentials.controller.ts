import {
  Body,
  Controller,
  Get,
  Post,
  Inject,
  Param,
  Query,
  Req,
  Res,
  HttpException,
} from '@nestjs/common';
import { correlationId } from '../../../../infrastructure/execution/context';
import {
  requestPrincipal,
  httpFailure,
} from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import {
  EndpointCredentials,
  type CredentialOutcome,
} from '../../application/endpoint-credentials';
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
function result<T>(outcome: CredentialOutcome<T>, response: Response) {
  if (outcome.kind === 'ok') {
    response.statusCode = outcome.pending ? 202 : 200;
    return outcome.value;
  }
  if (outcome.status === 503) response.setHeader('Retry-After', '1');
  if (outcome.status === 503 || outcome.status === 403)
    throw httpFailure(outcome.status);
  throw new HttpException(
    {
      statusCode: outcome.status,
      message:
        outcome.status === 400
          ? 'Invalid credential request'
          : outcome.status === 404
            ? 'Credential resource not found'
            : 'Credential operation conflict',
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    },
    outcome.status,
  );
}
function noQuery(query: Record<string, unknown>) {
  if (Object.keys(query).length)
    throw new HttpException(
      { statusCode: 400, message: 'Invalid credential request' },
      400,
    );
}
@HttpAccess(read)
@Controller('platform/pbx-nodes/:nodeId/extensions/:extensionId')
export class EndpointCredentialsController {
  constructor(
    @Inject(EndpointCredentials)
    private readonly credentials: EndpointCredentials,
  ) {}
  @HttpAccess({ ...read, activity: 'operational' })
  @Post('credentials/setup')
  async setup(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.credentials.accept(
        requestPrincipal(request),
        node,
        extension,
        'setup',
        body,
        correlationId(),
      ),
      response,
    );
  }
  @HttpAccess({ ...read, activity: 'operational' })
  @Post('credentials/reset')
  async reset(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.credentials.accept(
        requestPrincipal(request),
        node,
        extension,
        'reset',
        body,
        correlationId(),
      ),
      response,
    );
  }
  @Get('credentials')
  async status(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.credentials.status(requestPrincipal(request), node, extension),
      response,
    );
  }
  @Get('credential-operations/:operationId')
  async operation(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Param('operationId') operation: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.credentials.status(
        requestPrincipal(request),
        node,
        extension,
        operation,
      ),
      response,
    );
  }
}
