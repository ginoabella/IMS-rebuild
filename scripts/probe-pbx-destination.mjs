// Read-only approved local target probe. No socket connection or secret resolver.
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { FilePbxCatalog } = backend(
  './dist/modules/telephony/adapters/connectivity/catalog.js',
);
const { ExactPbxDestinationPolicy } = backend(
  './dist/modules/telephony/adapters/connectivity/destination.js',
);
try {
  const catalog = new FilePbxCatalog(
    process.env.PBX_CATALOG_FILE ||
      '/workspace/.local/pbx-catalog/catalog.json',
  );
  const profile = catalog.resolve('local-asterisk');
  const result = profile
    ? await new ExactPbxDestinationPolicy(catalog).destination(profile)
    : { kind: 'destination_denied' };
  console.log(
    JSON.stringify({
      boundary: 'read-only-controlled-dns',
      outcome: result.kind,
      authenticated: false,
    }),
  );
  process.exitCode = result.kind === 'approved' ? 0 : 1;
} catch {
  console.log(
    JSON.stringify({
      boundary: 'read-only-controlled-dns',
      outcome: 'configuration_unavailable',
      authenticated: false,
    }),
  );
  process.exitCode = 1;
}
