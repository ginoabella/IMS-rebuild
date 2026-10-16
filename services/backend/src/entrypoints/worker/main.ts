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
  let credential:
    | ReturnType<
        typeof import('../../modules/telephony/adapters/credentials/worker-runtime').credentialWorkerRuntime
      >
    | undefined;
  const mode = process.env.WORKER_CONSUMER ?? 'ordinary';
  if (!['ordinary', 'endpoint-credentials'].includes(mode))
    throw new Error('Invalid worker consumer');
  const consumer =
    mode === 'endpoint-credentials'
      ? {
          get installationId() {
            return credential!.installationId;
          },
          execute: (operation: string, work: string, attempt: number) =>
            credential!.execute(operation, work, attempt),
          reconcileExhausted: () => credential!.reconcileExhausted(),
        }
      : undefined;
  const worker = new DeliveryWorker(url, settings, {}, consumer);
  if (consumer) {
    const { credentialWorkerRuntime } =
      await import('../../modules/telephony/adapters/credentials/worker-runtime');
    credential = credentialWorkerRuntime(url, worker.pool);
  }
  try {
    if (credential) await credential.provider.renew();
    await worker.start();
  } catch (error) {
    await credential?.close();
    await app.close();
    throw error;
  }
  installWorkerShutdown(worker, async () => {
    await credential?.close();
    await app.close();
  });
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
