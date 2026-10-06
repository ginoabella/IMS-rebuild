/** Safe canonical browser DTO. Opaque authentication tokens are cookie-only. */
export interface PlatformSessionDto {
  plane: 'platform';
  operatorId: string;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
  proof: string;
}
export interface PlatformSignInDto {
  username: string;
  password: string;
}
export interface PlatformCsrfDto {
  proof: string;
}
export interface PlatformLogoutDto {
  signedOut: true;
}
export type PlatformAuthErrorDto =
  | { statusCode: 400 | 401; message: 'Invalid credentials' }
  | { statusCode: 401; message: 'Authentication required' }
  | { statusCode: 400; message: 'Invalid request' }
  | { statusCode: 403; message: 'Access denied' }
  | { statusCode: 429; message: 'Too many requests' }
  | { statusCode: 503; message: 'Service unavailable' };
