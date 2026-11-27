import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DecryptText } from "@/components/site/motion/decrypt-text";
import { SectionGlow } from "@/components/site/section-glow";
import { Button } from "@/components/ui/button";
import { HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
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
        "motion-section relative overflow-hidden bg-background pt-24 pb-20 md:pt-32 md:pb-28",
        className,
      )}
    >
      {/* Фон секции: крупная печатная ячейка, оранжевый — на дальнем крае. */}
      <SectionGlow
        variant="dither"
        cell={HAZEGLOW_CELL.hero}
        intensity={0.95}
      />
      {/* Скрим держит контраст текста, не убивая растр на правой стороне. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#110f10_0%,rgba(17,15,16,0.9)_38%,rgba(17,15,16,0.35)_62%,rgba(17,15,16,0)_84%)]"
      />
      <div className="container relative z-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <div>
            <h1 className="max-w-3xl text-4xl font-medium tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl">
              {headingMuted ? (
                <>
                  <DecryptText
                    text={headingMuted}
                    trigger="mount"
                    seed={3}
                    className="text-muted-foreground"
                  />{" "}
                  <DecryptText
                    text={headingPrimary}
                    trigger="mount"
                    seed={5}
                    className="block text-foreground"
                  />
                </>
              ) : (
                <DecryptText
                  text={headingPrimary}
                  trigger="mount"
                  seed={5}
                  className="text-foreground"
                />
              )}
            </h1>

            <p
              data-reveal=""
              data-reveal-delay={80}
              className="mt-8 max-w-xl text-base leading-[1.75] text-muted-foreground md:text-lg"
            >
              {descriptionLead}
              {descriptionStrong && (
                <strong className="font-semibold text-foreground">
                  {descriptionStrong}
                </strong>
              )}
            </p>

            <div
              data-reveal=""
              data-reveal-delay={140}
              className="mt-10 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                {primaryCta && (
                  <Button size="lg" asChild>
                    <Link href={primaryCta.href}>{primaryCta.label}</Link>
                  </Button>
                )}
                {secondaryCta && (
                  <Button variant="neutral" size="lg" asChild>
                    <Link href={secondaryCta.href} className="group">
                      {secondaryCta.label}
                      <ArrowRight className="ml-1 size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                    </Link>
                  </Button>
                )}
              </div>
              {footnote && (
                <p className="text-xs text-muted-foreground">{footnote}</p>
              )}
            </div>
          </div>

          {/* Правая половина отдана фону секции: текста здесь нет. */}
          <div aria-hidden="true" className="hidden min-h-[15rem] lg:block" />
        </div>
      </div>
    </section>
  );
};

export { Hero138 };
