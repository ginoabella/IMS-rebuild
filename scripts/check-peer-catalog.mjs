// Local installed adapter contract; temporary nonsecret deployment config only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { FilePbxCatalog } = backend(
  './dist/modules/telephony/adapters/connectivity/catalog.js',
);
const directory = mkdtempSync(join(tmpdir(), 'peer-catalog-'));
try {
  const installationId = 'f4000000-0000-4000-8000-000000000001';
  const profile = {
    installationId,
    targetAlias: 'first',
    aliases: ['alias'],
    host: 'first.invalid',
    transport: 'ami-tls',
    port: 5039,
    tlsServerName: 'first.invalid',
    addresses: ['192.0.2.1'],
    credentialAliases: ['fixture'],
    unmanagedIngress: ['192.0.2.250'],
  };
  const file = join(directory, 'catalog.json');
  writeFileSync(
    file,
    JSON.stringify([
      profile,
      {
        ...profile,
        targetAlias: 'second',
        aliases: [],
        host: 'second.invalid',
        unmanagedIngress: ['2001:db8::1'],
      },
    ]),
  );
  const catalog = new FilePbxCatalog(file);
  assert.deepEqual(catalog.reservedSources(installationId).sort(), [
    '192.0.2.250',
    '2001:db8::1',
  ]);
  assert.deepEqual(
    catalog.reservedSources('f4000000-0000-4000-8000-000000000002'),
    [],
  );
  console.log(
    'PASS peer deployment catalog: installation-wide unmanaged ingress union, alias deduplication and foreign-installation exclusion.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
