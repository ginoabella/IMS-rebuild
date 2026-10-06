// Trusted Docker fixture launcher. No socket or deployment secret is added to HTTP.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const name = `myims-session-check-${randomBytes(6).toString('hex')}`;
const password = randomBytes(32).toString('hex');
const directory = mkdtempSync(join(tmpdir(), 'myims-session-'));
function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0)
    throw new Error('Session fixture Docker operation failed');
  return r.stdout;
}
let created = false;
try {
  docker([
    'create',
    '--name',
    name,
    '--network',
    'myims-rebuild-dev_default',
    '--memory',
    '192m',
    '--entrypoint',
    'redis-server',
    'redis:8-alpine@sha256:3811787313eba226a2ef38658c6ccb91cd5e110edc89c37767de373120a0e5a0',
    '/tmp/session.conf',
  ]);
  created = true;
  const path = join(directory, 'session.conf');
  writeFileSync(
    path,
    `bind 0.0.0.0\nprotected-mode yes\nport 6379\nrequirepass ${password}\ndir /data\nappendonly yes\nappendfsync always\nsave ""\nmaxmemory 128mb\nmaxmemory-policy noeviction\n`,
    { mode: 0o600 },
  );
  docker(['cp', path, `${name}:/tmp/session.conf`]);
  docker(['start', name]);
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
      '--user',
      'node',
      'myims-rebuild-dev-workspace-1',
      'pnpm',
      'check:session-foundation',
      '--lifecycle',
    ],
    { stdio: ['pipe', 'pipe', 'inherit'] },
  );
  let output = '';
  child.stdout.on('data', (bytes) => {
    output += bytes.toString();
    let newline;
    while ((newline = output.indexOf('\n')) >= 0) {
      const line = output.slice(0, newline);
      output = output.slice(newline + 1);
      if (line === 'SESSION_FIXTURE_RESTART') docker(['restart', name]);
      else process.stdout.write(`${line}\n`);
    }
  });
  child.stdin.end(
    JSON.stringify({ redisUrl: `redis://:${password}@${name}:6379` }),
  );
  const timer = setTimeout(() => child.kill('SIGKILL'), 240000);
  const [code] = await once(child, 'exit');
  clearTimeout(timer);
  if (code !== 0) throw new Error('Session lifecycle checks failed');
} finally {
  if (created) docker(['rm', '-f', '-v', name]);
  rmSync(directory, { recursive: true, force: true });
}
