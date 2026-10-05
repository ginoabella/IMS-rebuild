import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const { GarageStorage } = require(
  `${root}services/backend/dist/infrastructure/storage/garage-storage.js`,
);
const { loadStorageConfig } = require(
  `${root}services/backend/dist/infrastructure/storage/configuration.js`,
);
const { digest } = require(
  `${root}services/backend/dist/infrastructure/storage/port.js`,
);
process.on('message', async (input) => {
  const storage = new GarageStorage(loadStorageConfig());
  try {
    if (input.operation === 'write')
      await storage.write(
        input.reference,
        Buffer.from(input.bytes, 'base64'),
        input.call,
      );
    const bytes = await storage.read(input.reference, input.call);
    process.send({
      state: 'complete',
      sha256: digest(bytes),
      size: bytes.length,
    });
  } catch (error) {
    process.send({ state: 'failed', code: error.code ?? 'unexpected' });
  } finally {
    storage.close();
    process.disconnect();
  }
});
