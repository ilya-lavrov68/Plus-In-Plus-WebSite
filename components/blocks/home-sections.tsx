import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Секции главной в структуре payloadcms.com: техничная лента направлений,
 * сплит «две практики», сетка сценариев, нумерованный процесс и манифест.
 * Тексты — наши; структура и пропорции взяты из референса.
 */

export interface MarqueeProps {
  items: string[];
  className?: string;
}

/** Узкая лента направлений вместо карусели логотипов. */
export function DirectionMarquee({ items, className }: MarqueeProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "border-b border-border/70 bg-background py-4",
        className
      )}
    >
      <div className="container flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((item, index) => (
          <span key={item} className="flex items-center gap-6">
            {index > 0 ? (
              <span aria-hidden="true" className="size-1 bg-border" />
            ) : null}
            <span className="pip-mono text-[11px] text-muted-foreground/80">
              {item}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface SplitColumn {
  index: string;
  title: string;
  body: string;
  bullets: string[];
  href: string;
  linkLabel: string;
}

export interface SplitDirectionsProps {
  eyebrow: string;
  heading: string;
  columns: [SplitColumn, SplitColumn];
  className?: string;
}

/** Две равноправные практики: дизайн и ИИ. */
export function SplitDirections({
  eyebrow,
  heading,
  columns,
  className,
}: SplitDirectionsProps) {
  return (
    <section className={cn("border-b border-border/70 py-20 md:py-28", className)}>
      <div className="container">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <p className="pip-mono">{eyebrow}</p>
          <h2 className="max-w-2xl text-3xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-4xl md:text-[2.75rem]">
            {heading}
          </h2>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border md:grid-cols-2">
          {columns.map((column) => (
            <article
              key={column.index}
              className="flex flex-col justify-between gap-10 bg-card p-7 md:p-10"
            >
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="pip-mono text-[10px] text-muted-foreground/60">
                    {column.index}
                  </span>
                  <span className="pip-mono text-[10px]">Plus In Plus</span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-[-0.02em]">
                  {column.title}
                </h3>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {column.body}
                </p>
                <ul className="mt-8 divide-y divide-border/70 border-t border-border/70">
                  {column.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3 py-3 text-sm text-foreground/85"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-1.5 shrink-0 bg-primary"
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={column.href}
                className="group inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {column.linkLabel}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 group-hover:-translate-y-0.5"
                />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface UseCaseCard {
  index: string;
  title: string;
  body: string;
  href: string;
}

export interface UseCasesProps {
  eyebrow: string;
  heading: string;
  description: string;
  cards: UseCaseCard[];
  className?: string;
}

/** Сетка сценариев: что именно можно заказать у студии. */
export function UseCases({
  eyebrow,
  heading,
  description,
  cards,
  className,
}: UseCasesProps) {
  return (
    <section className={cn("border-b border-border/70 py-20 md:py-28", className)}>
      <div className="container">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="pip-mono">{eyebrow}</p>
            <h2 className="mt-6 max-w-2xl text-3xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-4xl">
              {heading}
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.index}
              href={card.href}
              className="group pip-card flex min-h-[13rem] flex-col justify-between gap-8 p-7 transition-colors duration-150 hover:border-foreground/25 md:p-9"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="pip-mono text-[10px] text-muted-foreground/60">
                  {card.index}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:text-primary"
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.02em] md:text-2xl">
                  {card.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface ProcessStep {
  index: string;
  title: string;
  body: string;
}

export interface ProcessProps {
  eyebrow: string;
  heading: string;
  steps: ProcessStep[];
  className?: string;
}

/** Нумерованный процесс без карточек: только линии и ритм. */
export function Process({ eyebrow, heading, steps, className }: ProcessProps) {
  return (
    <section className={cn("border-b border-border/70 py-20 md:py-28", className)}>
      <div className="container">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <p className="pip-mono">{eyebrow}</p>
          <h2 className="max-w-xl text-3xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-4xl">
            {heading}
          </h2>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.index} className="bg-card p-7">
              <span className="pip-mono text-[10px] text-muted-foreground/60">
                {step.index}
              </span>
              <h3 className="mt-6 text-lg font-semibold tracking-[-0.01em]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export interface ManifestoProps {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  linkLabel: string;
  href: string;
  className?: string;
}

/** Манифест: крупное утверждение и два абзаца объяснения. */
export function Manifesto({
  eyebrow,
  heading,
  paragraphs,
  linkLabel,
  href,
  className,
}: ManifestoProps) {
  return (
    <section className={cn("border-b border-border/70 py-20 md:py-28", className)}>
      <div className="container grid gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-20">
        <div>
          <p className="pip-mono">{eyebrow}</p>
          <h2 className="mt-6 max-w-xl text-3xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-4xl md:text-[2.75rem]">
            {heading}
          </h2>
        </div>
        <div>
          <div className="space-y-5 text-sm leading-relaxed text-muted-foreground md:text-base">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <Link
            href={href}
            className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {linkLabel}
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 transition-transform duration-150 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
