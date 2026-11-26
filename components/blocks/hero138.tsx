import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { MediaPlaceholder } from "@/components/site/media-placeholder";
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
  image?: {
    src: string;
    alt: string;
  };
  showMediaStage?: boolean;
  /** Авторская сцена вместо изображения: рисуется, пока `image` не передан. */
  stageMedia?: ReactNode;
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
  image,
  showMediaStage = true,
  stageMedia,
  className,
}: Hero138Props) => {
  return (
    <section
      className={cn(
        "motion-section relative overflow-hidden bg-background pt-20 pb-24 md:pt-28 md:pb-32",
        className
      )}
    >
      <div className="container relative z-10">
        <h1 className="max-w-5xl text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
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

        <div className="mt-12 flex flex-col justify-between gap-10 lg:mt-16 lg:flex-row lg:items-start">
          <div data-reveal="" data-reveal-delay={80}>
            <div className="flex flex-wrap items-center gap-3">
              {primaryCta && (
                <Button size="lg" asChild>
                  <Link href={primaryCta.href}>{primaryCta.label}</Link>
                </Button>
              )}
              {secondaryCta && (
                <Button variant="ghost"size="lg"asChild>
                  <Link href={secondaryCta.href} className="group">
                    {secondaryCta.label}
                    <ArrowRight className="ml-1 size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                  </Link>
                </Button>
              )}
            </div>
            {footnote && (
              <p className="mt-3 text-xs text-muted-foreground">{footnote}</p>
            )}
          </div>

          <p
            data-reveal=""
            data-reveal-delay={140}
            className="max-w-lg text-base leading-[1.75] text-muted-foreground md:text-lg"
          >
            {descriptionLead}
            {descriptionStrong && (
              <strong className="font-semibold text-foreground">
                {descriptionStrong}
              </strong>
            )}
          </p>
        </div>
      </div>

      {showMediaStage && (
        <div data-reveal="" data-reveal-delay={180} className="relative mt-16 md:mt-28">
          <div className="container relative z-10">
            <div className="hero-media-frame relative overflow-hidden rounded-2xl bg-white/[0.055] p-1.5 [--pip-nest-gap:6px] [--pip-radius-outer:var(--radius-2xl)] sm:p-2.5 sm:[--pip-nest-gap:10px]">
              {image?.src ? (
                <img
                  src={image.src}
                  alt={image.alt}
                  className="nested-radius aspect-[16/9] w-full object-cover object-center"
                />
              ) : stageMedia ? (
                <div className="nested-radius aspect-[16/9] overflow-hidden">
                  {stageMedia}
                </div>
              ) : (
                <MediaPlaceholder
                  className="nested-radius aspect-[16/9]"
                  markClassName="h-16 sm:h-20"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export { Hero138 };
