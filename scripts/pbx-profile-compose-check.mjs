import { spawnSync } from 'node:child_process';
import { assertProfileComposition } from './pbx-profile-compose.mjs';
const result = assertProfileComposition((args) => {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 2097152,
  });
  if (r.status !== 0) throw new Error('Profile composition unavailable');
  return r.stdout;
});
console.log(JSON.stringify(result));
