import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["*.e2b.app"],
  async headers() {
    const headers = [...securityHeaders];
    const publicUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

    // Production remains protected from framing. Development can be embedded in the live preview.
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "X-Frame-Options", value: "DENY" });
      if (publicUrl.startsWith("https://")) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }
    return [{ source: "/:path*", headers }];
  },
  experimental: {
    serverActions: {
      // Covers: 8 MB, avatars: 2 MB; the extra space is for multipart overhead.
      bodySizeLimit: "9mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n-request.ts");

export default withNextIntl(nextConfig);
