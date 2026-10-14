import 'reflect-metadata';
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
  const runtime = new TelephonyObservationRuntime(
    resolveConnection(parseDatabaseConfig(process.env), 'DATABASE'),
    catalog,
    configuration,
  );
  const app = await NestFactory.createApplicationContext(TelephonyModule, {
    logger: false,
  });
  try {
    await runtime.start();
  } catch {
    await runtime.stop();
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
