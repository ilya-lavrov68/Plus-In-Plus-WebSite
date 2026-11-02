import Link from "next/link";

import { SignalBlocks } from "@/components/site/brand-geometry";
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

/**
 * Финальный CTA — острый сигнальный блок: прямоугольная поверхность,
 * hairline-граница, ряд квадратных сигналов и две кнопки разной формы
 * (острая основная + pill-вторичная).
 */
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
    <section className="motion-section py-20 md:py-28">
      <div className="container">
        <div
          data-reveal=""
          className="glass-surface relative overflow-hidden rounded-none border border-border bg-card/80 p-8 md:p-14"
        >
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 h-1 w-full bg-primary/70"
          />
          <SignalBlocks className="absolute top-6 right-6 opacity-80" count={7} />

          <div className="relative z-10 flex flex-col justify-between gap-10 pt-4 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="pip-eyebrow">Plus In Plus</p>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
                <DecryptText text={heading} seed={43} />
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                {description}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href={primaryButton.url}>{primaryButton.text}</Link>
              </Button>
              {secondaryButton && (
                <Button size="lg" variant="outline" asChild>
                  <Link href={secondaryButton.url}>{secondaryButton.text}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta13 };
