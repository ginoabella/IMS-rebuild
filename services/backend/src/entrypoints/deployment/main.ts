import { bootstrap } from './bootstrap';
import { ConfigurationError } from '@myims/config';
import {
  migrate,
  DeploymentError,
} from '../../infrastructure/database/migrations';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DeploymentModule } from './deployment.module';

async function main() {
  const command = process.argv[2];
  if (command === 'bootstrap-operator') {
    await bootstrap(process.argv.slice(3));
    return;
  }
  if (command !== undefined && command !== 'migrate')
    throw new ConfigurationError('Unknown deployment command; use migrate');
  if (command === 'migrate') await migrate();
  const app = await NestFactory.createApplicationContext(DeploymentModule, {
    logger: false,
  });
  await app.close();
  console.log(JSON.stringify({ entrypoint: 'deployment', state: 'complete' }));
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigurationError || error instanceof DeploymentError
      ? error.message
      : 'Deployment migration/startup failed; verify database access and migration history',
  );
  process.exitCode = 1;
});
