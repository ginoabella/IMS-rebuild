import type { NextConfig } from 'next';

const config: NextConfig = {
  allowedDevOrigins: ['203.177.64.131'],
  experimental: { cpus: 2 },
  poweredByHeader: false,
};
export default config;
