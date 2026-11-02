import Link from "next/link";

import { HeroGraphicField } from "@/components/site/hero-graphic-field";
import { DecryptText } from "@/components/site/motion/decrypt-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Hero138Props {
  headingMuted?: string;
  headingPrimary?: string;
  descriptionLead?: string;
  descriptionStrong?: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  footnote?: string;
  className?: string;
}

const Hero138 = ({
  headingMuted = "A next-generation",
  headingPrimary = "design studio",
  descriptionLead = "Have an idea but don't know how to showcase it? ",
  descriptionStrong = "We'll package it in a stylish, clear design—from website mockups to posters and event collateral.",
  primaryCta = {
    label: "Order",
    href: "/services",
  },
  secondaryCta = {
    label: "Contact us",
    href: "/contact",
  },
  footnote = "Plus In Plus Design Studio",
  className,
}: Hero138Props) => {
  return (
    <section
      className={cn(
        "hero-reference motion-section relative isolate overflow-hidden bg-background",
        className,
      )}
      aria-labelledby="hero-heading"
    >
      <HeroGraphicField />

      <div className="container relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-5 pb-72 pt-16 text-center sm:px-8 sm:pb-64 md:pt-20 lg:pb-48">
        <p
          data-reveal
          className="mb-6 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-xs"
        >
          {footnote}
        </p>

        <h1
          id="hero-heading"
          className="max-w-5xl text-balance text-[clamp(2.5rem,5.6vw,5.5rem)] font-medium leading-[1.02] tracking-[-0.02em]"
        >
          {headingMuted ? (
            <>
              <DecryptText
                text={headingMuted}
                trigger="mount"
                seed={11}
                className="text-primary"
              />
              <DecryptText
                text={headingPrimary}
                trigger="mount"
                seed={29}
                className="mt-1 block text-foreground sm:mt-2"
              />
            </>
          ) : (
            <DecryptText
              text={headingPrimary}
              trigger="mount"
              seed={29}
              className="text-foreground"
            />
          )}
        </h1>

        <p
          data-reveal
          className="mt-6 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-7 sm:text-base"
        >
          {descriptionLead}
          {descriptionStrong ? (
            <strong className="font-medium text-foreground/85">
              {descriptionStrong}
            </strong>
          ) : null}
        </p>

        <div
          data-reveal
          className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:mt-9 sm:w-auto sm:flex-row sm:items-center"
        >
          {primaryCta ? (
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full px-7"
            >
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
          ) : null}
          {secondaryCta ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 rounded-full border-foreground/20 px-7"
            >
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export { Hero138 };
