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
    <section className="motion-section py-24 md:py-32">
      <div className="container">
        <div
          data-reveal=""
          className="glass-surface rounded-[1.75rem] border-0 bg-white/[0.055] p-8 md:p-16"
        >
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
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
                <Button size="lg" variant="secondary" asChild>
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
