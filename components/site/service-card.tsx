import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { SafeImage } from "@/components/site/safe-image";
// Imported from the recipe module, not from button.tsx: these are Server
// Components, and button.tsx is a Client Component.
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export interface ServiceCardProps {
  title: string;
  href: string;
  imageSrc?: string | null;
}

/** Reusable brand-styled service tile for small/large service listings. */
export function ServiceCard({ title, href, imageSrc }: ServiceCardProps) {
  const t = useTranslations("shop");
  return (
    <Link
      href={href}
      aria-label={t("moreDetails", { title })}
      className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-[#CFE0FF] text-[#052B42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#F0F0F0]">
        <SafeImage
          src={imageSrc}
          alt=""
          fill
          sizes="(min-width: 1536px) 420px, (min-width: 1280px) 25vw, (min-width: 640px) 45vw, 46vw"
          className="object-contain transition-opacity duration-200 ease-out group-hover:opacity-95 group-focus-visible:opacity-95"
        />
      </div>
      <div className="flex flex-1 items-center justify-between gap-4 px-4 py-4">
        <h3 className="font-geist text-lg font-semibold leading-tight tracking-tight sm:text-xl">{title}</h3>
        <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1" />
      </div>
      {/* Same visuals, but the fill now comes from the brand button system, so
          it stays in step with every other button on the site. `group-hover`
          outranks the variant's own `hover` on specificity, so the whole tile
          still lights up — not just the strip. */}
      <span
        className={cn(
          buttonVariants({ variant: "default" }),
          "mx-4 mb-4 group-hover:bg-[#0A4366]",
        )}
      >
        {t("more")}
      </span>
    </Link>
  );
}
