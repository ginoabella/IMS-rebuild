import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { parseDatabaseConfig, parseWorkerConfig } from '@myims/config';
import { resolveConnection } from '../../infrastructure/configuration';
import { DeliveryWorker } from '../../infrastructure/worker/delivery';
import { installWorkerShutdown } from '../../infrastructure/worker/shutdown';
import { WorkerModule } from './worker.module';
async function main() {
  const settings = parseWorkerConfig(process.env);
  const url = resolveConnection(parseDatabaseConfig(process.env), 'DATABASE');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
  });
  const worker = new DeliveryWorker(url, settings);
  try {
    await worker.start();
  } catch (error) {
    await app.close();
    throw error;
  }
  installWorkerShutdown(worker, () => app.close());
}
void main().catch(() => {
  console.error(
    JSON.stringify({
      entrypoint: 'worker',
      state: 'failed',
      failureCode: 'startup_failed',
    }),
  );
  process.exitCode = 1;
});
