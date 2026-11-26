import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CatalogServiceItem } from "@/lib/studio-catalog";
import { cn } from "@/lib/utils";

export interface Services11CatalogProps {
  id?: string;
  eyebrow?: string;
  heading: string;
  subtitle?: string;
  description?: string;
  services: CatalogServiceItem[];
  ctaLabel?: string;
  ctaHref?: string;
  moreLabel?: string;
  largeCategoryLabel?: string;
  smallCategoryLabel?: string;
  className?: string;
}

const Services11Catalog = ({
  id,
  eyebrow,
  heading,
  subtitle,
  description,
  services,
  ctaLabel = "Order a design",
  ctaHref = "/contact",
  moreLabel = "More",
  largeCategoryLabel = "Large designs",
  smallCategoryLabel = "Small designs",
  className,
}: Services11CatalogProps) => {
  return (
    <section
      id={id}
      className={cn("section-y", className)}
    >
      <div className="container">
        <div className="grid grid-cols-1 gap-8 pb-14 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            {eyebrow && (
              <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {eyebrow}
              </p>
            )}
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {heading}
            </h2>
            {subtitle && (
              <p className="mt-4 text-xl font-medium leading-snug text-foreground/90">
                {subtitle}
              </p>
            )}
          </div>

          <div className="lg:col-span-5">
            {description && (
              <p className="measure text-base leading-[1.75] text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <div className="lg:col-span-2 lg:flex lg:justify-end">
            {ctaLabel && (
              <Button variant="outline"asChild>
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.slug}
              className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-xl bg-card p-6 transition-colors duration-200 ease-out"
            >
              <Link
                href={`/services/${service.slug}`}
                aria-label={service.title}
                className="absolute inset-0 z-10"
              />

              <img
                src={service.coverImage}
                alt={service.title}
                className="pointer-events-none absolute inset-0 size-full object-contain"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/25 transition-opacity duration-200 group-hover:opacity-80" />

              <div className="pointer-events-none relative z-20 flex items-start justify-between gap-2">
                <span className="rounded-md bg-black/55 px-2.5 py-1 text-xs font-medium text-white/85 backdrop-blur-2xl">
                  {service.category === "large"
                    ? largeCategoryLabel
                    : smallCategoryLabel}
                </span>
                <span className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-2xl transition-colors duration-200">
                  <ArrowUpRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>

              <div className="relative z-20 flex flex-col items-start gap-4">
                <h3 className="text-2xl leading-tight font-semibold text-white">
                  {service.title}
                </h3>
                <Button
                  size="sm"
                  variant="secondary"
                  className="pointer-events-auto"
                  asChild
                >
                  <Link href={`/services/${service.slug}`}>{moreLabel}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Services11 = Services11Catalog;

export { Services11, Services11Catalog };
