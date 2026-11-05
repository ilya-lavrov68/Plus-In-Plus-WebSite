import { FinancePanel, type FinancePanelLabels } from "@/components/admin/finance/panel";
import { getFinanceSummary, loadFinancePayload } from "@/lib/admin-finance";
import type { RequestLocale } from "@/lib/request-locale";

/**
 * Серверные секции финансовых графиков.
 *
 * Данные тянутся внутри компонента, а не в самой странице: благодаря этому
 * каждый блок стримится своим `<Suspense>`, и тяжёлая сводка заказов не держит
 * остальную страницу. Первый диапазон — три месяца: он попадает в типичный
 * рабочий горизонт студии.
 */
const DEFAULT_RANGE = "3m";
const DEFAULT_DAYS = 90;

interface SectionProps {
  labels: FinancePanelLabels;
  locale: RequestLocale;
  className?: string;
}

export async function CandlesSection({ labels, locale, className }: SectionProps) {
  const initial = await loadFinancePayload("candles", DEFAULT_DAYS);
  return (
    <FinancePanel
      kind="candles"
      initialRange={DEFAULT_RANGE}
      initial={initial}
      labels={labels}
      locale={locale}
      className={className}
    />
  );
}

export async function PortfolioSection({ labels, locale, className }: SectionProps) {
  const initial = await loadFinancePayload("portfolio", DEFAULT_DAYS);
  return (
    <FinancePanel
      kind="portfolio"
      initialRange={DEFAULT_RANGE}
      initial={initial}
      labels={labels}
      locale={locale}
      className={className}
    />
  );
}

export async function ChecksSection({ labels, locale, className }: SectionProps) {
  const initial = await loadFinancePayload("checks", DEFAULT_DAYS);
  return (
    <FinancePanel
      kind="checks"
      initialRange={DEFAULT_RANGE}
      initial={initial}
      labels={labels}
      locale={locale}
      className={className}
    />
  );
}

export async function CategoriesSection({ labels, locale, className }: SectionProps) {
  const initial = await loadFinancePayload("categories", DEFAULT_DAYS);
  return (
    <FinancePanel
      kind="categories"
      initialRange={DEFAULT_RANGE}
      initial={initial}
      labels={labels}
      locale={locale}
      className={className}
    />
  );
}

/** Полоса финансовых итогов: контекст для графиков, который не дублирует KPI. */
export async function FinanceSummaryStrip({ labels, locale }: Omit<SectionProps, "className">) {
  const summary = await getFinanceSummary();
  const money = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB");
  const copy = labels.summary;

  const tiles = [
    {
      label: copy.backlog,
      value: money.format(summary.backlog),
      hint: `${copy.backlogHint} · ${number.format(summary.backlogOrders)}`,
    },
    { label: copy.average, value: money.format(summary.averageCheck), hint: copy.averageHint },
    {
      label: copy.paidShare,
      value: `${number.format(summary.paidShare)}%`,
      hint: copy.revenueHint,
    },
    { label: copy.today, value: money.format(summary.today), hint: copy.todayHint },
  ];

  return (
    <section aria-label={labels.summaryTitle} className="rounded-2xl bg-surface-container-low p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-on-surface">{labels.summaryTitle}</h2>
        <p className="text-sm leading-relaxed text-on-surface-variant">{labels.summaryHint}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-xl bg-surface-container p-4">
            <dt className="text-[11px] font-medium tracking-[0.12em] text-on-surface-variant uppercase">{tile.label}</dt>
            <dd className="text-lg leading-none font-medium tabular-nums text-on-surface">{tile.value}</dd>
            <p className="text-xs leading-snug text-on-surface-variant">{tile.hint}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
