import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SafeImage } from "@/components/site/safe-image";

export interface ServiceCardProps {
  title: string;
  href: string;
  imageSrc?: string | null;
}

/** Reusable brand-styled service tile for small/large service listings. */
export function ServiceCard({ title, href, imageSrc }: ServiceCardProps) {
  return (
    <Link
      href={href}
      aria-label={`${title} — more details`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-[#CFE0FF] text-[#052B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <SafeImage
          src={imageSrc}
          alt=""
          fill
          sizes="(min-width: 1536px) 420px, (min-width: 1280px) 25vw, (min-width: 640px) 45vw, 46vw"
          className="object-cover transition-transform duration-250 ease-out group-hover:scale-[1.025] group-focus-visible:scale-[1.025]"
        />
      </div>
      <div className="flex flex-1 items-center justify-between gap-4 px-4 py-4">
        <h3 className="font-geist text-lg font-semibold leading-tight tracking-tight sm:text-xl">{title}</h3>
        <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1" />
      </div>
      <span className="mx-4 mb-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#052B42] text-white font-body text-sm font-semibold transition-colors duration-200 ease-out group-hover:bg-[#0A4366]">
        More
      </span>
    </Link>
  );
}
