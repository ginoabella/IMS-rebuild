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
import { CredentialActions } from '../../application/credential-actions';
import { StaffIssuerBrowser } from './credential-browser';
import { requestSession, requestPrincipal, httpFailure } from './guards';
import { HttpAccess } from './policy';
import { TrustedSource, type SourceRequest } from './trusted-source';
import {
  credentialFailure,
  type CredentialResponse,
} from './credential-errors';
@HttpAccess({
  access: 'protected',
  channel: 'staff-cookie',
  plane: 'tenant',
  permissions: ['tenant.manage'],
  activity: 'passive',
})
@Controller('staff/credential-actions')
export class StaffCredentialActionsController {
  constructor(
    @Inject(CredentialActions) private readonly actions: CredentialActions,
    @Inject(TrustedSource) private readonly source: TrustedSource,
    @Inject(StaffIssuerBrowser) private readonly browser: StaffIssuerBrowser,
  ) {}
  @HttpAccess({
    access: 'protected',
    channel: 'staff-cookie',
    plane: 'tenant',
    permissions: ['tenant.manage'],
    activity: 'operational',
  })
  @Post()
  async issue(
    @Req() request: SourceRequest,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    const v =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const r = await this.actions.issue(
      requestPrincipal(request),
      String(v.tenantId),
      body,
      this.source.extract(request),
      typeof v.staffId === 'string' ? v.staffId : undefined,
    );
    if (r.kind !== 'issued') return credentialFailure(r, response);
    response.statusCode = 201;
    return { action: r.action, capability: r.capability };
  }
  @Get('session')
  session(
    @Req() request: SourceRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    const { principal, token, record } = requestSession(request);
    if (principal.plane !== 'tenant') throw httpFailure(403);
    return {
      tenantId: principal.tenantId,
      staffId: principal.staffId,
      proof: this.browser.sessionProof(token),
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    };
  }
  @Get(':actionId')
  async status(
    @Req() request: SourceRequest,
    @Param('actionId') actionId: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    const r = await this.actions.staffAction(
      requestPrincipal(request),
      actionId,
      null,
    );
    return r.kind === 'found'
      ? { credentialState: r.credentialState, action: r.action }
      : credentialFailure(r, response);
  }
  @HttpAccess({
    access: 'protected',
    channel: 'staff-cookie',
    plane: 'tenant',
    permissions: ['tenant.manage'],
    activity: 'operational',
  })
  @Post(':actionId/cancel')
  async cancel(
    @Req() request: SourceRequest,
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
    const r = await this.actions.staffAction(
      requestPrincipal(request),
      actionId,
      this.source.extract(request),
      true,
    );
    return r.kind === 'cancelled'
      ? { cancelled: true }
      : credentialFailure(r, response);
  }
}
