import 'reflect-metadata';
import { liveConfiguration } from '../../modules/telephony/adapters/live/configuration';
import { LiveExecutionStore } from '../../modules/telephony/adapters/live/execution-store';
import { ExactLiveMaterialConsumer } from '../../modules/telephony/adapters/live/exact-material';
import { LiveMaterialResolver } from '../../modules/telephony/adapters/live/material-resolver';
import { LiveOwnerExecutor } from '../../modules/telephony/adapters/live/owner-executor';
import { NativeOwnerClient } from '../../modules/telephony/adapters/live/native-transport';
import { NestFactory } from '@nestjs/core';
import { parseDatabaseConfig } from '@myims/config';
import { resolveConnection } from '../../infrastructure/configuration';
import { TelephonyObservationRuntime } from '../../modules/telephony/adapters/observation/runtime';
import { TelephonyModule } from './telephony.module';
async function main() {
  // Explicit local-development mode prevents accidental production activation.
  if (process.env.PBX_OBSERVATION_PROFILE !== 'approved-local-development')
    throw new Error('Observation profile unavailable');
  const catalog = process.env.PBX_CATALOG_FILE,
    configuration = process.env.PBX_OBSERVATION_CONFIG_FILE;
  if (!catalog || !configuration)
    throw new Error('Observation configuration unavailable');
  let liveStore: LiveExecutionStore | undefined;
  let execution: LiveOwnerExecutor | undefined;
  if (process.env.PBX_LIVE_PROFILE === 'approved-local-development') {
    const configuration = liveConfiguration(
      '/run/pbx-live-consumer/configuration.json',
      true,
    );
    liveStore = new LiveExecutionStore(configuration.database);
    execution = new LiveOwnerExecutor(
      configuration.installationId,
      configuration.nodeId,
      liveStore,
      new LiveMaterialResolver(
        liveStore.pool,
        new ExactLiveMaterialConsumer({
          installationId: configuration.installationId,
          endpoint: 'https://endpoint-secrets:8200',
          tokenFile: configuration.providerTokenFile,
          caFile: configuration.providerCaFile,
        }),
      ),
      new NativeOwnerClient('/run/pbx-live/native.sock'),
    );
  } else if (process.env.PBX_LIVE_PROFILE)
    throw new Error('Live profile unavailable');
  const runtime = new TelephonyObservationRuntime(
    resolveConnection(parseDatabaseConfig(process.env), 'DATABASE'),
    catalog,
    configuration,
    execution,
  );
  const app = await NestFactory.createApplicationContext(TelephonyModule, {
    logger: false,
  });
  try {
    await runtime.start();
  } catch {
    await runtime.stop();
    await liveStore?.close();
    await app.close();
    throw new Error('Observation startup failed');
  }
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const hard = setTimeout(() => process.exit(1), 5500);
    void runtime
      .stop()
      .then(() => liveStore?.close())
      .then(() => app.close())
      .catch(() => {
        process.exitCode = 1;
      })
      .finally(() => clearTimeout(hard));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  console.log(
    JSON.stringify({
      entrypoint: 'telephony',
      state: 'ready',
      capabilities: 'pbx-observation',
      profile: 'local-development',
    }),
  );
}
void main().catch(() => {
  console.error(
    JSON.stringify({
      entrypoint: 'telephony',
      state: 'failed',
      failureCode: 'startup_failed',
    }),
  );
  process.exitCode = 1;
});
