import Link from "next/link";
import { ArrowUpRight, Code2, PenTool, type LucideIcon } from "lucide-react";

import { PixelPattern } from "@/components/site/pixel-pattern";
import { getRequestTranslations } from "@/lib/server-i18n";

interface DirectionCardProps {
  href: string;
  index: string;
  title: string;
  status: string;
  description: string;
  meta: string;
  linkLabel: string;
  icon: LucideIcon;
  pattern: "ai" | "design";
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
  icon: Icon,
  pattern,
  accent = false,
}: DirectionCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-200 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative h-40 shrink-0 overflow-hidden border-b border-border bg-background sm:h-48">
        <PixelPattern
          variant={pattern}
          className="absolute inset-0 size-full opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        />
        <div className="absolute bottom-5 left-5 flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground sm:left-6">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.7} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-medium tracking-[0.16em] text-muted-foreground uppercase">{index}</span>
          <span
            className={
              accent
                ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary"
                : "rounded-full border border-border px-3 py-1 font-medium text-muted-foreground"
            }
          >
            {status}
          </span>
        </div>
        <h3 className="mt-6 text-3xl font-medium tracking-tight sm:text-4xl">{title}</h3>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-5 text-sm text-foreground/80">{meta}</p>
        <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground">
          {linkLabel}
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{t("eyebrow")}</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
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
              icon={Code2}
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
              icon={PenTool}
              pattern="design"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
