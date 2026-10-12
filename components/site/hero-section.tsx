import Link from "next/link";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

export function HeroSection({ locale = "en" }: { locale?: "en" | "ru" }) {
  const copy = locale === "ru" ? ru.hero : en.hero;
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate -mt-16 flex h-[clamp(460px,40.52vw,778px)] items-center justify-center overflow-hidden bg-[#CFE0FF]"
    >
      <GradientBackdrop src="/assets/gradients/hero-gradient.svg" priority />
      <div className="relative z-10 mx-auto flex w-full max-w-[1640px] flex-col items-center px-5 text-center sm:px-8">
        <h1
          id="hero-heading"
          className="max-w-full font-geist text-[clamp(3rem,6.2vw,6rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#052B42] lg:whitespace-nowrap"
        >
          {copy.title}
        </h1>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
          <Link
            href="/shop"
            className="inline-flex min-w-[168px] items-center justify-center rounded-xl bg-[#00C56D] px-8 py-3 font-body text-base font-medium text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#00B361] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
          >
            {copy.order}
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-w-[168px] items-center justify-center rounded-xl border border-[#052B42] bg-transparent px-8 py-3 font-body text-base font-medium text-[#052B42] transition-colors duration-200 ease-out hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
          >
            {copy.contactUs}
          </Link>
        </div>
      </div>
    </section>
  );
}
