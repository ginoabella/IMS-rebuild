import { PlatformLogout } from '../../application/logout';
import { PlatformCurrentSession } from '../../application/current-session';
import { authOutcome } from './http-boundary';
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
import { HttpAccess } from '../../../identity/adapters/http/policy';
import {
  requestSession,
  httpFailure,
} from '../../../identity/adapters/http/guards';
import {
  PlatformBrowser,
  type CookieResponse,
} from '../../../identity/adapters/http/platform-browser';
import {
  TrustedSource,
  type SourceRequest,
} from '../../../identity/adapters/http/trusted-source';
import { PlatformSignIn } from '../../application/sign-in';
import type {
  PlatformSessionDto,
  PlatformAuthErrorDto,
} from '@myims/contracts';
import type { SessionRecord } from '../../../identity/domain/session';
interface Response extends CookieResponse {
  statusCode: number;
}
function sessionDto(record: SessionRecord, proof: string): PlatformSessionDto {
  return {
    plane: 'platform',
    operatorId: record.identityId,
    idleExpiresAt: record.idleExpiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    proof,
  };
}
function invalidCredentials(status: 400 | 401) {
  return new HttpException(
    {
      statusCode: status,
      message: 'Invalid credentials',
    } satisfies PlatformAuthErrorDto,
    status,
  );
}
@HttpAccess({ access: 'public' })
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    @Inject(PlatformBrowser) private readonly browser: PlatformBrowser,
    @Inject(PlatformSignIn) private readonly signIn: PlatformSignIn,
    @Inject(TrustedSource) private readonly source: TrustedSource,
    @Inject(PlatformLogout) private readonly logoutUseCase: PlatformLogout,
    @Inject(PlatformCurrentSession)
    private readonly currentSession: PlatformCurrentSession,
  ) {}
  @Get('csrf')
  csrf(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.browser.boundary(request);
    if (!this.source.extract(request)) throw invalidCredentials(400);
    return this.browser.bootstrap(request, response);
  }
  @Post('sign-in')
  async login(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const { token } = this.browser.cookies(request);
    this.browser.check(request, 'pre', token);
    const result = await this.signIn.execute(
      body,
      this.source.extract(request),
    );
    if (result.kind === 'issued') {
      const dto = sessionDto(
        result.record,
        this.browser.sessionProof(result.token),
      );
      authOutcome('signed-in');
      this.browser.issued(
        response,
        result.token,
        result.record.absoluteExpiresAt,
      );
      return dto;
    }
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
  @HttpAccess({
    access: 'protected',
    channel: 'platform-cookie',
    plane: 'platform',
    permissions: ['platform_operator'],
    activity: 'passive',
  })
  @Get('session')
  current(@Req() request: SourceRequest) {
    const state = requestSession(request);
    const current = this.currentSession.execute(state.principal, state.record);
    if (!current) throw httpFailure(403);
    return { ...current, proof: this.browser.sessionProof(state.token) };
  }
  @Post('logout')
  async logout(
    @Req() request: SourceRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.browser.boundary(request);
    if (!this.source.extract(request)) throw invalidCredentials(400);
    const { token } = this.browser.cookies(request);
    // Check an accepted proof before lookup, including the absent retry path.
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
    );
    if (result.kind === 'denied') throw httpFailure(403);
    if (result.kind === 'invalid') throw invalidCredentials(400);
    if (result.kind === 'limited') {
      response.setHeader('Retry-After', String(result.retrySeconds));
      throw httpFailure(429);
    }
    if (result.kind !== 'signed-out') {
      response.setHeader('Retry-After', '1');
      throw httpFailure(503);
    }
    this.browser.cleared(response);
    authOutcome('signed-out');
    return { signedOut: true };
  }
}
