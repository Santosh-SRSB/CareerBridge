import type { NextConfig } from "next";

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
};

export default nextConfig;
