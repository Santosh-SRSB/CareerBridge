import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@careerbridge/shared"],
  serverExternalPackages: ["@prisma/client", "prisma", "pdf-parse", "pdfjs-dist"],
  // Avoid sharp/jest-worker crashes on large local PNGs during image optimization.
  images: {
    unoptimized: true,
  },
  // Allow Firebase phone OTP testing via http://127.0.0.1:3000
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
