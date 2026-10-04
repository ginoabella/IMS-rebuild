import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function check(entrypoint) {
  const args =
    entrypoint === 'http' ? [] : ['--import', `${root}scripts/deny-listen.mjs`];
  args.push(`${root}services/backend/dist/entrypoints/${entrypoint}/main.js`);
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/myims',
      DATABASE_PASSWORD_FILE: undefined,
      SESSION_REDIS_URL: 'redis://:test@127.0.0.1:2',
      SESSION_REDIS_AUTH_FILE: undefined,
      REALTIME_REDIS_URL: 'redis://:test@127.0.0.1:3',
      REALTIME_REDIS_AUTH_FILE: undefined,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exit = once(child, 'exit');
  let output = '';
  let errors = '';
  child.stderr.on('data', (data) => {
    errors += data;
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
  try {
    const message = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.stdout.on('data', (data) => {
        output += data;
        const line = output
          .split('\n')
          .find(
            (item) => item.startsWith('{') && item.includes('"entrypoint"'),
          );
        if (line) {
          try {
            resolve(JSON.parse(line));
          } catch (error) {
            reject(error);
          }
        }
      });
      child.on('exit', () =>
        reject(
          new Error(`${entrypoint} exited before reporting ready: ${errors}`),
        ),
      );
    });
    assert.equal(message.entrypoint, entrypoint);
    assert.equal(
      message.state,
      entrypoint === 'deployment' ? 'complete' : 'ready',
    );
    if (entrypoint === 'http') {
      const response = await fetch(message.address, {
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        application: 'MyIMS',
        status: 'foundation',
        operational: false,
      });
    }
    if (entrypoint !== 'deployment') child.kill('SIGTERM');
    const [code, signal] = await exit;
    // Nest's HTTP shutdown hooks close the app, then restore the original signal.
    assert.ok(
      code === 0 || (entrypoint === 'http' && signal === 'SIGTERM'),
      `${entrypoint} failed to shut down: ${errors} (${signal})`,
    );
    console.log(
      `PASS: ${entrypoint} starts independently and shuts down cleanly`,
    );
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
  }
}

for (const entrypoint of ['http', 'worker', 'telephony', 'deployment'])
  await check(entrypoint);
