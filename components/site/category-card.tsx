import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export interface CategoryCardProps {
  title: string;
  gradientImageSrc: string;
  href: string;
}

/** Brand artwork with a two-line label and clear color/arrow hover feedback. */
export function CategoryCard({ title, gradientImageSrc, href }: CategoryCardProps) {
  const [firstWord, ...remainingWords] = title.trim().split(/\s+/);
  const label = remainingWords.length ? (
    <>
      {firstWord}
      <br />
      {remainingWords.join(" ")}
    </>
  ) : title;

  if (!gradientImageSrc || !href) {
    return (
      <div className="relative flex aspect-[7/10] items-start overflow-hidden rounded-2xl bg-[#0A4366] p-5 text-white sm:rounded-[2rem] sm:p-6 lg:rounded-[40px]">
        <span className="font-geist text-2xl font-medium leading-tight tracking-[-0.035em] sm:text-3xl">
          {label}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-label={`${title} services`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[7/10] overflow-hidden rounded-2xl bg-[#0A4366] text-white sm:rounded-[2rem] lg:rounded-[40px]">
        <SafeImage
          src={gradientImageSrc}
          alt=""
          fill
          sizes="(min-width: 1536px) 350px, (min-width: 1280px) 22vw, (min-width: 640px) 45vw, 46vw"
          className="object-cover transition-[filter,opacity] duration-200 ease-out group-hover:grayscale group-hover:opacity-70 group-focus-visible:grayscale group-focus-visible:opacity-70"
        />
        <span className="absolute left-4 top-4 z-10 font-geist text-xl font-medium leading-tight tracking-[-0.035em] sm:left-6 sm:top-6 sm:text-2xl lg:text-[1.9rem]">
          {label}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={1.7}
          className="absolute bottom-4 right-4 z-10 h-7 w-7 transition-[rotate] duration-200 ease-out group-hover:rotate-90 group-focus-visible:rotate-90 sm:bottom-5 sm:right-5 sm:h-8 sm:w-8"
        />
      </div>
    </Link>
  );
}
