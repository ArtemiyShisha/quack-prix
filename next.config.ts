import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.QUACK_RUNTIME === 'sites' ? undefined : 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
};

export default nextConfig;
