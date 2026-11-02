import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PixelDirectionSprite } from "@/components/site/pixel-direction-sprite";
import { getRequestTranslations } from "@/lib/server-i18n";

interface DirectionCardProps {
  href: string;
  index: string;
  title: string;
  status: string;
  description: string;
  meta: string;
  linkLabel: string;
  pattern: "ai" | "design";
  accent?: boolean;
}

/**
 * Карточка направления: острая прямоугольная поверхность с hairline-границей,
 * пиксельный sprite как содержательная визуализация и pill-статус.
 * Скругление здесь не используется — это несущая карточка, а не кнопка.
 */
function DirectionCard({
  href,
  index,
  title,
  status,
  description,
  meta,
  linkLabel,
  pattern,
  accent = false,
}: DirectionCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-none border border-border bg-card transition-colors duration-200 hover:border-primary/60 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span
        aria-hidden="true"
        className="absolute top-0 right-0 z-10 block size-2 bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="relative h-40 shrink-0 overflow-hidden border-b border-border bg-background sm:h-48">
        <PixelDirectionSprite variant={pattern} className="absolute inset-0 size-full" />
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {index}
          </span>
          <span
            className={
              accent
                ? "pip-chip pip-chip--signal"
                : "pip-chip"
            }
          >
            {status}
          </span>
        </div>
        <h3 className="mt-6 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{title}</h3>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-5 text-[11px] font-medium tracking-[0.16em] text-foreground/70 uppercase">{meta}</p>
        <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium text-foreground">
          {linkLabel}
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </span>
      </div>
    </Link>
  );
}

/** Два равноправных направления бренда на главной: ИИ и существующий дизайн. */
export async function BrandDirections() {
  const t = await getRequestTranslations("directions");

  return (
    <section id="directions" className="border-y border-border bg-background py-20 md:py-28">
      <div className="container">
        <div data-reveal="" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="pip-eyebrow">{t("eyebrow")}</p>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl md:text-5xl">
              {t("heading")}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground lg:justify-self-end">
            {t("description")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 md:items-stretch">
          <div data-reveal="" data-reveal-delay={80}>
            <DirectionCard
              href="/ai"
              index={t("ai.index")}
              title={t("ai.title")}
              status={t("ai.status")}
              description={t("ai.description")}
              meta={t("ai.meta")}
              linkLabel={t("ai.link")}
              pattern="ai"
              accent
            />
          </div>
          <div data-reveal="" data-reveal-delay={140}>
            <DirectionCard
              href="/services"
              index={t("design.index")}
              title={t("design.title")}
              status={t("design.status")}
              description={t("design.description")}
              meta={t("design.meta")}
              linkLabel={t("design.link")}
              pattern="design"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
