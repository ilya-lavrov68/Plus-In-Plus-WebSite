import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { WorkCard } from "@/components/site/work-card";
import { Button } from "@/components/ui/button";
import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizeWorkCases, WORK_CASES } from "@/lib/work-cases";
import { cn } from "@/lib/utils";

interface WorkIndexProps {
  /** Ограничить количество работ (для блока на главной). */
  limit?: number;
  /** Показать ссылку «Все работы» — адрес раздела. */
  allHref?: string;
  /** Компактный вид для главной: три равные карточки без крупного лида. */
  compact?: boolean;
  /** Переопределение заголовка (на главной блок называется иначе). */
  heading?: string;
  lead?: string;
  className?: string;
}

/**
 * Раздел «Работы»: индекс кейсов и его компактная версия для главной.
 * Данные — из `lib/work-cases.ts`, тексты — из словаря `work`.
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
            {compact ? null : (
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
                {t("eyebrow")}
              </p>
            )}
            <Heading
              className={cn(
                "mt-4 font-semibold tracking-tight",
                compact ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl",
              )}
            >
              {heading ?? t("title")}
            </Heading>
            <p className="mt-4 text-base leading-[1.75] text-muted-foreground md:text-lg">
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

        {compact ? (
          <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <WorkCard key={item.slug} item={item} openLabel={t("open")} />
            ))}
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            {featured ? <WorkCard item={featured} openLabel={t("open")} featured /> : null}
            {rest.length > 0 ? (
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
                {rest.map((item) => (
                  <WorkCard key={item.slug} item={item} openLabel={t("open")} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
