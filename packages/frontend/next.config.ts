import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // NOTE: Do NOT externalize AWS SDK packages for Amplify SSR.
  // With Turbopack builds, Amplify can fail at runtime attempting to require a
  // non-existent hashed external module name (e.g. "@aws-sdk/client-...-<hash>").
  // Bundling the AWS SDK avoids that failure mode.
};

export default nextConfig;
