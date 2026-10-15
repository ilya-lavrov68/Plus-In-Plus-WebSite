import Link from "next/link";

import { useTranslations } from "next-intl";

import { SafeImage } from "@/components/site/safe-image";
// Imported from the recipe module, not from button.tsx: these are Server
// Components, and button.tsx is a Client Component.
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export interface ShopServiceCardProps {
  title: string;
  href: string;
  imageSrc?: string | null;
}

/** Image-led catalog tile from the shop mockup: photo, service name and More CTA. */
export function ShopServiceCard({ title, href, imageSrc }: ShopServiceCardProps) {
  const t = useTranslations("shop");
  return (
    <Link
      href={href}
      aria-label={t("moreDetails", { title })}
      className="group flex h-full w-full flex-col overflow-hidden rounded-[2.5rem] bg-[#CFE0FF] text-[#052B42] transition-shadow duration-200 ease-out hover:shadow-[0_12px_28px_rgba(5,43,66,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2 xl:rounded-[70px]"
    >
      <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden bg-[#F0F0F0]">
        <SafeImage
          src={imageSrc}
          alt=""
          fill
          sizes="(min-width: 1920px) 450px, (min-width: 1280px) 24vw, (min-width: 640px) 42vw, 80vw"
          className="object-contain transition-opacity duration-200 ease-out group-hover:opacity-95 group-focus-visible:opacity-95"
        />
      </div>
      <h3 className="mt-3 flex min-h-[4.25rem] items-start justify-center px-4 text-center font-body text-base font-medium leading-snug sm:text-lg lg:text-2xl">
        {title}
      </h3>
      <span
        className={cn(
          buttonVariants({ variant: "default" }),
          "mx-auto mb-6 mt-auto h-12 w-[calc(100%-40px)] px-5 group-hover:bg-[#0A4366] sm:h-14 xl:mb-[31px] xl:h-[70px] xl:w-[calc(100%-70px)] xl:text-base",
        )}
      >
        {t("more")}
      </span>
    </Link>
  );
}
