import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/scrapper",
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
