import Link from "next/link";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate -mt-16 flex h-[clamp(460px,40.52vw,778px)] items-center justify-center overflow-hidden bg-[#CFE0FF]"
    >
      <GradientBackdrop src="/assets/gradients/hero-gradient.svg" priority />
      <div className="relative z-10 mx-auto flex w-full max-w-[1640px] flex-col items-center px-5 text-center sm:px-8">
        <h1
          id="hero-heading"
          className="max-w-full font-geist text-[clamp(2rem,3.1vw,3rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-[#052B42] sm:whitespace-nowrap"
        >
          A next-generation design studio
        </h1>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:mt-10 sm:gap-6">
          <Link
            href="/shop"
            className="inline-flex h-14 min-w-[min(274px,42vw)] items-center justify-center rounded-full bg-[#052B42] px-10 font-body text-base font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
          >
            Order
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-14 min-w-[min(274px,42vw)] items-center justify-center rounded-full bg-white/30 px-10 font-body text-base font-semibold text-[#052B42] transition-colors duration-200 ease-out hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
