import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/workspace/services/backend/package.json');
const {
  GarageStorage,
} = require('./dist/infrastructure/storage/garage-storage.js');
const {
  loadStorageConfig,
} = require('./dist/infrastructure/storage/configuration.js');
const config = loadStorageConfig({
  ...process.env,
  STORAGE_ENABLED: 'true',
  STORAGE_BUCKET: 'myims-artifacts',
  STORAGE_CREDENTIALS_FILE: '/run/secrets/storage_runtime',
});
// Endpoint override is confined to trusted isolated-provider acceptance tooling.
const storage = new GarageStorage(
  { ...config, endpoint: process.argv[3] },
  () => {},
);
const bytes = Buffer.from('STORAGE_DEPLOYMENT_CONTENT_SENTINEL');
let input = '';
for await (const chunk of process.stdin) input += chunk;
try {
  const reference = input
    ? JSON.parse(input)
    : storage.assign(randomUUID(), bytes);
  if (process.argv[2] === 'write')
    await storage.write(reference, bytes, { correlationId: randomUUID() });
  assert.deepEqual(
    await storage.read(reference, { correlationId: randomUUID() }),
    bytes,
  );
  console.log(JSON.stringify(reference));
} catch {
  console.error('Storage deployment fixture failed');
  process.exitCode = 1;
} finally {
  storage.close();
}
