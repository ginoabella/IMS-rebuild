// Existing repository read-only identity check before bootstrap/provider isolation.
import { execFileSync } from 'node:child_process';
import { boundedFile, directory } from './archive.mjs';
try {
  const [expected] = process.argv.slice(2);
  if (process.argv.length !== 3 || !/^[a-f0-9]{64}$/.test(expected))
    throw new Error();
  directory('/run/client');
  const location = boundedFile('/run/client/repository.url', 2048)
    .bytes.toString()
    .trim();
  const url = new URL(location.replace(/^rest:/, ''));
  if (
    !location.startsWith('rest:https://') ||
    url.hostname !== 'rest-server' ||
    url.port !== '8000' ||
    url.pathname !== '/uploader/' ||
    url.username !== 'uploader' ||
    !url.password ||
    url.search ||
    url.hash
  )
    throw new Error();
  boundedFile('/run/client/repository.password', 4096);
  boundedFile('/run/client/ca.crt', 65536);
  const value = JSON.parse(
    execFileSync(
      'restic',
      [
        '--repository-file',
        '/run/client/repository.url',
        '--password-file',
        '/run/client/repository.password',
        '--cacert',
        '/run/client/ca.crt',
        '--no-cache',
        '--no-lock',
        '--json',
        'cat',
        'config',
      ],
      {
        env: { PATH: process.env.PATH, HOME: '/tmp' },
        timeout: 60000,
        maxBuffer: 16384,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ),
  );
  if (value.id !== expected || value.version !== 2) throw new Error();
  console.log(
    JSON.stringify({
      status: 'existing-repository-verified',
      repositoryId: value.id,
      repositoryWrites: 0,
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      status: 'existing-repository-unconfirmed',
      automaticRetry: false,
    }),
  );
  process.exitCode = 1;
}
