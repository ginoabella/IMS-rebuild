import { ConfigurationError } from '@myims/config';
import { loadBackendConfig } from '../../infrastructure/configuration';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { HttpModule } from './http.module';

async function main() {
  const config = loadBackendConfig();
  const app = await NestFactory.create(HttpModule.register(config), {
    logger: false,
    abortOnError: false,
  });
  app.enableShutdownHooks();
  await app.listen(config.http.port, config.http.host);
  console.log(
    JSON.stringify({
      entrypoint: 'http',
      state: 'ready',
      address: await app.getUrl(),
    }),
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'HTTP foundation startup failed',
  );
  process.exitCode = 1;
});
