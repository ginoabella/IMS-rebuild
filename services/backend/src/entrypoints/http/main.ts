import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { HttpModule } from './http.module';

async function main() {
  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }
  const app = await NestFactory.create(HttpModule, { logger: false });
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.log(
    JSON.stringify({
      entrypoint: 'http',
      state: 'ready',
      address: await app.getUrl(),
    }),
  );
}

void main().catch(() => {
  console.error('HTTP foundation startup failed');
  process.exitCode = 1;
});
