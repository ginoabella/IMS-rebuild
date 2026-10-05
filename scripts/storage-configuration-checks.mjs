import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function checkStorageStartup(root, env, captured, outageEndpoint) {
  const directory = await mkdtemp(join(tmpdir(), 'storage-config-'));
  const invalid = join(directory, 'credentials.json');
  await writeFile(
    invalid,
    JSON.stringify({
      accessKeyId: 'STARTUP_SECRET_SENTINEL',
      secretAccessKey: 'STARTUP_SECRET_SENTINEL',
    }),
  );
  async function launch(overrides, health = false) {
    const child = spawn(
      process.execPath,
      [`${root}services/backend/dist/entrypoints/http/main.js`],
      {
        env: { ...env, HOST: '127.0.0.1', PORT: '0', ...overrides },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const exit = once(child, 'exit');
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
      captured.push(data.toString());
    });
    child.stderr.on('data', (data) => {
      output += data;
      captured.push(data.toString());
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    try {
      if (health) {
        let ready;
        for (let attempt = 0; attempt < 100; attempt++) {
          const line = output
            .split('\n')
            .find((line) => line.includes('"entrypoint":"http"'));
          if (line) {
            ready = JSON.parse(line);
            break;
          }
          if (child.exitCode !== null) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.equal(ready?.state, 'ready');
        for (const route of ['live', 'ready']) {
          const response = await fetch(`${ready.address}/health/${route}`, {
            signal: AbortSignal.timeout(3000),
          });
          assert.equal(response.status, 200);
          await response.arrayBuffer();
        }
        child.kill('SIGTERM');
        const [code, signal] = await exit;
        assert.ok(code === 0 || signal === 'SIGTERM');
      } else {
        const [code] = await exit;
        assert.equal(code, 1);
        assert.ok(!output.includes('"state":"ready"'));
        assert.match(output, /STORAGE/);
      }
      assert.ok(!output.includes('STARTUP_SECRET_SENTINEL'));
    } finally {
      clearTimeout(timer);
      child.kill('SIGKILL');
    }
  }
  try {
    await launch({ STORAGE_ENDPOINT: '' });
    await launch({ STORAGE_REFERENCE_ENDPOINT: '' });
    await launch({ STORAGE_REFERENCE_DEFAULT_SECONDS: '301' });
    await launch({ STORAGE_REFERENCE_DEFAULT_SECONDS: '0' });
    await launch({
      STORAGE_REFERENCE_ENDPOINT:
        'https://user:STARTUP_SECRET_SENTINEL@example.test',
    });
    await launch({ STORAGE_CREDENTIALS_FILE: invalid });
    await launch({ STORAGE_CREDENTIALS_FILE: '/missing-startup-secret' });
    await launch({ STORAGE_ENDPOINT: outageEndpoint }, true);
    console.log(
      'PASS: enabled HTTP startup rejects invalid/missing settings and credential files safely; no-storage-consumer HTTP liveness/readiness remain independent of provider outage',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
