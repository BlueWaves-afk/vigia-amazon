import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {}, // Silence Turbopack warning
};

export default nextConfig;
