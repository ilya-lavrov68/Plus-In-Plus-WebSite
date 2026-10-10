import Link from "next/link";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate -mt-16 flex min-h-[600px] items-center overflow-hidden bg-[#e8f0fe] sm:min-h-[660px]"
    >
      <GradientBackdrop src="/assets/gradients/hero-gradient.png" priority />
      <div aria-hidden="true" className="absolute inset-0 bg-white/10" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-5 py-28 text-center sm:px-8 sm:py-36">
        <h1
          id="hero-heading"
          className="max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-[#0a2540] sm:text-6xl lg:text-[5.25rem]"
        >
          A next-generation design studio
        </h1>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:mt-11 sm:gap-4">
          <Link
            href="/shop"
            className="inline-flex min-h-12 min-w-32 items-center justify-center rounded-full bg-[#0a2540] px-7 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#153c5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] focus-visible:ring-offset-2"
          >
            Order
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-12 min-w-36 items-center justify-center rounded-full border border-[#0a2540]/50 bg-white/10 px-7 py-3 text-sm font-semibold text-[#0a2540] transition-colors duration-200 ease-out hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2540] focus-visible:ring-offset-2"
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
