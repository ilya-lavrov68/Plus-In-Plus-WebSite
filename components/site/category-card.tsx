import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export interface CategoryCardProps {
  title: string;
  gradientImageSrc: string;
  href: string;
}

/** Image-led service tile. Its background is always a PNG asset, never a CSS gradient. */
export function CategoryCard({ title, gradientImageSrc, href }: CategoryCardProps) {
  // Keep a resilient non-icon fallback for callers with incomplete legacy data.
  if (!gradientImageSrc || !href) {
    return (
      <div className="relative flex aspect-[3/4] items-start overflow-hidden rounded-2xl bg-[#173653] p-5 text-white sm:p-6">
        <span className="max-w-[11ch] text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">
          {title}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${title} services`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#173653] text-white shadow-[0_14px_28px_rgba(10,37,64,0.1)]">
        <SafeImage
          src={gradientImageSrc}
          alt=""
          fill
          sizes="(min-width: 1280px) 280px, (min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw"
          className="object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[#071b30]/20" />
        <span className="absolute left-5 top-5 z-10 max-w-[11ch] text-2xl font-semibold leading-tight tracking-[-0.035em] sm:left-6 sm:top-6 sm:text-3xl">
          {title}
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-5 right-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/10 backdrop-blur-sm sm:bottom-6 sm:right-6"
        >
          <ArrowUpRight className="h-5 w-5 transition-transform duration-200 ease-out group-hover:rotate-45" strokeWidth={1.7} />
        </span>
      </div>
    </Link>
  );
}
