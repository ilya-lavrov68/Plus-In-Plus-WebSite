import Link from "next/link";

import { DecryptText } from "@/components/site/motion/decrypt-text";
import { Button } from "@/components/ui/button";

export interface Cta13Props {
  heading?: string;
  description?: string;
  primaryButton?: {
    text: string;
    url: string;
  };
  secondaryButton?: {
    text: string;
    url: string;
  };
}

const Cta13 = ({
  heading = "Order a design",
  description = "Tell us about your idea and we will package it in a clear, memorable visual system—from storefront signage to large-format outdoor media.",
  primaryButton = {
    text: "Order",
    url: "/services",
  },
  secondaryButton = {
    text: "Contact us",
    url: "/contact",
  },
}: Cta13Props) => {
  return (
    <section className="motion-section relative overflow-hidden py-24 md:py-32">
      {/*
        Финальный бриф — типографическая полоса во всю ширину, без карточки:
        крупный заголовок и одно действие важнее, чем ещё одна «коробка».
        Свет за заголовком мягкий, с маской по краям.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 120% at 22% 40%, rgba(255,95,1,0.10), rgba(255,95,1,0) 62%)",
          maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)",
        }}
      />

      <div className="container relative z-10">
        <div data-reveal="" className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              <DecryptText text={heading} seed={43} />
            </h2>
            <p className="mt-6 max-w-xl text-base leading-[1.75] text-muted-foreground md:text-lg">
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 lg:justify-end">
            <Button size="lg" asChild>
              <Link href={primaryButton.url}>{primaryButton.text}</Link>
            </Button>
            {secondaryButton && (
              <Button size="lg" variant="neutral" asChild>
                <Link href={secondaryButton.url}>{secondaryButton.text}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta13 };
