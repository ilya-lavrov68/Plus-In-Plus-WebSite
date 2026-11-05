import { toRubles } from "@/lib/admin-money";
import { rows as queryPayloadRows } from "@/lib/db";
import {
  buildCategorySeries,
  buildHistogram,
  buildPortfolio,
  buildRevenueCandles,
  fillDailySeries,
  type Candle,
  type CategorySeries,
  type CheckHistogram,
  type PortfolioSeries,
} from "@/lib/finance-math";

/**
 * Финансовые выборки для графиков админки.
 *
 * Данные берутся из тех же таблиц, что и заказы (`orders`, `order_items`), а не
 * из демо-массива: графики живут на реальной выручке. Скоуп повторяет правила
 * `lib/admin-queries.ts` — корзины отбрасываются, выручкой считаются только
 * оплаченные, принятые в работу и завершённые заказы.
 */

export const FINANCE_RANGES = ["1m", "3m", "6m", "1y"] as const;
export type FinanceRange = (typeof FINANCE_RANGES)[number];

/** Что именно показывает панель: свечи, портфель, чеки или структуру. */
export const FINANCE_KINDS = ["candles", "portfolio", "checks", "categories"] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

const RANGE_DAYS: Record<FinanceRange, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 };

export function isFinanceRange(value: unknown): value is FinanceRange {
  return typeof value === "string" && (FINANCE_RANGES as readonly string[]).includes(value);
}

export function isFinanceKind(value: unknown): value is FinanceKind {
  return typeof value === "string" && (FINANCE_KINDS as readonly string[]).includes(value);
}

export function financeRangeDays(range: FinanceRange): number {
  return RANGE_DAYS[range] ?? 90;
}

const REVENUE_SCOPE = "o.status in ('paid', 'in_progress', 'completed')";
const ORDER_DATE = "coalesce(o.created_at, o.updated_at)";

function since(days: number): string {
  const span = Math.min(Math.max(Math.round(days), 1), 365);
  return new Date(Date.now() - span * 24 * 60 * 60 * 1000).toISOString();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown): string {
  return value == null ? "" : String(value);
}

/**
 * Длина отрезка свечи зависит от диапазона: месяц — четыре дня, квартал —
 * неделя, полугодие — две недели, год — месяц. Так на любом периоде в графике
 * 8–26 свечей, а не частокол.
 */
export function candleBucketDays(days: number): number {
  if (days <= 31) return 4;
  if (days <= 92) return 7;
  if (days <= 200) return 14;
  return 30;
}

/** Свечи по выручке: OHLC дневной выручки внутри отрезка плюс объём. */
export async function getRevenueCandles(days: number): Promise<Candle[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select substr(replace(${ORDER_DATE}, ' ', 'T'), 1, 10) date, sum(o.total) value
     from orders o
     where ${REVENUE_SCOPE} and ${ORDER_DATE} >= ?
     group by date
     order by date asc`,
    [since(days)],
  );
  const daily = fillDailySeries(
    rows.map((row) => ({ date: toText(row.date), value: toRubles(toNumber(row.value)) })),
    days,
  );
  return buildRevenueCandles(daily, candleBucketDays(days));
}

/** Портфель: скользящая недельная выручка против базового темпа и просадка. */
export async function getPortfolioSeries(days: number): Promise<PortfolioSeries> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select substr(replace(${ORDER_DATE}, ' ', 'T'), 1, 10) date, sum(o.total) value
     from orders o
     where ${REVENUE_SCOPE} and ${ORDER_DATE} >= ?
     group by date
     order by date asc`,
    [since(days)],
  );
  const daily = fillDailySeries(
    rows.map((row) => ({ date: toText(row.date), value: toRubles(toNumber(row.value)) })),
    days,
  );
  return buildPortfolio(daily, 7);
}

/** Гистограмма чеков: распределение сумм заказов. */
export async function getCheckHistogram(days: number): Promise<CheckHistogram> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select o.total total from orders o where ${REVENUE_SCOPE} and ${ORDER_DATE} >= ?`,
    [since(days)],
  );
  return buildHistogram(rows.map((row) => toRubles(toNumber(row.total))));
}

/** Структура выручки: категории услуг и товаров по дням. */
export async function getCategorySeries(days: number): Promise<CategorySeries> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select substr(replace(${ORDER_DATE}, ' ', 'T'), 1, 10) date,
            coalesce(
              nullif(trim(coalesce(s.category, '')), ''),
              nullif(trim(coalesce(p.category, '')), ''),
              case oi.item_type when 'product' then 'products' else 'services' end
            ) bucket,
            sum(case when oi.total_price > 0 then oi.total_price else oi.estimated_unit_price * oi.quantity end) amount
     from order_items oi
     join orders o on o.id = oi.order_id_id
     left join services s on s.id = oi.service_id_id
     left join products p on p.id = oi.product_id_id
     where ${REVENUE_SCOPE} and ${ORDER_DATE} >= ?
     group by date, bucket
     order by date asc`,
    [since(days)],
  );
  return buildCategorySeries(
    rows.map((row) => ({
      date: toText(row.date),
      bucket: toText(row.bucket) || "services",
      amount: toRubles(toNumber(row.amount)),
    })),
    4,
  );
}

export interface FinanceSummary {
  /** Сумма незакрытых заказов — «портфель в работе». */
  backlog: number;
  backlogOrders: number;
  /** Выручка за 30 дней. */
  revenue30: number;
  orders30: number;
  /** Средний чек за 30 дней. */
  averageCheck: number;
  /** Доля оплаченных заказов среди всех, кроме корзины, за 30 дней. */
  paidShare: number;
  /** Выручка за сегодня. */
  today: number;
}

/** Сводка для верхней полосы: без неё графики висят без контекста. */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const from = since(30);
  const [backlog, month, paid, today] = await Promise.all([
    queryPayloadRows<Record<string, unknown>>(
      `select coalesce(sum(o.total), 0) total, count(*) orders
       from orders o
       where o.status not in ('cart', 'completed', 'cancelled', 'refunded')`,
    ),
    queryPayloadRows<Record<string, unknown>>(
      `select coalesce(sum(case when ${REVENUE_SCOPE} then o.total else 0 end), 0) revenue,
              count(*) orders,
              coalesce(sum(case when o.status in ('paid', 'completed') then 1 else 0 end), 0) paid
       from orders o
       where o.status <> 'cart' and ${ORDER_DATE} >= ?`,
      [from],
    ),
    queryPayloadRows<Record<string, unknown>>(
      `select coalesce(sum(o.total), 0) total from orders o where ${REVENUE_SCOPE} and ${ORDER_DATE} >= ?`,
      [from],
    ),
    queryPayloadRows<Record<string, unknown>>(
      `select coalesce(sum(o.total), 0) total
       from orders o
       where ${REVENUE_SCOPE} and substr(replace(${ORDER_DATE}, ' ', 'T'), 1, 10) = ?`,
      [new Date().toISOString().slice(0, 10)],
    ),
  ]);

  const backlogRow = backlog[0] ?? {};
  const monthRow = month[0] ?? {};
  const revenue30 = toRubles(toNumber(paid[0]?.total ?? monthRow.revenue));
  const orders30 = toNumber(monthRow.orders);
  return {
    backlog: toRubles(toNumber(backlogRow.total)),
    backlogOrders: toNumber(backlogRow.orders),
    revenue30,
    orders30,
    averageCheck: orders30 > 0 ? Math.round(revenue30 / orders30) : 0,
    paidShare: orders30 > 0 ? Math.round((toNumber(monthRow.paid) / orders30) * 100) : 0,
    today: toRubles(toNumber(today[0]?.total)),
  };
}

/** Полезная нагрузка для клиентских панелей: только примитивы и массивы. */
export type FinancePayload =
  | { kind: "candles"; candles: Candle[] }
  | { kind: "portfolio"; portfolio: PortfolioSeries }
  | { kind: "checks"; histogram: CheckHistogram }
  | { kind: "categories"; categories: CategorySeries };

/** Единая точка входа: и для серверного рендера, и для серверного действия. */
export async function loadFinancePayload(kind: FinanceKind, days: number): Promise<FinancePayload> {
  switch (kind) {
    case "candles":
      return { kind: "candles", candles: await getRevenueCandles(days) };
    case "portfolio":
      return { kind: "portfolio", portfolio: await getPortfolioSeries(days) };
    case "checks":
      return { kind: "checks", histogram: await getCheckHistogram(days) };
    case "categories":
      return { kind: "categories", categories: await getCategorySeries(days) };
  }
}
