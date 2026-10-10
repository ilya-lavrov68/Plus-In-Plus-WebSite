import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export interface CategoryCardProps {
  title: string;
  gradientImageSrc: string;
  href: string;
}

/**
 * Image-led service tile. The card is exactly the image — no rounding, no
 * shadow, no chrome. On hover the image desaturates/dims and the bare arrow
 * rotates toward the bottom-right corner (200ms ease-out, like ServiceCard).
 */
export function CategoryCard({ title, gradientImageSrc, href }: CategoryCardProps) {
  // Keep a resilient fallback for callers with incomplete legacy data.
  if (!gradientImageSrc || !href) {
    return (
      <div className="relative flex aspect-[7/10] items-start overflow-hidden bg-[#173653] p-5 text-white sm:p-6">
        <span className="max-w-[11ch] font-geist text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">
          {title}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${title} services`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[7/10] overflow-hidden bg-[#173653] text-white">
        <SafeImage
          src={gradientImageSrc}
          alt=""
          fill
          sizes="(min-width: 1280px) 280px, (min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw"
          className="object-cover transition-[filter,opacity] duration-200 ease-out group-hover:grayscale group-hover:opacity-70 group-focus-visible:grayscale group-focus-visible:opacity-70"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[#071b30]/20" />
        <span className="absolute left-5 top-5 z-10 max-w-[11ch] font-geist text-2xl font-semibold leading-tight tracking-[-0.035em] sm:left-6 sm:top-6 sm:text-3xl">
          {title}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={1.7}
          className="absolute bottom-5 right-5 z-10 h-6 w-6 transition-transform duration-200 ease-out group-hover:rotate-90 group-focus-visible:rotate-90 sm:bottom-6 sm:right-6"
        />
      </div>
    </Link>
  );
}
