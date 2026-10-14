import Link from "next/link";
import { useTranslations } from "next-intl";

import { GradientBackdrop } from "@/components/site/gradient-backdrop";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const t = useTranslations("hero");
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
          {t("title")}
        </h1>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
          {/* Brand buttons (Spectrum LoadingButton underneath) instead of two
              hand-rolled class strings. `asChild` keeps them real <Link>s, so
              navigation and middle-click behave natively. */}
          <Button
            asChild
            variant="cta"
            size="lg"
            className="min-w-[168px] text-base font-medium"
          >
            <Link href="/shop">{t("order")}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="min-w-[168px] text-base font-medium hover:bg-navy/5"
          >
            <Link href="/contact">{t("contactUs")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
