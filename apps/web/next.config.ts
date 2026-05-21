import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("bcrypt");
    }
    return config;
  },
  images: {
    qualities: [100],
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
