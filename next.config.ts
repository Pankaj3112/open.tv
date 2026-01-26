import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Initialize Cloudflare bindings for local development (D1, KV, etc.)
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Enable edge runtime for Cloudflare Pages
  experimental: {
    // Required for @cloudflare/next-on-pages
  },
};

export default nextConfig;
