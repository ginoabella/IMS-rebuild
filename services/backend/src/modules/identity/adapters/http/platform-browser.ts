import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PlatformAuthConfig } from '@myims/config';
import { canonicalAddress, type SourceRequest } from './trusted-source';
import { httpFailure } from './http-errors';
export const platformCookie = '__Host-myims-platform';
const contextCookie = '__Host-myims-platform-csrf';
const tokenPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export interface CookieResponse {
  setHeader(name: string, value: string | string[]): void;
}
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function singleHeader(
  request: SourceRequest,
  name: string,
): string | undefined {
  const count = request.rawHeaders.filter(
    (v, i) => i % 2 === 0 && v.toLowerCase() === name,
  ).length;
  const value = request.headers[name];
  if (count > 1 || (value !== undefined && typeof value !== 'string'))
    throw httpFailure(403);
  return typeof value === 'string' ? value : undefined;
}
export class PlatformBrowser {
  constructor(
    private readonly config?: PlatformAuthConfig,
    private readonly names = {
      cookie: platformCookie,
      context: contextCookie,
      proxy: 'x-platform-proxy',
      csrf: 'x-platform-csrf',
    },
  ) {}
  private mac(value: string) {
    if (!this.config) throw httpFailure(403);
    return createHmac('sha256', Buffer.from(this.config.csrfSecret, 'hex'))
      .update(
        this.names.cookie === platformCookie
          ? value
          : `${this.names.cookie}:${value}`,
      )
      .digest('base64url');
  }
  boundary(request: SourceRequest) {
    const peer = canonicalAddress(request.socket.remoteAddress);
    const origin = singleHeader(request, 'origin');
    const proxy = singleHeader(request, this.names.proxy);
    if (
      !this.config ||
      !peer ||
      !this.config.proxyPeers.some((v) => canonicalAddress(v) === peer) ||
      origin !== this.config.origin ||
      !proxy ||
      !equal(proxy, this.config.proxySecret)
    )
      throw httpFailure(403);
  }
  cookies(request: SourceRequest): {
    token: string | null;
    context: string | null;
  } {
    if (
      request.headers.authorization !== undefined ||
      request.rawHeaders.some(
        (v, i) => i % 2 === 0 && v.toLowerCase() === 'authorization',
      )
    )
      throw httpFailure(401);
    const raw = singleHeader(request, 'cookie');
    if (raw === undefined) return { token: null, context: null };
    // eslint-disable-next-line no-control-regex -- reject raw cookie control bytes.
    if (raw.length > 8192 || /[\x00-\x1f\x7f]/.test(raw))
      throw httpFailure(401);
    let token: string | null = null;
    let context: string | null = null;
    for (const pair of raw.split(';')) {
      const item = pair.trim();
      const separator = item.indexOf('=');
      if (separator < 1) throw httpFailure(401);
      const name = item.slice(0, separator);
      const value = item.slice(separator + 1);
      if (
        ['__Host-myims-platform', '__Host-myims-staff'].includes(name) &&
        name !== this.names.cookie
      )
        throw httpFailure(401);
      if (name === this.names.cookie) {
        if (token !== null || !tokenPattern.test(value)) throw httpFailure(401);
        token = value;
      }
      if (name === this.names.context) {
        if (
          context !== null ||
          !/^[A-Za-z0-9_-]{43}\.[0-9]{13}\.[A-Za-z0-9_-]{43}$/.test(value)
        )
          throw httpFailure(401);
        context = value;
      }
    }
    return { token, context };
  }
  sessionProof(token: string) {
    return this.mac(`session:${token}`);
  }
  private preProof(context: string, token: string | null) {
    return this.mac(`pre:${context}:${token ?? 'absent'}`);
  }
  bootstrap(request: SourceRequest, response: CookieResponse) {
    this.boundary(request);
    const { token } = this.cookies(request);
    const value = `${randomBytes(32).toString('base64url')}.${Date.now() + 600000}`;
    const context = `${value}.${this.mac(`context:${value}`)}`;
    response.setHeader(
      'Set-Cookie',
      `${this.names.context}=${context}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
    );
    return { proof: this.preProof(context, token) };
  }
  check(request: SourceRequest, mode: 'pre' | 'session', token: string | null) {
    this.boundary(request);
    const { context } = this.cookies(request);
    const proof = singleHeader(request, this.names.csrf);
    if (!proof || !/^[A-Za-z0-9_-]{43}$/.test(proof)) throw httpFailure(403);
    if (mode === 'session') {
      if (!token || !equal(proof, this.sessionProof(token)))
        throw httpFailure(403);
      return;
    }
    if (!context) throw httpFailure(403);
    const [nonce, expiration, signature] = context.split('.');
    const deadline = Number(expiration);
    if (
      !signature ||
      deadline <= Date.now() ||
      deadline > Date.now() + 600000 ||
      !equal(signature, this.mac(`context:${nonce}.${expiration}`)) ||
      !equal(proof, this.preProof(context, token))
    )
      throw httpFailure(403);
  }
  issued(response: CookieResponse, token: string, absoluteExpiresAt: number) {
    response.setHeader('Set-Cookie', [
      `${this.names.cookie}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Expires=${new Date(absoluteExpiresAt - 1000).toUTCString()}`,
      this.clear(this.names.context),
    ]);
  }
  cleared(response: CookieResponse) {
    response.setHeader('Set-Cookie', [
      this.clear(this.names.cookie),
      this.clear(this.names.context),
    ]);
  }
  private clear(name: string) {
    return `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
}
