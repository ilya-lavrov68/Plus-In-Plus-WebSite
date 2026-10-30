import type { Metadata } from "next";

export const SITE_NAME = "Plus In Plus";
/** English fallback description; the translated copy lives in `messages/*.json`. */
export const DEFAULT_SITE_DESCRIPTION =
  "Plus In Plus — AI technology and graphic, digital, and brand design.";

function resolveSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;

  try {
    return new URL(configuredUrl ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: Date | null;
  /** Locale of the page, used for the Open Graph locale of the shared URL. */
  locale?: "en" | "ru";
}

export function createPageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
  locale = "en",
}: PageMetadataOptions): Metadata {
  const imageUrl = image?.trim() ? absoluteUrl(image.trim()) : undefined;
  const commonOpenGraph = {
    title,
    description,
    siteName: SITE_NAME,
    locale: locale === "ru" ? "ru_RU" : "en_US",
    url: absoluteUrl(path),
    ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
  };

  const openGraph =
    type === "article"
      ? {
          ...commonOpenGraph,
          type: "article" as const,
          ...(publishedTime ? { publishedTime: publishedTime.toISOString() } : {}),
        }
      : { ...commonOpenGraph, type: "website" as const };

  return { title, description, openGraph };
}
