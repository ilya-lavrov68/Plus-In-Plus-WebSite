import { prisma } from "@/lib/prisma";

import type { CandlePoint } from "@/components/spectrumui/candlestick-chart";

/**
 * Финансовые ряды для админки: доход и продажи в виде свечей (OHLC).
 *
 * Свеча строится по сделкам одного дня — как биржевая по сделкам сессии:
 *   open  — сумма первой сделки дня,
 *   high  — самая крупная сделка дня,
 *   low   — самая мелкая,
 *   close — последняя сделка дня,
 *   volume — оборот дня (сумма) либо количество сделок.
 *
 * Дни без сделок пропускаются — как неторговые дни на бирже: свеча без
 * событий ничего не сообщает и только сжимает остальные.
 *
 * Все деньги — целые копейки (см. prisma/schema.prisma), наружу они выходят
 * без преобразований: форматирование делает клиентский компонент графика.
 */

export interface FinanceSummary {
  /** Поступившие деньги за период (успешные платежи), копейки. */
  revenue: number;
  /** Количество успешных платежей. */
  paymentsCount: number;
  /** Сколько заявок создано за период. */
  ordersCount: number;
  /** Средний чек: доход / число успешных платежей, копейки. */
  averageCheck: number;
}

interface DayBucket {
  date: string;
  label: string;
  values: number[];
  volume: number;
}

/** Ключ дня в UTC: агрегаты не должны зависеть от часового пояса сервера. */
function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  // "2026-10-03" -> "03.10"
  return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
}

function windowStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

/**
 * Складывает отсортированные по времени события (момент, сумма) в дневные
 * свечи. `volumeOf` решает, что считать оборотом дня: сумму или количество.
 */
function buildCandles(
  events: Array<{ at: Date; amount: number }>,
  volumeOf: (values: number[]) => number,
): CandlePoint[] {
  const buckets = new Map<string, DayBucket>();
  for (const event of events) {
    const key = dayKey(event.at);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: key, label: dayLabel(key), values: [], volume: 0 };
      buckets.set(key, bucket);
    }
    bucket.values.push(event.amount);
  }

  return [...buckets.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((bucket) => ({
      date: bucket.date,
      label: bucket.label,
      open: bucket.values[0],
      high: Math.max(...bucket.values),
      low: Math.min(...bucket.values),
      close: bucket.values[bucket.values.length - 1],
      volume: volumeOf(bucket.values),
    }));
}

/**
 * Доход: успешные платежи по дням. Оборот свечи — сумма поступлений за день.
 */
export async function getRevenueCandles(days = 30): Promise<CandlePoint[]> {
  if (!prisma) return [];
  try {
    const payments = await prisma.payment.findMany({
      where: {
        status: "succeeded",
        OR: [
          { paidAt: { gte: windowStart(days) } },
          { paidAt: null, createdAt: { gte: windowStart(days) } },
        ],
      },
      select: { amount: true, paidAt: true, createdAt: true },
    });
    const events = payments
      .map((payment) => ({ at: payment.paidAt ?? payment.createdAt, amount: payment.amount }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    return buildCandles(events, (values) => values.reduce((sum, value) => sum + value, 0));
  } catch (error) {
    console.error("Failed to load revenue candles:", error);
    return [];
  }
}

/**
 * Продажи: созданные заявки по дням, по стоимости заказа. Пока менеджер не
 * согласовал цену, берётся расчётная сумма — для динамики продаж это честный
 * ориентир, другого числа у заявки ещё нет. Оборот свечи — число заявок.
 */
export async function getSalesCandles(days = 30): Promise<CandlePoint[]> {
  if (!prisma) return [];
  try {
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: windowStart(days) } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, total: true, estimatedAmount: true },
    });
    const events = orders.map((order) => ({
      at: order.createdAt,
      amount: order.total > 0 ? order.total : order.estimatedAmount,
    }));
    return buildCandles(events, (values) => values.length);
  } catch (error) {
    console.error("Failed to load sales candles:", error);
    return [];
  }
}

/** Карточки над графиками: доход, платежи, заявки, средний чек. */
export async function getFinanceSummary(days = 30): Promise<FinanceSummary> {
  const empty: FinanceSummary = { revenue: 0, paymentsCount: 0, ordersCount: 0, averageCheck: 0 };
  if (!prisma) return empty;
  try {
    const since = windowStart(days);
    const [payments, ordersCount] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: "succeeded",
          OR: [{ paidAt: { gte: since } }, { paidAt: null, createdAt: { gte: since } }],
        },
        select: { amount: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
    ]);
    const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return {
      revenue,
      paymentsCount: payments.length,
      ordersCount,
      averageCheck: payments.length ? Math.round(revenue / payments.length) : 0,
    };
  } catch (error) {
    console.error("Failed to load the finance summary:", error);
    return empty;
  }
}
