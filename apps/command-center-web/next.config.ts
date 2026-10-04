import type { NextConfig } from 'next';

const config: NextConfig = {
  allowedDevOrigins: ['203.177.64.131', '172.16.7.53'],
  experimental: { cpus: 2 },
  poweredByHeader: false,
};
export default config;
