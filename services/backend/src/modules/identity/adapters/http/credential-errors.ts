import { HttpException } from '@nestjs/common';
import type { CredentialFailure } from '../../application/credential-actions';
export interface CredentialResponse {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
}
export function credentialFailure(
  result: CredentialFailure,
  response: CredentialResponse,
  exchange = false,
): never {
  const status =
    result.kind === 'invalid'
      ? 400
      : result.kind === 'denied'
        ? exchange
          ? 401
          : 403
        : result.kind === 'missing'
          ? 404
          : result.kind === 'conflict'
            ? 409
            : result.kind === 'limited'
              ? 429
              : 503;
  const messages = {
    400: 'Invalid credential request',
    401: 'Invalid capability',
    403: 'Access denied',
    404: 'Credential action not found',
    409: 'Credential action conflict',
    429: 'Too many requests',
    503: 'Service unavailable',
  };
  if (status === 503) response.setHeader('Retry-After', '1');
  if (result.kind === 'limited')
    response.setHeader('Retry-After', String(result.retrySeconds));
  throw new HttpException(
    { statusCode: status, message: messages[status] },
    status,
  );
}
