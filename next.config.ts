import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use this directory as project root (avoids wrong root when multiple lockfiles exist).
  turbopack: { root: __dirname },
  // Ensure production build traces from this directory.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
