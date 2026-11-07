// Shared trusted host protocol: tests use the same one-shot dispatch/SQL fence.
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
export async function dispatchProfileRestart({
  workspacePrefix,
  identity,
  nativeContainer,
  targetArtifactId,
  targetDigest,
  effect,
}) {
  const child = spawn(
    'docker',
    [
      ...workspacePrefix,
      'node',
      '/workspace/scripts/pbx-profile-operation.mjs',
      'dispatch',
      JSON.stringify(identity),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  child.stderr.resume();
  let started = false;
  const exit = new Promise((resolve) => {
    child.once('exit', (code) => resolve(code));
    child.once('error', () => resolve(-1));
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Profile dispatch readiness unavailable')),
        10000,
      );
      const lines = createInterface({ input: child.stdout });
      lines.on('line', async (line) => {
        let data;
        try {
          data = JSON.parse(line);
        } catch {
          return;
        }
        if (!data.dispatchReady || started) return;
        started = true;
        clearTimeout(timer);
        try {
          if (
            !/^[1-9][0-9]{0,18}$/.test(data.epoch) ||
            !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
              data.incarnation,
            )
          )
            throw new Error();
          const check = spawnSync(
            'docker',
            [
              'exec',
              '-i',
              nativeContainer,
              'node',
              '--input-type=module',
              '-',
              JSON.stringify({
                ...identity,
                epoch: data.epoch,
                incarnation: data.incarnation,
                targetArtifactId,
                targetDigest,
              }),
            ],
            {
              input: readFileSync(
                new URL('./pbx-profile-restart-ready.mjs', import.meta.url),
              ),
              encoding: 'utf8',
              timeout: 5000,
              maxBuffer: 1048576,
            },
          );
          if (
            check.status !== 0 ||
            JSON.parse(check.stdout).restartReady !== true
          )
            throw new Error();
          await effect();
          child.stdin.end('{"dispatched":true}\n');
          resolve();
        } catch {
          child.stdin.end('{"dispatched":false}\n');
          reject(
            new Error('Profile restart uncertain; reconcile exact operation'),
          );
        }
      });
      void exit.then(() => {
        clearTimeout(timer);
        if (!started) reject(new Error('Profile dispatch rejected'));
      });
    });
    if ((await exit) !== 0)
      throw new Error('Profile dispatch acknowledgement uncertain');
  } finally {
    child.stdin.end();
  }
}
