import { Search } from "lucide-react";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

export interface InternalPageHeaderProps {
  /** Large page title rendered on the gradient hero, e.g. "BLOG" or "SHOP". */
  title: string;
}

/**
 * Shared top block for internal pages (Blog, Shop, Shop Service, Contact):
 * 1. Gradient hero (PNG from /assets/gradients, same as the landing) with a big title.
 * 2. White logo row: Plus In Plus | TS Connect on the left, search on the right.
 *
 * Use <InternalPageContent> below it for the white content card.
 */
export function InternalPageHeader({ title }: InternalPageHeaderProps) {
  return (
    <>
      <section
        aria-label={`${title} page hero`}
        className="relative isolate -mt-16 flex h-[40vh] min-h-[260px] items-end overflow-hidden bg-[#e8f0fe]"
      >
        <GradientBackdrop src="/assets/gradients/hero-gradient.png" priority />
        <div className="relative z-10 w-full px-6 pb-2 sm:px-12">
          <h1 className="font-geist text-[clamp(4rem,16vw,13rem)] font-semibold leading-[0.8] tracking-[-0.05em] text-[#052B42]">
            {title}
          </h1>
        </div>
      </section>

      <div className="bg-white px-6 py-4">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-4 md:grid-cols-2 md:gap-8">
          <div className="flex items-center">
            <Logo variant="partners" className="h-10 w-auto sm:h-12" />
          </div>
          <div className="relative w-full md:justify-self-end">
            <input
              type="search"
              aria-label="Search"
              placeholder="Search"
              className="h-12 w-full rounded-lg border border-[#052B42]/20 bg-white py-2 pl-4 pr-12 font-body text-base text-[#052B42] placeholder:text-[#052B42]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
            />
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#052B42]"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export interface InternalPageContentProps {
  children: React.ReactNode;
  className?: string;
  /** Optional id of the heading that labels the card region. */
  labelledBy?: string;
}

/**
 * Light-blue content area with a rounded white card inside (mx-6 my-8, p-8 / sm:p-12).
 */
export function InternalPageContent({ children, className, labelledBy }: InternalPageContentProps) {
  return (
    <section aria-labelledby={labelledBy} className="bg-[#D6E4FF] text-[#052B42]">
      <div
        className={cn(
          "mx-6 my-8 rounded-[2rem] bg-white p-8 text-[#052B42] sm:p-12",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
