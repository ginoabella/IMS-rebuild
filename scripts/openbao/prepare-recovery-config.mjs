// PREPARATION ONLY. Generates a standalone config; never applies it or changes normal HCL.
import { readFileSync, writeFileSync } from 'node:fs';
const [destination] = process.argv.slice(2);
try {
  if (process.argv.length !== 3 || !destination) throw new Error();
  const normal = readFileSync('infra/openbao/server.hcl', 'utf8');
  const setting = /disable_unauthed_generate_root_endpoints\s*=\s*true/g;
  if (
    [...normal.matchAll(setting)].length !== 1 ||
    !/tls_min_version\s*=\s*"tls12"/.test(normal) ||
    /tls_disable\s*=\s*true/.test(normal)
  )
    throw new Error();
  const temporary = normal.replace(
    setting,
    'disable_unauthed_generate_root_endpoints = false',
  );
  writeFileSync(destination, temporary, { mode: 0o644, flag: 'wx' });
  console.log(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'config_prepared_not_applied',
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      failureCode: 'recovery_config_not_prepared',
    }),
  );
  process.exitCode = 1;
}
