import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  distDir:
    process.env.CREDENTIAL_BROWSER_BUILD === '1'
      ? '.local/credential-next'
      : '.next',
  typescript: {
    tsconfigPath:
      process.env.CREDENTIAL_BROWSER_BUILD === '1'
        ? '.local/staff-access-tsconfig.json'
        : 'tsconfig.json',
  },
  webpack(config) {
    config.resolve.alias['@staff/work-fixture'] = resolve(
      process.cwd(),
      process.env.CREDENTIAL_BROWSER_BUILD === '1'
        ? 'app/auth/work-fixture.tsx'
        : 'app/auth/work-fixture-disabled.tsx',
    );
    config.resolve.alias['@staff/work-submit'] = resolve(
      process.cwd(),
      process.env.CREDENTIAL_BROWSER_BUILD === '1'
        ? 'app/auth/work-submit.ts'
        : 'app/auth/work-submit-disabled.ts',
    );
    return config;
  },
  allowedDevOrigins: ['203.177.64.131', '172.16.7.53'],
  experimental: { cpus: 2 },
  poweredByHeader: false,
};
export default config;
