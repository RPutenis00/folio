import type { NextConfig } from "next";

/**
 * IMPORTANT: this project lives inside ~/Documents which on this Mac is
 * iCloud-Drive-synced. iCloud's File Provider intercepts the atomic rename()
 * calls Turbopack uses for build artifacts, causing ENOENT races and 500s.
 *
 * Workaround: name the build directory with a `.nosync` suffix — macOS's
 * iCloud File Provider treats this as an opt-out and leaves it on local disk.
 */
const distDir = ".next.nosync";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir,
  images: {
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
