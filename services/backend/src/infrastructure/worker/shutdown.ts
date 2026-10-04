import type { DeliveryWorker } from './delivery';

// Shared by the production entrypoint and isolated recovery process fixture.
export function installWorkerShutdown(
  worker: DeliveryWorker,
  close: () => Promise<void>,
) {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      console.log(
        JSON.stringify({
          entrypoint: 'worker',
          state: 'failed',
          failureCode: 'shutdown_timeout',
        }),
      );
      process.exit(1);
    }, worker.settings.shutdownMs + 6000);
    void worker
      .stop()
      .then(close)
      .then(() => clearTimeout(deadline))
      .catch(() => {
        process.exitCode = 1;
      });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
