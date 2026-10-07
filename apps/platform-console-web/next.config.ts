import type { NextConfig } from 'next';

const browserCheck = process.env.PLATFORM_AUTH_BROWSER_BUILD === '1';
const config: NextConfig = {
  distDir: browserCheck ? '.local/platform-auth-next' : '.next',
  typescript: {
    tsconfigPath: browserCheck
      ? '.local/platform-auth-tsconfig.json'
      : 'tsconfig.json',
  },
  experimental: { cpus: 2 },
  poweredByHeader: false,
};
export default config;
