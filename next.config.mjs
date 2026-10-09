/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cover images come from the database as arbitrary URLs, so skip the
  // built-in image optimizer (no remote host allowlist to maintain).
  images: {
    unoptimized: true,
  },
  // Cover upload actions accept files up to 8 MB (lib/uploads.ts).
  // FormData adds overhead, so allow a little more at the transport layer.
  experimental: {
    serverActions: {
      bodySizeLimit: "9mb",
    },
  },
};

export default nextConfig;
