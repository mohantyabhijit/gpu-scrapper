import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The public judge-facing deployment lives inside the existing portfolio.
  // Keeping this as the canonical base path also makes deep links and assets
  // safe when Cloudflare proxies only /scrapper* to this worker.
  basePath: "/scrapper",
};

export default nextConfig;
