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

        {/* Сетка как у JetBrains: одинаковые карточки, один шаг между ними.
            Кадр показывается целиком (object-contain) — ничего не режется по
            краям, а подложка карточки держит общий фон под ним. */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:gap-8">
          {items.map((item, index) => (
            <WorkCard
              key={item.slug}
              item={item}
              openLabel={t("open")}
              featured={!compact && index === 0}
              className={!compact && index === 0 ? "sm:col-span-2" : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

