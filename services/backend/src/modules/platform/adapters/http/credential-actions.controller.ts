import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { CredentialActions } from '../../../identity/application/credential-actions';
import {
  requestPrincipal,
  httpFailure,
} from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import {
  TrustedSource,
  type SourceRequest,
} from '../../../identity/adapters/http/trusted-source';
import {
  credentialFailure,
  type CredentialResponse,
} from '../../../identity/adapters/http/credential-errors';
@HttpAccess({
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  activity: 'passive',
  sourceFailureStatus: 403,
})
@Controller('platform/tenants/:tenantId/administrator/credential-actions')
export class PlatformCredentialActionsController {
  constructor(
    @Inject(CredentialActions) private readonly actions: CredentialActions,
    @Inject(TrustedSource) private readonly source: TrustedSource,
  ) {}
  @Get()
  async status(
    @Req() request: SourceRequest,
    @Param('tenantId') tenantId: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    const r = await this.actions.status(requestPrincipal(request), tenantId);
    return r.kind === 'found'
      ? { credentialState: r.credentialState, action: r.action }
      : credentialFailure(r, response);
  }
  @HttpAccess({
    access: 'protected',
    channel: 'platform-cookie',
    plane: 'platform',
    permissions: ['platform_operator'],
    activity: 'operational',
    sourceFailureStatus: 403,
  })
  @Post()
  async issue(
    @Req() request: SourceRequest,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    const r = await this.actions.issue(
      requestPrincipal(request),
      tenantId,
      body,
      this.source.extract(request),
    );
    if (r.kind !== 'issued') return credentialFailure(r, response);
    response.statusCode = 201;
    return { action: r.action, capability: r.capability };
  }
  @HttpAccess({
    access: 'protected',
    channel: 'platform-cookie',
    plane: 'platform',
    permissions: ['platform_operator'],
    activity: 'operational',
    sourceFailureStatus: 403,
  })
  @Post(':actionId/cancel')
  async cancel(
    @Req() request: SourceRequest,
    @Param('tenantId') tenantId: string,
    @Param('actionId') actionId: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (
      Object.keys(query).length ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length
    )
      throw httpFailure(403);
    const r = await this.actions.cancel(
      requestPrincipal(request),
      tenantId,
      actionId,
      this.source.extract(request),
    );
    return r.kind === 'cancelled'
      ? { cancelled: true }
      : credentialFailure(r, response);
  }
}
