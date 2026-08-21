import path from "path";
import type { NextConfig } from "next";

const repo = "CareerBridge";
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}` : "",
  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./image-loader.ts",
  },
  transpilePackages: ["@careerbridge/shared"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  typescript: { ignoreBuildErrors: true },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;

