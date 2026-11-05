import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-XSS-Protection", value: "0" },
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
      if (publicUrl.startsWith("https://")) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [
      { source: "/:path*", headers },
      // Файлы из public/ Next отдаёт с `max-age=0`: каждый повторный заход
      // заново проверял все логотипы и обложки. Ассеты меняются только с
      // деплоем, поэтому кешируем их надолго и обновляем в фоне.
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Covers: 8 MB, avatars: 2 MB; the extra space is for multipart overhead.
      bodySizeLimit: "9mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n-request.ts");
let config = withNextIntl(nextConfig);

// Обычный production runtime не разрешает dev-only analyzer dependency.
if (process.env.ANALYZE === "true") {
  const { default: withBundleAnalyzer } = await import("@next/bundle-analyzer");
  config = withBundleAnalyzer({ enabled: true, openAnalyzer: false })(config);
}

export default config;
