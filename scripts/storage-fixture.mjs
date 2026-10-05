import { fixturePorts } from './storage-access-fixtures.mjs';
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
const { ArtifactAccess } = require(
  `${root}services/backend/dist/infrastructure/storage/artifact-access.js`,
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
    let bytes;
    if (input.operation === 'access') {
      const ports = fixturePorts(input.records, input.allowedActorIds);
      const access = new ArtifactAccess(
        ports.ownership,
        ports.permission,
        storage,
        loadStorageConfig().maxBytes,
      );
      const signed = await access.reference(
        input.actor,
        input.artifactId,
        input.call,
      );
      const response = await fetch(signed.url, {
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (response.status !== 200) throw new Error();
      bytes = new Uint8Array(await response.arrayBuffer());
    } else bytes = await storage.read(input.reference, input.call);
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
