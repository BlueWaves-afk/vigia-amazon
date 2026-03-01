import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  turbopack: {}, // Silence Turbopack warning
};

export default nextConfig;
