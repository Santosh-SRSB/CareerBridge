import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@careerbridge/shared"],
  serverExternalPackages: ["@prisma/client", "prisma", "pdf-parse", "pdfjs-dist", "openai"],
  // Avoid sharp/jest-worker crashes on large local PNGs during image optimization.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
