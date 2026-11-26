import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { HazeglowField } from "@/components/site/hazeglow-field";
import { getRequestTranslations } from "@/lib/server-i18n";

interface DirectionCardProps {
  href: string;
  index: string;
  title: string;
  status: string;
  description: string;
  meta: string;
  linkLabel: string;
  media: ReactNode;
  accent?: boolean;
}

function DirectionCard({
  href,
  index,
  title,
  status,
  description,
  meta,
  linkLabel,
  media,
  accent = false,
}: DirectionCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-colors duration-200 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div className="relative h-40 shrink-0 overflow-hidden bg-background sm:h-48">
        {media}
      </div>
      <div className="flex flex-1 flex-col p-7 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-medium tracking-[0.16em] text-muted-foreground uppercase">{index}</span>
          <span
            className={
              accent
                ? "rounded-full bg-signal/12 px-3 py-1 font-medium text-signal"
                : "rounded-full bg-secondary/60 px-3 py-1 font-medium text-muted-foreground"
            }
          >
            {status}
          </span>
        </div>
        <h3 className="mt-8 text-3xl font-medium tracking-tight sm:text-4xl">{title}</h3>
        <p className="mt-5 max-w-xl text-base leading-[1.75] text-muted-foreground">{description}</p>
        <p className="mt-6 text-sm leading-relaxed text-foreground/80">{meta}</p>
        <span className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-foreground">
          {linkLabel}
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </span>
      </div>
    </Link>
  );
}

/**
 * Два направления бренда на главной: действующая дизайн-практика и собственный
 * продукт студии. Обе карточки держит Hazeglow — dither у дизайна и ascii у
 * продукта: графический язык студии теперь один.
 */
export async function BrandDirections() {
  const t = await getRequestTranslations("directions");

  return (
    <section id="directions" className="bg-background section-y">
      <div className="container">
        <div data-reveal="" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">{t("eyebrow")}</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
              {t("heading")}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground lg:justify-self-end">
            {t("description")}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:items-stretch">
          <div data-reveal="" data-reveal-delay={80}>
            <DirectionCard
              href="/services"
              index={t("design.index")}
              title={t("design.title")}
              status={t("design.status")}
              description={t("design.description")}
              meta={t("design.meta")}
              linkLabel={t("design.link")}
              media={
                <HazeglowField variant="design" className="absolute inset-0 size-full" />
              }
            />
          </div>
          <div data-reveal="" data-reveal-delay={140}>
            <DirectionCard
              href="/line-launcher"
              index={t("product.index")}
              title={t("product.title")}
              status={t("product.status")}
              description={t("product.description")}
              meta={t("product.meta")}
              linkLabel={t("product.link")}
              media={<HazeglowField className="absolute inset-0 size-full" />}
              accent
            />
          </div>
        </div>
      </div>
    </section>
  );
}
