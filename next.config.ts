import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode double-mounts effects in dev, which fights Daily's one-call-per-page rule.
  reactStrictMode: false,
};

export default nextConfig;
