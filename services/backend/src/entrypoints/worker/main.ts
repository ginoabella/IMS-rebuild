import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function main() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
  });
  const keepAlive = setInterval(() => {}, 60_000);
  const shutdown = () => {
    clearInterval(keepAlive);
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  console.log(
    JSON.stringify({
      entrypoint: 'worker',
      state: 'ready',
      capabilities: 'pending',
    }),
  );
}

void main().catch(() => {
  console.error('Worker foundation startup failed');
  process.exitCode = 1;
});
