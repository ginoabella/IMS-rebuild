import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const composeArgs = ['compose', '-f', `${root}infra/docker/compose.yaml`];
const actions = new Set(['up', 'down', 'status', 'check']);
const action = process.argv[2];

function docker(args, capture = false) {
  return execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}
function compose(args, capture = false) {
  return docker([...composeArgs, ...args], capture);
}

try {
  if (!actions.has(action))
    throw new Error(
      'Use services:up, services:down, services:status or services:check',
    );
  docker(['info', '--format', '{{.ServerVersion}}'], true);
  if (action === 'up') {
    const secret = `${root}.local/shared-services/postgres-password`;
    if (!existsSync(secret)) {
      let volumeExists = false;
      try {
        docker(['volume', 'inspect', 'myims-rebuild-dev_postgres-data'], true);
        volumeExists = true;
      } catch {
        /* A fresh installation has no volume. */
      }
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
    compose(['config', '--quiet']);
    compose(['up', '-d', '--wait', '--wait-timeout', '120']);
    console.log(
      'Shared containers are healthy. Run pnpm services:check to verify them.',
    );
  } else if (action === 'down') {
    compose(['down']);
    console.log(
      'Shared containers stopped; named data volumes and the local password are retained.',
    );
  } else if (action === 'status') {
    compose(['ps']);
  } else {
    const version = compose(
      [
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'myims',
        '-d',
        'myims',
        '-v',
        'ON_ERROR_STOP=1',
        '-Atc',
        'SELECT postgis_version();',
      ],
      true,
    ).trim();
    assert.match(version, /^3\./);
    console.log('PASS: PostgreSQL and PostGIS respond');
    for (const service of ['session-redis', 'realtime-redis']) {
      assert.equal(
        compose(
          [
            'exec',
            '-T',
            service,
            'sh',
            '-c',
            'export REDISCLI_AUTH="$(sed -n \'s/^requirepass //p\' /run/secrets/redis_auth)"; exec redis-cli ping',
          ],
          true,
        ).trim(),
        'PONG',
      );
      console.log(`PASS: ${service} responds`);
    }
    const pbxVersion = compose(
      ['exec', '-T', 'asterisk', 'asterisk', '-rx', 'core show version'],
      true,
    );
    assert.match(pbxVersion, /Asterisk 22\./);
    const transports = compose(
      ['exec', '-T', 'asterisk', 'asterisk', '-rx', 'pjsip show transports'],
      true,
    );
    assert.match(transports, /transport-udp/);
    console.log(
      'PASS: Asterisk 22 responds and its development SIP transport is loaded',
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Shared-services command failed',
  );
  process.exitCode = 1;
}
