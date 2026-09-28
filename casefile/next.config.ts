import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Room for uploaded source files (PDFs, court docs).
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
