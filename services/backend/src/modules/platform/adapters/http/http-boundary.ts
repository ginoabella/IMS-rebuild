import { GEOGRAPHY_BODY_BYTES } from '@myims/contracts';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
export function authOutcome(
  code:
    | 'signed-in'
    | 'signed-out'
    | 'denied'
    | 'invalid'
    | 'limited'
    | 'unavailable',
) {
  console.log(
    JSON.stringify({
      entrypoint: 'http',
      operation: 'platform-auth',
      code,
      correlationId: randomUUID(),
    }),
  );
}
@Catch()
class SafeHttpErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
      status(code: number): { json(body: unknown): void };
    }>();
    response.setHeader('Cache-Control', 'no-store');
    if (error instanceof HttpException) {
      const status = error.getStatus();
      authOutcome(
        status === 503
          ? 'unavailable'
          : status === 429
            ? 'limited'
            : status === 400
              ? 'invalid'
              : 'denied',
      );
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const parseError =
      error &&
      typeof error === 'object' &&
      'type' in error &&
      [
        'entity.too.large',
        'entity.parse.failed',
        'entity.verify.failed',
        'encoding.unsupported',
        'charset.unsupported',
      ].includes(String(error.type));
    authOutcome(parseError ? 'invalid' : 'unavailable');
    if (!parseError) response.setHeader('Retry-After', '1');
    response.status(parseError ? 400 : 503).json({
      statusCode: parseError ? 400 : 503,
      message: parseError ? 'Invalid credentials' : 'Service unavailable',
    });
  }
}
export function configureHttpBoundary(app: NestExpressApplication) {
  app.useBodyParser('json', {
    type: (request: IncomingMessage) =>
      request.method === 'POST' &&
      /^\/platform\/tenants\/[0-9a-f-]{36}\/configuration(?:\?|$)/i.test(
        request.url ?? '',
      ) &&
      /^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? ''),
    limit: GEOGRAPHY_BODY_BYTES,
    strict: true,
    verify: (_request: unknown, _response: unknown, bytes: Buffer) => {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
  });
  app.useBodyParser('json', {
    limit: 4096,
    strict: true,
    verify: (_request: unknown, _response: unknown, bytes: Buffer) => {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
  });
  app.useGlobalFilters(new SafeHttpErrors());
}
