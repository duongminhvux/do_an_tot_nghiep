import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bound build workers when Docker reports every host CPU.
  experimental: { cpus: 2 },
};

export default nextConfig;
