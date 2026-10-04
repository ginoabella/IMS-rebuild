import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DeploymentModule } from './deployment.module';

async function main() {
  const app = await NestFactory.createApplicationContext(DeploymentModule, {
    logger: false,
  });
  await app.close();
  console.log(JSON.stringify({ entrypoint: 'deployment', state: 'complete' }));
}

void main().catch(() => {
  console.error('Deployment foundation startup failed');
  process.exitCode = 1;
});
