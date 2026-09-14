import type { NextConfig } from "next";
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://localhost:4000; media-src 'self' data: blob: http://localhost:4000; connect-src 'self' http://localhost:4000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  transpilePackages: ["@listenup/domain", "@listenup/api-client", "@listenup/auth", "@listenup/config", "@listenup/mock-api"],
  async headers() { return [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: csp }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }]; },
};
export default nextConfig;
