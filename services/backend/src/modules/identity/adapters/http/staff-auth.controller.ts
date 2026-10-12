import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  Inject,
  HttpException,
} from '@nestjs/common';
import { HttpAccess } from './policy';
import { requestSession, httpFailure } from './guards';
import { StaffIssuerBrowser } from './credential-browser';
import { StaffMobile } from './staff-mobile';
import type { CookieResponse } from './platform-browser';
import { singleHeader } from './platform-browser';
import { TrustedSource, type SourceRequest } from './trusted-source';
import { StaffSignIn, type SignInResult } from '../../application/sign-in';
import { StaffLogout, type StaffLogoutResult } from '../../application/logout';
import { StaffCurrentSession } from '../../application/current-session';
import { RequestAuthority } from '../../application/request-authority';
function invalidCredentials(status: 400 | 401) {
  return new HttpException(
    { statusCode: status, message: 'Invalid credentials' },
    status,
  );
}
function failure(
  result: SignInResult | StaffLogoutResult,
  response: CookieResponse,
): never {
  if (result.kind === 'invalid') throw invalidCredentials(400);
  if (result.kind === 'denied' || result.kind === 'conflict')
    throw invalidCredentials(401);
  if (result.kind === 'limited') {
    response.setHeader('Retry-After', String(result.retrySeconds));
    throw httpFailure(429);
  }
  response.setHeader('Retry-After', '1');
  throw httpFailure(503);
}
@HttpAccess({ access: 'public' })
@Controller('staff/auth')
export class StaffAuthController {
  constructor(
    @Inject(StaffIssuerBrowser) private readonly browser: StaffIssuerBrowser,
    @Inject(StaffMobile) private readonly mobile: StaffMobile,
    @Inject(StaffSignIn) private readonly signIn: StaffSignIn,
    @Inject(TrustedSource) private readonly source: TrustedSource,
    @Inject(StaffLogout) private readonly logoutUseCase: StaffLogout,
    @Inject(StaffCurrentSession)
    private readonly currentSession: StaffCurrentSession,
    @Inject(RequestAuthority) private readonly authority: RequestAuthority,
  ) {}
  @Get('browser/csrf')
  csrf(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    this.browser.boundary(request);
    if (!this.source.extract(request)) throw invalidCredentials(400);
    return this.browser.bootstrap(request, response);
  }
  private async login(
    body: unknown,
    request: SourceRequest,
    response: CookieResponse,
    consumer: 'web' | 'mobile',
  ) {
    const result = await this.signIn.execute(
      body,
      this.source.extract(request),
      consumer,
    );
    if (result.kind !== 'issued') return failure(result, response);
    // A fresh guard read supplies canonical roles and owner metadata. Changes after
    // issuance cannot cause old verified material to become new authority.
    const current = await this.authority.validate(result.token);
    if (current.kind !== 'authorized') {
      response.setHeader('Retry-After', '1');
      throw httpFailure(503);
    }
    const dto = this.currentSession.execute(current.principal, current.record);
    if (!dto) throw httpFailure(403);
    if (consumer === 'mobile') return { ...dto, token: result.token };
    this.browser.issued(
      response,
      result.token,
      result.record.absoluteExpiresAt,
    );
    return { ...dto, proof: this.browser.sessionProof(result.token) };
  }
  @Post('browser/sign-in')
  browserLogin(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Body() body: unknown,
  ) {
    const { token } = this.browser.cookies(request);
    this.browser.check(request, 'pre', token);
    return this.login(body, request, response, 'web');
  }
  @Post('mobile/sign-in')
  mobileLogin(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Body() body: unknown,
  ) {
    this.mobile.boundary(request);
    if (singleHeader(request, 'authorization') !== undefined)
      throw httpFailure(403);
    return this.login(body, request, response, 'mobile');
  }
  @HttpAccess({
    access: 'protected',
    channel: 'staff-cookie',
    plane: 'tenant',
    permissions: ['incident.own.close'],
    activity: 'passive',
  })
  @Get('browser/session')
  browserSession(@Req() request: SourceRequest) {
    const state = requestSession(request);
    const dto = this.currentSession.execute(state.principal, state.record);
    if (!dto) throw httpFailure(403);
    return { ...dto, proof: this.browser.sessionProof(state.token) };
  }
  @HttpAccess({
    access: 'protected',
    channel: 'staff-mobile',
    plane: 'tenant',
    permissions: ['incident.own.close'],
    activity: 'passive',
  })
  @Get('mobile/session')
  mobileSession(@Req() request: SourceRequest) {
    const state = requestSession(request);
    const dto = this.currentSession.execute(state.principal, state.record);
    if (!dto) throw httpFailure(403);
    return dto;
  }
  @Post('browser/logout')
  async browserLogout(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    this.browser.boundary(request);
    const { token } = this.browser.cookies(request);
    let pre = false;
    try {
      this.browser.check(request, 'session', token);
    } catch {
      this.browser.check(request, 'pre', token);
      pre = true;
    }
    const result = await this.logoutUseCase.execute(
      token,
      pre,
      this.source.extract(request),
      'web',
    );
    if (result.kind === 'denied') throw httpFailure(403);
    if (result.kind !== 'signed-out') return failure(result, response);
    this.browser.cleared(response);
    return { signedOut: true };
  }
  @Post('mobile/logout')
  async mobileLogout(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const token = this.mobile.token(request);
    const result = await this.logoutUseCase.execute(
      token,
      false,
      this.source.extract(request),
      'mobile',
    );
    if (result.kind === 'denied') throw httpFailure(403);
    if (result.kind !== 'signed-out') return failure(result, response);
    return { signedOut: true };
  }
}
