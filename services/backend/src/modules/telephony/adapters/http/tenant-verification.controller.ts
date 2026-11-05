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
import { TenantVerification } from '../../application/tenant-verification';
const read = {
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  sourceFailureStatus: 403,
  activity: 'passive',
} as const;
@Controller('platform/tenants/:tenantId/telephony/:nodeId')
@HttpAccess(read)
export class TenantVerificationController {
  constructor(
    @Inject(TenantVerification)
    private readonly verification: TenantVerification,
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
  @Get()
  async detail(
    @Req() req: object,
    @Param('tenantId') tenantId: string,
    @Param('nodeId') nodeId: string,
    @Query() q: unknown,
  ) {
    return this.result(
      await this.verification.read(requestPrincipal(req), tenantId, nodeId, q),
    );
  }
  @Post(':action')
  @HttpAccess({ ...read, activity: 'operational' })
  async write(
    @Req() req: object,
    @Param('tenantId') tenantId: string,
    @Param('nodeId') nodeId: string,
    @Param('action') action: string,
    @Query() q: Record<string, unknown>,
    @Body() body: unknown,
    @Res({ passthrough: true })
    response: {
      statusCode: number;
      setHeader(name: string, value: string): void;
    },
  ) {
    if (
      Object.keys(q).length ||
      !['grant', 'revoke', 'test', 'reconcile'].includes(action)
    )
      throw new HttpException('Invalid request', 400);
    return this.result(
      await this.verification.write(
        requestPrincipal(req),
        tenantId,
        nodeId,
        action as 'grant' | 'revoke' | 'test' | 'reconcile',
        body,
        correlationId(),
      ),
      response,
    );
  }
}
