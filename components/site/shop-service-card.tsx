import Link from "next/link";

import { SafeImage } from "@/components/site/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ShopServiceCardProps {
  title: string;
  href: string;
  imageSrc?: string | null;
}

/**
 * Shop grid card: square image (rounded-2xl), title below, full-width "More" button.
 * The card is a single link (the button is a styled span, not a nested link).
 */
export function ShopServiceCard({ title, href, imageSrc }: ShopServiceCardProps) {
  return (
    <Link
      href={href}
      aria-label={title}
      className="group flex h-full flex-col gap-4 rounded-3xl bg-[#D6E4FF] p-4 text-[#052B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white">
        <SafeImage
          src={imageSrc}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-[filter,opacity] duration-200 ease-out group-hover:opacity-80"
        />
      </div>
      <h3 className="text-center text-lg font-semibold leading-snug sm:text-xl">{title}</h3>
      <span className={cn(buttonVariants({ variant: "default" }), "mt-auto w-full rounded-xl")}>
        More
      </span>
    </Link>
  );
}
