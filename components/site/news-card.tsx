import Link from "next/link";
import { ArrowUpRight, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { SafeImage } from "@/components/site/safe-image";

export type NewsSource = "vk" | "telegram" | "youtube" | "manual";

export interface NewsCardProps {
  title: string;
  excerpt: string;
  imageSrc?: string;
  source?: NewsSource;
  sourceUrl?: string;
  postUrl?: string;
  href?: string;
  imagesCount?: number;
  publishedAt?: string | null;
  isActive?: boolean;
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M13.162 18.994c.609 0 .858-.406.851-.915-.016-1.12.508-1.597 1.047-1.597.433 0 .742.274 1.258.766.772.735 1.34 1.746 2.457 1.746h3.047c.563 0 .895-.274.742-.82-.187-.665-1.508-2.316-2.078-2.915-.477-.502-.414-.688.117-1.407.992-1.344 2.219-3.047 2.445-4.148.117-.57-.156-.844-.719-.844h-2.984c-.461 0-.711.234-.859.688-.563 1.719-1.531 3.484-2.219 4.297-.477.562-.648.437-.648-.063V8.875c0-.5-.141-.875-.688-.875H10.5c-.328 0-.531.18-.531.391 0 .422.5.547.547 1.781v2.703c0 .594-.273.703-.531.25-.797-1.39-1.586-2.938-2.234-4.516-.188-.453-.438-.609-.922-.609H3.844c-.609 0-.734.281-.734.594 0 .547.703 3.328 3.266 6.969 1.719 2.469 4.125 3.664 6.786 3.664v-.052z" />
    </svg>
  );
}

function SourceIcon({ source }: { source: "vk" | "telegram" | "youtube" }) {
  if (source === "telegram") return <Send aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.9} />;
  if (source === "youtube") return <YouTubeIcon />;
  return <VkIcon />;
}

function isSafeExternalUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatCardDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function NewsCard({
  title,
  excerpt,
  imageSrc,
  source,
  sourceUrl,
  postUrl,
  href,
  imagesCount,
  publishedAt,
  isActive = true,
}: NewsCardProps) {
  const t = useTranslations("news");
  const locale = useLocale();
  const targetPostUrl = postUrl ?? href;
  const validSource = source === "vk" || source === "telegram" || source === "youtube";
  const showSource = Boolean(validSource && isSafeExternalUrl(sourceUrl));
  const showArrow = Boolean(targetPostUrl);

  return (
    <article
      aria-hidden={!isActive}
      className="group flex min-w-0 flex-col overflow-hidden rounded-[2rem] bg-white text-[#052B42] lg:rounded-[40px]"
    >
      <div className="relative aspect-[350/273] w-full shrink-0 overflow-hidden bg-[#F0F0F0]">
        <span className="absolute inset-0 z-0 flex items-center justify-center bg-[#E93838] font-body text-sm font-semibold text-white">
          {t("photoPlaceholder")}
        </span>
        {imageSrc ? (
          <SafeImage
            src={imageSrc}
            alt=""
            fill
            sizes="(min-width: 1536px) 350px, (min-width: 1280px) 25vw, (min-width: 768px) 30vw, 92vw"
            className="z-10 object-contain transition-opacity duration-200 ease-out group-hover:opacity-90"
          />
        ) : null}

        {typeof imagesCount === "number" && imagesCount > 0 ? (
          <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 font-body text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
            📷 {imagesCount}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-[150px] flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pt-4">
        <h3 className="font-geist text-sm font-semibold leading-snug tracking-[-0.015em] sm:text-base">
          {targetPostUrl ? (
            <Link
              href={targetPostUrl}
              tabIndex={isActive ? 0 : -1}
              className="rounded-sm outline-none transition-colors duration-200 ease-out hover:text-[#0A4366] focus-visible:ring-2 focus-visible:ring-[#052B42]"
            >
              {title}
            </Link>
          ) : (
            <span>{title}</span>
          )}
        </h3>
        {publishedAt ? (
          <time dateTime={publishedAt} className="mt-1 font-body text-xs text-[#052B42]/60">
            {formatCardDate(publishedAt, locale)}
          </time>
        ) : null}
        {excerpt ? (
          <p className="mt-2 line-clamp-5 font-body text-xs leading-[1.35] sm:text-sm sm:leading-[1.4]">
            {excerpt}
          </p>
        ) : null}

        {showSource || showArrow ? (
          <div className="mt-auto flex items-center gap-2 pt-4">
            {showSource && source && source !== "manual" && sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isActive ? 0 : -1}
                aria-label={t("sourceOn", { source: source === "vk" ? "VK" : source === "telegram" ? "Telegram" : "YouTube" })}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#052B42]/20 bg-white text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
              >
                <SourceIcon source={source} />
              </a>
            ) : null}

            {showArrow && targetPostUrl ? (
              <Link
                href={targetPostUrl}
                aria-label={t("readArticle", { title })}
                tabIndex={isActive ? 0 : -1}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#052B42]/20 bg-white text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
              >
                <ArrowUpRight aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
