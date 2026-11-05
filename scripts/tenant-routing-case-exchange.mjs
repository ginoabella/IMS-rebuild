// Trusted host fixture coordinator. Native/Asterisk never receives owner SQL credentials.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
export async function runTenantRoutingFixture({
  name,
  database,
  docker,
  command,
}) {
  const child = spawn('docker', ['exec', name, '/bin/sh', '-c', command], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '',
    pendingLine = '',
    errors = '',
    done = false,
    code = null;
  child.stdout.on('data', (bytes) => {
    output += bytes;
    pendingLine += bytes;
    const lines = pendingLine.split('\n');
    pendingLine = lines.pop() ?? '';
    for (const line of lines)
      if (line.startsWith('PASS ')) process.stdout.write(line + '\n');
    if (output.length > 4194304) child.kill();
  });
  child.stderr.on('data', (bytes) => {
    errors += bytes;
    if (errors.length > 1048576) child.kill();
  });
  child.on('exit', (value) => {
    done = true;
    code = value;
  });
  child.on('error', () => {
    done = true;
  });
  const deadline = Date.now() + 420000;
  let lastRequest = '';
  while (!done && Date.now() < deadline) {
    const exists = spawnSync(
      'docker',
      ['exec', name, 'test', '-f', '/tmp/myims-routing-case-request.json'],
      { timeout: 3000, stdio: 'ignore' },
    );
    if (exists.status === 0) {
      const request = docker([
        'exec',
        name,
        'cat',
        '/tmp/myims-routing-case-request.json',
      ]);
      if (request.length > 4096)
        throw new Error('Owned manifest request bound');
      const value = JSON.parse(request);
      if (value.requestId !== lastRequest) {
        if (!/^[a-f0-9-]{36}$/.test(value.requestId ?? ''))
          throw new Error('Owned manifest request identity');
        const result = JSON.parse(
          docker(
            [
              'exec',
              '--user',
              'node',
              'myims-rebuild-dev-workspace-1',
              'node',
              '/workspace/scripts/pbx-live-database-fixture.mjs',
              'add-routing-case',
              database,
              JSON.stringify(value),
            ],
            15000,
          ),
        );
        docker([
          'exec',
          name,
          'node',
          '-e',
          "require('node:fs').writeFileSync('/tmp/myims-routing-case-response.json',process.argv[1],{mode:0o600})",
          JSON.stringify({ requestId: value.requestId, caseId: result.caseId }),
        ]);
        lastRequest = value.requestId;
      }
    }
    await delay(100);
  }
  if (!done) {
    child.kill();
    throw new Error('Owned native routing fixture deadline');
  }
  if (code !== 0)
    throw new Error(
      `Owned native routing failed: ${output.slice(-6000)} ${errors.slice(-4000)}`,
    );
  return output;
}
