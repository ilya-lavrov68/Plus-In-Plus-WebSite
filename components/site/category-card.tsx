import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export interface CategoryCardProps {
  title: string;
  gradientImageSrc: string;
  href: string;
}

/** Image-led category tile: two-line Geist label and a 45-degree arrow hover.
 * Like service cards, the artwork desaturates on hover or keyboard focus. */
export function CategoryCard({ title, gradientImageSrc, href }: CategoryCardProps) {
  const [firstWord, ...remainingWords] = title.trim().split(/\s+/);
  const label = remainingWords.length ? (
    <>{firstWord}<br />{remainingWords.join(" ")}</>
  ) : title;

  // Keep a resilient fallback for callers with incomplete legacy data.
  if (!gradientImageSrc || !href) {
    return (
      <div className="relative flex aspect-[3/4] items-start overflow-hidden bg-[#173653] p-5 text-white sm:p-6">
        <span className="font-geist text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">
          {label}
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
      <div className="relative aspect-[3/4] overflow-hidden bg-[#173653] text-white">
        <SafeImage
          src={gradientImageSrc}
          alt=""
          fill
          sizes="(min-width: 1280px) 280px, (min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw"
          className="object-cover transition-[filter,opacity] duration-200 ease-out group-hover:grayscale group-hover:opacity-70 group-focus-visible:grayscale group-focus-visible:opacity-70"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[#071b30]/20" />
        <span className="absolute left-5 top-5 z-10 font-geist text-2xl font-semibold leading-tight tracking-[-0.035em] sm:left-6 sm:top-6 sm:text-3xl">
          {label}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={1.7}
          className="absolute bottom-5 right-5 z-10 h-6 w-6 transition-transform duration-200 ease-out group-hover:rotate-45 group-focus-visible:rotate-45 sm:bottom-6 sm:right-6"
        />
      </div>
    </Link>
  );
}
