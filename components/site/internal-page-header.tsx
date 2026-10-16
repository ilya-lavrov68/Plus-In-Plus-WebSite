import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

export interface InternalPageHeaderProps {
  /** Large page title rendered on the shared gradient hero, e.g. "BLOG" or "SHOP". */
  title: string;
}

/** Shared gradient title, brand-lockup and search header for internal pages. */
export function InternalPageHeader({ title }: InternalPageHeaderProps) {
  const t = useTranslations("common");
  return (
    <>
      <section
        aria-label={`${title} — ${t("loadingPage")}`}
        className="relative isolate -mt-16 flex h-[clamp(400px,40.52vw,778px)] items-end overflow-hidden bg-[#CFE0FF]"
      >
        <GradientBackdrop src="/assets/gradients/hero-gradient.jpg" priority />
        <div className="relative z-10 w-full px-6 pb-2 sm:px-12 lg:px-24">
          <h1 className="whitespace-nowrap font-geist text-[clamp(3.5rem,15vw,19rem)] font-semibold leading-[0.8] tracking-[-0.055em] text-[#052B42]">
            {title}
          </h1>
        </div>
      </section>

      <div className="bg-white">
        <div className="mx-auto grid min-h-[190px] max-w-[1704px] grid-cols-1 items-center gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,683px)_minmax(0,784px)] lg:justify-between lg:gap-8 lg:px-0 lg:pr-12 lg:py-0">
          <div className="flex items-center">
            <Logo variant="partners" className="h-auto w-full max-w-[683px]" />
          </div>
          <form role="search" className="relative w-full">
            <label htmlFor="internal-page-search" className="sr-only">
              {t("search")}
            </label>
            <input
              id="internal-page-search"
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              className="h-14 w-full rounded-[1.75rem] border-0 bg-[#EFEFEF] py-2 pl-6 pr-14 font-body text-base text-[#052B42] placeholder:text-[#052B42]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] lg:h-[70px] lg:text-lg"
            />
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-6 top-1/2 h-5 w-5 -translate-y-1/2 text-[#052B42]"
            />
          </form>
        </div>
      </div>
    </>
  );
}

export interface InternalPageContentProps {
  children: React.ReactNode;
  /** Classes applied to the white content card. */
  className?: string;
  /** Classes applied to the light-blue page section. */
  sectionClassName?: string;
  /** Optional id of the heading that labels the page content. */
  labelledBy?: string;
}

/** Light-blue page surface with a large, responsive white content card. */
export function InternalPageContent({
  children,
  className,
  sectionClassName,
  labelledBy,
}: InternalPageContentProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-t-[2.5rem] bg-[#CFE0FF] pb-16 pt-[clamp(3.5rem,9vw,11rem)] text-[#052B42] sm:rounded-t-[3.5rem] lg:rounded-t-[100px]",
        sectionClassName,
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[1920px] rounded-[2.5rem] bg-white px-5 py-8 text-[#052B42] sm:rounded-[3.5rem] sm:px-10 sm:py-12 lg:rounded-[100px] lg:px-[4.2%] lg:py-14",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
