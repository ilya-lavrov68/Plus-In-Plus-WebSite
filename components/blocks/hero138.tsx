import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MediaPlaceholder } from "@/components/site/media-placeholder";
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
  className,
}: Hero138Props) => {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-background pt-16 pb-24 md:pt-24 md:pb-32",
        className
      )}
    >
      <div className="container relative z-10">
        <h1 className="max-w-5xl text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          {headingMuted ? (
            <>
              <span className="text-muted-foreground">{headingMuted}</span>{" "}
              <span className="block text-foreground">{headingPrimary}</span>
            </>
          ) : (
            <span className="text-foreground">{headingPrimary}</span>
          )}
        </h1>

        <div className="mt-10 flex flex-col justify-between gap-8 lg:mt-14 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {primaryCta && (
                <Button size="lg" asChild>
                  <Link href={primaryCta.href}>{primaryCta.label}</Link>
                </Button>
              )}
              {secondaryCta && (
                <Button variant="ghost" size="lg" asChild>
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

          <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
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
        <div className="relative mt-16 md:mt-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 right-0 left-0 mx-auto grid h-80 max-w-6xl grid-cols-4 gap-8 px-8 opacity-25 blur-3xl"
          >
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: "hsl(var(--hero-pillar-1))" }}
            />
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: "hsl(var(--hero-pillar-2))" }}
            />
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: "hsl(var(--hero-pillar-3))" }}
            />
            <div
              className="h-full rounded-full"
              style={{ backgroundColor: "hsl(var(--hero-pillar-4))" }}
            />
          </div>

          <div className="container relative z-10">
            <div className="glass-surface relative overflow-hidden rounded-[1.75rem] bg-white/[0.055] p-1.5 sm:p-2.5">
              {image?.src ? (
                <img
                  src={image.src}
                  alt={image.alt}
                  className="aspect-[16/9] w-full rounded-[1.35rem] object-cover object-center"
                />
              ) : (
                <MediaPlaceholder
                  className="aspect-[16/9] rounded-[1.35rem]"
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
