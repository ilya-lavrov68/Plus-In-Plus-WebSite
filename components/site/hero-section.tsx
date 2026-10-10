import Link from "next/link";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          className="max-w-4xl font-geist text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-navy sm:text-6xl lg:text-[5.25rem]"
        >
          A next-generation design studio
        </h1>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:mt-11 sm:gap-4">
          <Link
            href="/shop"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "min-w-32")}
          >
            Order
          </Link>
          <Link
            href="/contact"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-36")}
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
