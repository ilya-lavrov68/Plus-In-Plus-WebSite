/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cover images come from the database as arbitrary URLs, so skip the
  // built-in image optimizer (no remote host allowlist to maintain).
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
