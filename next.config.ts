import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable edge runtime for Cloudflare Pages
  experimental: {
    // Required for @cloudflare/next-on-pages
  },
};

export default nextConfig;
