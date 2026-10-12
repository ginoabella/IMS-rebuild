import { timingSafeEqual } from 'node:crypto';
import type { PlatformAuthConfig } from '@myims/config';
import { canonicalAddress, type SourceRequest } from './trusted-source';
import { singleHeader } from './platform-browser';
import { httpFailure } from './http-errors';
/** TLS ingress attestation is accepted only from exact configured private peers.
 * Native consumers have no Origin, Fetch Metadata, cookie or browser CSRF channel. */
export class StaffMobile {
  constructor(private readonly config?: PlatformAuthConfig) {}
  boundary(request: SourceRequest) {
    const peer = canonicalAddress(request.socket.remoteAddress);
    const proof = singleHeader(request, 'x-staff-mobile-proxy');
    if (
      !this.config ||
      !peer ||
      !this.config.proxyPeers.some((p) => canonicalAddress(p) === peer) ||
      !proof ||
      !/^[a-f0-9]{64}$/.test(proof) ||
      !timingSafeEqual(
        Buffer.from(proof),
        Buffer.from(this.config.proxySecret),
      ) ||
      [
        'origin',
        'cookie',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-dest',
        'x-staff-proxy',
        'x-staff-csrf',
      ].some((name) => singleHeader(request, name) !== undefined)
    )
      throw httpFailure(403);
  }
  token(request: SourceRequest): string | null {
    this.boundary(request);
    const authorization = singleHeader(request, 'authorization');
    if (authorization === undefined) return null;
    if (!/^Bearer [A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(authorization))
      throw httpFailure(403);
    return authorization.slice(7);
  }
}
