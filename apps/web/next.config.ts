import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@careerbridge/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
        ],
      },
    ];
  },
  // Avoid sharp/jest-worker crashes on large local PNGs during image optimization.
  images: {
    unoptimized: true,
  },
  // Allow Firebase phone OTP testing via http://127.0.0.1:3000 (dev only).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
