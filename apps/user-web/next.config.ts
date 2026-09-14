import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  transpilePackages: ["@listenup/api-client"],
};

export default nextConfig;
