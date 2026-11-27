import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { HoverGlow } from "@/components/site/hover-glow";
import { Button } from "@/components/ui/button";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizeWorkCases, WORK_CASES, type LocalizedWorkCase } from "@/lib/work-cases";
import { cn } from "@/lib/utils";

interface WorkIndexProps {
  /** Ограничить количество работ (для блока на главной). */
  limit?: number;
  /** Показать ссылку «Все работы» — адрес раздела. */
  allHref?: string;
  /** Компактный вид для главной: без крупного верхнего отступа. */
  compact?: boolean;
  /** Переопределение заголовка (на главной блок называется иначе). */
  heading?: string;
  lead?: string;
  className?: string;
}

/**
 * Раздел «Работы»: один крупный кейс и список остальных.
 *
 * Раскладка намеренно несимметричная: три одинаковые карточки читались как
 * каталог товаров, а не как портфолио. Первый проект получает крупный кадр и
 * собственный текстовый блок, остальные идут строками с миниатюрами.
 */
export async function WorkIndex({
  limit,
  allHref,
  compact = false,
  heading,
  lead,
  className,
}: WorkIndexProps) {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("work"),
  ]);
  const workLocale = locale === "ru" ? "ru" : "en";
  const items = localizeWorkCases(WORK_CASES, workLocale).slice(0, limit ?? WORK_CASES.length);
  const [featured, ...rest] = items;
  const Heading = compact ? "h2" : "h1";

  return (
    <section className={className ?? "section-y"}>
      <div className="container">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <Heading
              className={cn(
                "font-semibold tracking-tight",
                compact ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl",
              )}
            >
              {heading ?? t("title")}
            </Heading>
            <p className="mt-4 max-w-xl text-base leading-[1.75] text-muted-foreground md:text-lg">
              {lead ?? t("lead")}
            </p>
          </div>
          {allHref ? (
            <Button asChild variant="neutral">
              <Link href={allHref} className="gap-2">
                {t("all")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        {featured ? (
          <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:gap-14">
            <Link
              href={`/work/${featured.slug}`}
              aria-label={featured.title}
              className="group relative block overflow-hidden bg-white/[0.045] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <img
                src={featured.cover}
                alt={featured.coverAlt}
                loading={compact ? "lazy" : "eager"}
                decoding="async"
                className="aspect-[16/10] w-full object-cover object-top opacity-95 transition-opacity duration-500 ease-out group-hover:opacity-100"
              />
            </Link>

            <div className="relative flex flex-col gap-4 overflow-hidden lg:pb-2">
              <HoverGlow pattern={`work:${featured.slug}`} intensity={0.4} />
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                <span>{featured.discipline}</span>
                <span className="tracking-normal normal-case">{featured.year}</span>
              </p>
              <h3 className="text-2xl font-medium tracking-tight text-balance md:text-3xl">
                <Link
                  href={`/work/${featured.slug}`}
                  className="transition-colors hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  {featured.title}
                </Link>
              </h3>
              <p className="text-sm leading-[1.75] text-muted-foreground md:text-base">
                {featured.summary}
              </p>
              <Link
                href={`/work/${featured.slug}`}
                className="group/open mt-1 inline-flex items-center gap-2 text-sm font-medium text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {t("open")}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 transition-[transform,color] duration-200 group-hover/open:-translate-y-0.5 group-hover/open:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        ) : null}

        {rest.length > 0 ? (
          <ul className="mt-12 divide-y divide-white/[0.08]">
            {rest.map((item) => (
              <WorkRow key={item.slug} item={item} openLabel={t("open")} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Строка портфолио: миниатюра, дисциплина и название. Без карточной
 * подложки — разделители держат ритм, а ссылка реагирует фоном и стрелкой.
 */
function WorkRow({ item, openLabel }: { item: LocalizedWorkCase; openLabel: string }) {
  return (
    <li>
      <Link
        href={`/work/${item.slug}`}
        className="group flex items-center gap-5 py-5 transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.05] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-8 sm:py-6"
      >
        <span className="relative block w-20 shrink-0 overflow-hidden bg-white/[0.05] sm:w-28">
          <img
            src={item.cover}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover object-top opacity-90 transition-opacity duration-300 ease-out group-hover:opacity-100"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tracking-[0.12em] uppercase">{item.discipline}</span>
            <span>{item.year}</span>
          </span>
          <span className="mt-1.5 block truncate text-lg font-medium tracking-tight sm:text-xl">
            {item.title}
          </span>
          <span className="sr-only">{openLabel}</span>
        </span>

        <ArrowUpRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </Link>
    </li>
  );
}
