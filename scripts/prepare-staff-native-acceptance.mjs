// Stages authored source only; Expo owns subsequent Android generation.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { X509Certificate } from 'node:crypto';

try {
  const origin = process.env.EXPO_PUBLIC_STAFF_AUTH_ORIGIN;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin)
    throw new Error('Exact HTTPS origin required');
  const ca = readFileSync(
    process.argv[2] ?? 'private/mkcert-rootCA.pem',
    'utf8',
  );
  if (/PRIVATE KEY/.test(ca))
    throw new Error('Only a public certificate is allowed');
  const blocks =
    ca.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ??
    [];
  if (blocks.length !== 1) throw new Error('One public root required');
  const certificate = new X509Certificate(blocks[0]);
  if (
    !certificate.ca ||
    !certificate.checkIssued(certificate) ||
    !certificate.verify(certificate.publicKey)
  )
    throw new Error('Public root required');
  if (!(
    Date.parse(certificate.validFrom) <= Date.now() &&
    Date.now() < Date.parse(certificate.validTo)
  ))
    throw new Error('Current root required');
  const source = resolve('apps/responder-mobile');
  const destination = resolve('.local/staff-native-acceptance');
  if (existsSync(destination))
    throw new Error(
      'Acceptance directory already exists; use a fresh directory after reviewing old evidence',
    );
  if (!existsSync(join(source, 'node_modules')))
    throw new Error('Install frozen dependencies first');
  mkdirSync(destination, { recursive: true });
  for (const name of ['auth', 'theme.ts', 'index.ts', 'tsconfig.json'])
    cpSync(join(source, name), join(destination, name), { recursive: true });
  cpSync(join(source, 'App.tsx'), join(destination, 'ResponderApp.tsx'));
  for (const name of [
    'App.tsx',
    'acceptance-store.ts',
    'with-acceptance-tls.cjs',
    'metro.config.cjs',
  ])
    cpSync(join('scripts/native-acceptance', name), join(destination, name));
  // Substitute only the native dependency in this copy of the same adapter.
  const storageFile = join(destination, 'auth/secure-storage.ts');
  const storageSource = readFileSync(storageFile, 'utf8');
  const importLine = "import * as SecureStore from 'expo-secure-store';";
  if (!storageSource.includes(importLine))
    throw new Error('Storage adapter import changed');
  writeFileSync(
    storageFile,
    storageSource
      .replace(
        importLine,
        "import { SecureStore } from '../acceptance-store';\nimport type { SecureStoreOptions } from 'expo-secure-store';",
      )
      .replace('SecureStore.SecureStoreOptions', 'SecureStoreOptions'),
  );
  const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  pkg.name = '@myims/responder-native-acceptance';
  writeFileSync(
    join(destination, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n',
  );
  const app = JSON.parse(readFileSync(join(source, 'app.json'), 'utf8'));
  app.expo.name = 'MyIMS Native Acceptance';
  app.expo.slug = 'myims-native-acceptance';
  app.expo.android = {
    ...app.expo.android,
    package: 'com.myims.responder.acceptance',
  };
  app.expo.plugins.push('./with-acceptance-tls.cjs');
  writeFileSync(
    join(destination, 'app.json'),
    JSON.stringify(app, null, 2) + '\n',
  );
  writeFileSync(join(destination, 'acceptance-ca.pem'), blocks[0] + '\n');
  symlinkSync(
    join(source, 'node_modules'),
    join(destination, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  console.log(
    'Prepared .local/staff-native-acceptance (com.myims.responder.acceptance).',
  );
  console.log('Public root CA SHA256:', certificate.fingerprint256);
  console.log(
    'Run Expo prebuild/run in this directory. Real device acceptance remains required.',
  );
} catch {
  console.error(
    'Native acceptance preparation failed. Check exact HTTPS origin, public root CA, dependencies and unused output directory. No secrets logged.',
  );
  process.exitCode = 1;
}
