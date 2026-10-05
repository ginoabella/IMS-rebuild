import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const container =
  process.env.STORAGE_PROVISION_CONTAINER ?? 'myims-rebuild-dev-garage-1';
function garage(args) {
  // CLI output may contain credentials. Always capture and discard it.
  try {
    return execFileSync('docker', ['exec', container, '/garage', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
  } catch {
    throw new Error('Storage provisioning operation failed');
  }
}
function exists(args) {
  try {
    garage(args);
    return true;
  } catch {
    return false;
  }
}
try {
  for (const [name, bucket, permissions] of [
    ['runtime', 'myims-artifacts', ['--read', '--write']],
    ['fixture', 'myims-storage-fixtures', ['--read', '--write']],
    ['denied', 'myims-storage-fixtures', []],
  ]) {
    const credentials = JSON.parse(
      readFileSync(
        `${root}.local/shared-services/storage-${name}.json`,
        'utf8',
      ),
    );
    if (!exists(['key', 'info', credentials.accessKeyId]))
      garage([
        'key',
        'import',
        '--yes',
        '-n',
        `myims-${name}`,
        credentials.accessKeyId,
        credentials.secretAccessKey,
      ]);
    if (!exists(['bucket', 'info', bucket]))
      garage(['bucket', 'create', bucket]);
    if (permissions.length)
      garage([
        'bucket',
        'allow',
        bucket,
        '--key',
        credentials.accessKeyId,
        ...permissions,
      ]);
    // Explicitly remove administration and global create-bucket privileges on rerun.
    garage([
      'bucket',
      'deny',
      bucket,
      '--key',
      credentials.accessKeyId,
      '--owner',
    ]);
    garage(['key', 'deny', credentials.accessKeyId, '--create-bucket']);
  }
  console.log(
    'Storage provisioned: private development/fixture buckets; runtime administration denied',
  );
} catch {
  console.error(
    'Storage provisioning failed; check service health and restore the original local secret files',
  );
  process.exitCode = 1;
}
