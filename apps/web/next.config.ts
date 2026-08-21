import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@careerbridge/shared"],
  serverExternalPackages: ["@prisma/client", "prisma", "pdf-parse", "pdfjs-dist", "openai"],
};

export default nextConfig;
