import Link from "next/link";
import { ArrowUpRight, Play, Send } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export type NewsSource = "vk" | "telegram" | "youtube";

export interface NewsCardProps {
  title: string;
  excerpt: string;
  imageSrc?: string;
  source?: NewsSource;
  href?: string;
  isActive?: boolean;
}

function SourceIcon({ source }: { source: NewsSource }) {
  if (source === "telegram") {
    return <Send aria-hidden="true" className="h-5 w-5" strokeWidth={1.9} />;
  }

  if (source === "youtube") {
    return (
      <span aria-hidden="true" className="inline-flex h-[18px] w-6 items-center justify-center rounded-[4px] bg-[#052B42]">
        <Play className="h-3 w-3 fill-white text-white" />
      </span>
    );
  }

  return <span aria-hidden="true" className="text-base font-extrabold lowercase tracking-[-0.08em]">vk</span>;
}

export function NewsCard({
  title,
  excerpt,
  imageSrc,
  source,
  href = "/blog",
  isActive = true,
}: NewsCardProps) {
  return (
    <article
      aria-hidden={!isActive}
      className="group flex min-w-0 flex-col overflow-hidden rounded-[2rem] bg-white text-[#052B42] lg:rounded-[40px]"
    >
      <div className="relative aspect-[350/273] w-full shrink-0 overflow-hidden bg-[#E93838]">
        <span className="absolute inset-0 z-0 flex items-center justify-center font-body text-sm font-semibold text-white">
          photo of article
        </span>
        {imageSrc ? (
          <SafeImage
            src={imageSrc}
            alt=""
            fill
            sizes="(min-width: 1536px) 350px, (min-width: 1280px) 25vw, (min-width: 768px) 30vw, 92vw"
            className="z-10 object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-h-[150px] flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pt-4">
        <h3 className="font-geist text-sm font-semibold leading-snug tracking-[-0.015em] sm:text-base">
          <Link
            href={href}
            tabIndex={isActive ? 0 : -1}
            className="rounded-sm outline-none transition-colors duration-200 ease-out hover:text-[#0A4366] focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            {title}
          </Link>
        </h3>
        {excerpt ? (
          <p className="mt-2 line-clamp-5 font-body text-xs leading-[1.35] sm:text-sm sm:leading-[1.4]">
            {excerpt}
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-4 pt-4">
          {source ? (
            <span
              role="img"
              aria-label={source === "vk" ? "VK" : source === "telegram" ? "Telegram" : "YouTube"}
              className="inline-flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-[#052B42]"
            >
              <SourceIcon source={source} />
            </span>
          ) : null}
          <Link
            href={href}
            aria-label={`Read ${title}`}
            tabIndex={isActive ? 0 : -1}
            className="inline-flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            <ArrowUpRight aria-hidden="true" className="h-8 w-8" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </article>
  );
}
