// Read-only development storage probe. No OpenBao network, repo init or data writes.
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
try {
  const directory = '/run/client';
  const location = new URL(
    readFileSync(directory + '/repository.url', 'utf8')
      .trim()
      .replace(/^rest:/, ''),
  );
  if (
    location.protocol !== 'https:' ||
    location.hostname !== 'rest-server' ||
    location.port !== '8000' ||
    location.pathname !== '/uploader/'
  )
    throw new Error('Invalid probe scope');
  const ca = readFileSync(directory + '/ca.crt');
  const get = (path, authenticated) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          protocol: 'https:',
          hostname: 'rest-server',
          port: 8000,
          path,
          method: 'GET',
          ca,
          ...(authenticated
            ? {
                auth:
                  decodeURIComponent(location.username) +
                  ':' +
                  decodeURIComponent(location.password),
              }
            : {}),
        },
        (res) => {
          res.resume();
          res.once('end', () => resolve(res.statusCode));
          res.once('error', reject);
        },
      );
      const timer = setTimeout(() => req.destroy(new Error('Timeout')), 3000);
      req.once('close', () => clearTimeout(timer));
      req.once('error', reject);
      req.end();
    });
  // Repeating read-only readiness checks creates no identity or backup data.
  let authenticated;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      authenticated = await get('/uploader/config', true);
      break;
    } catch {
      if (attempt === 19) throw new Error();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (
    authenticated !== 404 ||
    (await get('/uploader/config', false)) !== 401 ||
    (await get('/other/config', true)) !== 401
  )
    throw new Error();
  console.log(
    JSON.stringify({
      status: 'passed',
      tlsHostnameAndCaValidated: true,
      authenticatedAccessVerified: true,
      anonymousDenied: true,
      otherRepositoryDenied: true,
      repositoryInitialized: false,
      repositoryWrites: 0,
    }),
  );
} catch {
  console.error(JSON.stringify({ status: 'failed', stage: 'storage_probe' }));
  process.exitCode = 1;
}
