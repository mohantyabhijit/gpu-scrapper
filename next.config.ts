import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/scrapper",
  output: "standalone",
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
