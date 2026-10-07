import type { NextConfig } from 'next';

const config: NextConfig = {
  distDir:
    process.env.CREDENTIAL_BROWSER_BUILD === '1'
      ? '.local/credential-next'
      : '.next',
  allowedDevOrigins: ['203.177.64.131', '172.16.7.53'],
  experimental: { cpus: 2 },
  poweredByHeader: false,
};
export default config;
