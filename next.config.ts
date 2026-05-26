import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
    ],
  },
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
