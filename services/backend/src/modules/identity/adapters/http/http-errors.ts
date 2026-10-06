import { HttpException } from '@nestjs/common';
import type { AdmissionResult } from '../../application/admission';
interface HttpResponse {
  setHeader(name: string, value: string): void;
}
export function httpFailure(status: 400 | 401 | 403 | 429 | 503) {
  return new HttpException(
    {
      statusCode: status,
      message:
        status === 400
          ? 'Invalid request'
          : status === 429
            ? 'Too many requests'
            : status === 401
              ? 'Authentication required'
              : status === 403
                ? 'Access denied'
                : 'Service unavailable',
    },
    status,
  );
}
export function enforceAdmission(
  result: AdmissionResult,
  response: HttpResponse,
): void {
  if (result.kind === 'admitted') return;
  if (result.kind === 'limited')
    response.setHeader('Retry-After', String(result.retrySeconds));
  if (result.kind === 'unavailable') response.setHeader('Retry-After', '1');
  throw httpFailure(
    result.kind === 'limited' ? 429 : result.kind === 'invalid' ? 400 : 503,
  );
}
