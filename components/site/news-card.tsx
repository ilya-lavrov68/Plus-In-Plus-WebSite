import Link from "next/link";
import { ArrowUpRight, Play, Send } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export type NewsSource = "vk" | "telegram" | "youtube";

export interface NewsCardProps {
  title: string;
  excerpt: string;
  imageSrc?: string;
  source: NewsSource;
  href?: string;
}

function SourceIcon({ source }: { source: NewsSource }) {
  if (source === "telegram") {
    return <Send aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />;
  }

  if (source === "youtube") {
    return (
      <span className="inline-flex h-[18px] w-6 items-center justify-center rounded-[5px] bg-[#e62117]">
        <Play aria-hidden="true" className="h-3 w-3 fill-white text-white" />
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="text-[0.7rem] font-extrabold lowercase tracking-[-0.08em]">
      vk
    </span>
  );
}

export function NewsCard({ title, excerpt, imageSrc, source, href = "/blog" }: NewsCardProps) {
  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl bg-white p-3 shadow-[0_12px_30px_rgba(10,37,64,0.08)] sm:p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#c63d4a]">
        {imageSrc ? (
          <SafeImage
            src={imageSrc}
            alt=""
            fill
            sizes="(min-width: 1280px) 380px, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
            className="object-cover"
          />
        ) : null}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#a82135]/20 mix-blend-multiply" />
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-4 sm:px-2 sm:pt-5">
        <h3 className="font-geist text-lg font-semibold leading-snug tracking-[-0.025em] text-[#052B42] sm:text-xl">
          <Link
            href={href}
            className="rounded-sm outline-none transition-colors duration-200 ease-out hover:text-[#052B42] focus-visible:ring-2 focus-visible:ring-[#0a2540]"
          >
            {title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 font-body text-sm leading-6 text-[#052B42]">
          {excerpt}
        </p>

        <div className="mt-auto flex items-center justify-between gap-4 pt-5">
          <span
            role="img"
            aria-label={source === "vk" ? "VK" : source === "telegram" ? "Telegram" : "YouTube"}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#0a2540]/[0.06] px-2.5 text-[#052B42]"
          >
            <SourceIcon source={source} />
          </span>
          <Link
            href={href}
            aria-label={`Read ${title}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#0a2540]/15 text-[#052B42] transition-colors duration-200 ease-out hover:border-[#0a2540] hover:bg-[#0a2540] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540]"
          >
            <ArrowUpRight aria-hidden="true" className="h-5 w-5" strokeWidth={1.7} />
          </Link>
        </div>
      </div>
    </article>
  );
}
