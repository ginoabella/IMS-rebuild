import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function initializeServiceSecrets(root, volumeExists = false) {
  const secret = `${root}.local/shared-services/postgres-password`;
  if (!existsSync(secret)) {
    if (volumeExists)
      throw new Error(
        'Restore .local/shared-services/postgres-password before using the existing database volume',
      );
    mkdirSync(`${root}.local/shared-services`, {
      recursive: true,
      mode: 0o700,
    });
    writeFileSync(secret, randomBytes(32).toString('hex'), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  const runtimeSecret = `${root}.local/shared-services/runtime-postgres-password`;
  if (!existsSync(runtimeSecret))
    writeFileSync(runtimeSecret, randomBytes(32).toString('hex'), {
      flag: 'wx',
      mode: 0o600,
    });
  for (const name of ['session', 'realtime']) {
    const authFile = `${root}.local/shared-services/${name}-redis-auth.conf`;
    if (!existsSync(authFile)) {
      // The parent directory is owner-only; mounted files must be readable by Redis.
      writeFileSync(
        authFile,
        `requirepass ${randomBytes(32).toString('hex')}\n`,
        { flag: 'wx', mode: 0o444 },
      );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeServiceSecrets(
    fileURLToPath(new URL('../', import.meta.url)),
    process.argv.includes('--existing-database'),
  );
}
