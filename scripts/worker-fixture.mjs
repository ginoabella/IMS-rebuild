// Disposable test process: explicit IPC barriers; production has no fault env switches.
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { DeliveryWorker } = backend('./dist/infrastructure/worker/delivery.js');
const { installWorkerShutdown } = backend(
  './dist/infrastructure/worker/shutdown.js',
);
const { parseWorkerConfig } = backend('@myims/config');
let interrupted = false;
const worker = new DeliveryWorker(
  process.env.DATABASE_URL,
  parseWorkerConfig(process.env),
  {
    barrier: async (stage, workId) => {
      if (
        !interrupted &&
        stage === process.argv[2] &&
        workId === process.argv[3]
      ) {
        interrupted = true;
        process.send?.({ stage, workId });
        await new Promise((resolve) => process.once('message', resolve));
      }
    },
  },
);
await worker.start();
process.send?.({ stage: 'ready' });
process.once('SIGTERM', () => process.send?.({ stage: 'stopping' }));
installWorkerShutdown(worker, async () => process.disconnect());
