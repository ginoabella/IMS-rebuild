import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const sentinels = [
  'STORAGE_CONTENT_SENTINEL',
  'STORAGE_DEPLOYMENT_CONTENT_SENTINEL',
  'STORAGE_CREDENTIALS_FILE',
  '@aws-sdk/client-s3',
  '@aws-sdk/s3-request-presigner',
  'STORAGE_ACCESS_CONTENT_SENTINEL',
  'STORAGE_REFERENCE_ENDPOINT',
  'STORAGE_REFERENCE_DEFAULT_SECONDS',
  'X-Amz-Signature',
  'HASH_SENTINEL_Secret:MiXeD',
  'AUTHORITY_HASH_SENTINEL_Private:MiXeD',
  'authority_identity_sentinel',
  'Failure_SENTINEL',
  'Rollback_SENTINEL',
  'password_hash',
  'Bootstrap_PASSWORD_SENTINEL',
  'Rerun_PASSWORD_SENTINEL',
  'bootstrap_identity_sentinel',
  'infrastructure/password',
  'bootstrap-operator',
  '$scrypt$v=1$',
  'modules/identity/adapters/db',
  'modules/platform/adapters/db',
  'modules/identity/adapters/redis',
  'myims:session:v1:',
  'session_fences',
  'SESSION_WEB_IDLE_SECONDS',
  'credential-sentinel',
  'authentication-sentinel',
  'HTTP_GUARD_CREDENTIAL_SENTINEL',
  'modules/identity/adapters/http',
  'modules/identity/application/request-authority',
  'modules/identity/application/transaction-authority',
];
for (const role of ['runtime', 'fixture', 'denied']) {
  const credentials = JSON.parse(
    await readFile(`/run/secrets/storage_${role}`, 'utf8'),
  );
  sentinels.push(credentials.accessKeyId, credentials.secretAccessKey);
}
async function scan(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += await scan(path);
    else {
      const content = await readFile(path);
      for (const sentinel of sentinels)
        assert.ok(
          !content.includes(sentinel),
          'Client storage sentinel exclusion failed',
        );
      count++;
    }
  }
  return count;
}
for (const app of [
  'command-center-web',
  'platform-console-web',
  'public-web',
  'public-mobile',
  'responder-mobile',
]) {
  const directory = app.endsWith('-web') ? '.next/static' : 'dist';
  const count = await scan(`/workspace/apps/${app}/${directory}`);
  assert.ok(count > 0, 'Build client artifacts before running this check');
  console.log(
    `PASS: ${app} built client artifacts exclude storage and identity credential/content/configuration/import sentinels (${count} files)`,
  );
}
