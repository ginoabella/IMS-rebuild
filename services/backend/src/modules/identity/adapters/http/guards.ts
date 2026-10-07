import { httpFailure, enforceAdmission } from './http-errors';
export { httpFailure, enforceAdmission } from './http-errors';
import { PlatformBrowser } from './platform-browser';
import { Admission } from '../../application/admission';
import { TrustedSource, type SourceRequest } from './trusted-source';
import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
  type NestInterceptor,
  type CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { concatMap } from 'rxjs';
import {
  RequestAuthority,
  type Principal,
} from '../../application/request-authority';
import type { SessionRecord } from '../../domain/session';
import { HTTP_POLICY, type HttpPolicy } from './policy';
interface HttpRequest extends SourceRequest {
  headers: Record<string, string | string[] | undefined>;
  rawHeaders: string[];
  method: string;
}
interface HttpResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
}
interface AuthorizedRequest {
  token: string;
  principal: Principal;
  record: SessionRecord;
  policy: Exclude<HttpPolicy, { access: 'public' }>;
}
// WeakMap prevents body, headers or arbitrary request properties from becoming authority.
const authorized = new WeakMap<object, AuthorizedRequest>();
export function requestSession(request: object): AuthorizedRequest {
  const state = authorized.get(request);
  if (!state) throw httpFailure(401);
  return state;
}
export function requestPrincipal(request: object): Principal {
  const state = authorized.get(request);
  if (!state) throw httpFailure(401);
  return state.principal;
}
function bearer(request: HttpRequest): string | null {
  // Bearer consumers explicitly reject cookies and ambiguous credentials.
  if (request.headers.cookie !== undefined) return null;
  const count = request.rawHeaders.filter(
    (_, i) =>
      i % 2 === 0 && request.rawHeaders[i]?.toLowerCase() === 'authorization',
  ).length;
  const value = request.headers.authorization;
  if (
    count !== 1 ||
    typeof value !== 'string' ||
    !/^Bearer [A-Za-z0-9_-]{43}$/.test(value)
  )
    return null;
  return value.slice(7);
}
@Injectable()
export class AuthorityGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RequestAuthority) private readonly authority: RequestAuthority,
    @Inject(Admission) private readonly admission: Admission,
    @Inject(TrustedSource) private readonly source: TrustedSource,
    @Inject(PlatformBrowser) private readonly browser: PlatformBrowser,
  ) {}
  async canActivate(context: ExecutionContext) {
    const policy = this.reflector.getAllAndOverride<HttpPolicy>(HTTP_POLICY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const response = context.switchToHttp().getResponse<HttpResponse>();
    response.setHeader('Cache-Control', 'no-store');
    if (!policy) throw httpFailure(403);
    if (policy.access === 'public') return true;
    if (
      policy.access !== 'protected' ||
      !['platform', 'tenant'].includes(policy.plane) ||
      !Array.isArray(policy.permissions) ||
      policy.permissions.length === 0 ||
      !['passive', 'operational'].includes(policy.activity)
    )
      throw httpFailure(403);
    const request = context.switchToHttp().getRequest<HttpRequest>();
    if (!['bearer', 'platform-cookie'].includes(policy.channel))
      throw httpFailure(403);
    if (policy.channel === 'platform-cookie' && policy.plane !== 'platform')
      throw httpFailure(403);
    if (policy.channel === 'platform-cookie') this.browser.boundary(request);
    const token =
      policy.channel === 'platform-cookie'
        ? this.browser.cookies(request).token
        : bearer(request);
    if (!token) throw httpFailure(401);
    if (
      policy.channel === 'platform-cookie' &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    )
      this.browser.check(request, 'session', token);
    const result = await this.authority.validate(token);
    if (result.kind !== 'authorized') {
      if (result.kind === 'unavailable') response.setHeader('Retry-After', '1');
      throw httpFailure(result.kind === 'unavailable' ? 503 : 401);
    }
    if (
      result.principal.plane !== policy.plane ||
      !policy.permissions.every((p) =>
        (result.principal.grants as readonly string[]).includes(p),
      )
    )
      throw httpFailure(403);
    if (
      policy.channel === 'platform-cookie' &&
      result.record.consumer !== 'web'
    )
      throw httpFailure(401);
    const source = this.source.extract(request);
    if (
      !source &&
      policy.plane === 'platform' &&
      policy.sourceFailureStatus === 403
    )
      throw httpFailure(403);
    enforceAdmission(
      await this.admission.protected(source, result.principal),
      response,
    );
    authorized.set(request, {
      token,
      principal: result.principal,
      record: result.record,
      policy,
    });
    return true;
  }
}
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    @Inject(RequestAuthority) private readonly authority: RequestAuthority,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<object>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    return next.handle().pipe(
      concatMap(async (value: unknown) => {
        const state = authorized.get(request);
        if (
          state &&
          state.policy.activity === 'operational' &&
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {
          const result = await this.authority.lifecycle.renew(
            state.token,
            {
              lifecycleId: state.record.lifecycleId,
              generation: state.record.generation,
            },
            'successful-operational',
          );
          if (result.kind !== 'found') {
            const status = result.kind === 'invalid' ? 401 : 503;
            if (status === 503) response.setHeader('Retry-After', '1');
            throw httpFailure(status);
          }
        }
        return value;
      }),
    );
  }
}
