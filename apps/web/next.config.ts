import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@careerbridge/shared"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  // DEV Cloud Run: ship while pre-existing TS debt is cleaned up.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Avoid sharp/jest-worker crashes on large local PNGs during image optimization.
  images: {
    unoptimized: true,
  },
  // Allow Firebase phone OTP testing via http://127.0.0.1:3000
  allowedDevOrigins: ["127.0.0.1"],
  // Monorepo: force a single React copy (prevents prerender "use" null crashes).
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.join(monorepoRoot, "node_modules/react"),
      "react-dom": path.join(monorepoRoot, "node_modules/react-dom"),
    };
    return config;
  },
};

export default nextConfig;
