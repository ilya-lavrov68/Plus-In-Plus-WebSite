import { rows as queryPayloadRows } from "@/lib/db";

export interface TrafficSummary {
  views: number;
  /** Уникальные посетители — по visitor_id, не по аккаунту. */
  visitors: number;
  sessions: number;
  /** Среднее время на странице, секунды. 0, если замеров ещё нет. */
  avgSeconds: number;
}

export interface PageStat {
  path: string;
  views: number;
  visitors: number;
  avgSeconds: number;
}

export interface SourceStat {
  name: string;
  views: number;
}

export interface DeviceStat {
  device: string;
  views: number;
}

export interface DayStat {
  date: string;
  views: number;
  visitors: number;
}

export interface OrderStats {
  queue: number;
  revenue: number;
  paidCount: number;
  averageOrder: number;
}

const EMPTY_SUMMARY: TrafficSummary = { views: 0, visitors: 0, sessions: 0, avgSeconds: 0 };
const EMPTY_ORDER_STATS: OrderStats = { queue: 0, revenue: 0, paidCount: 0, averageOrder: 0 };

/**
 * Даты в SQLite встречаются в двух видах: приложение пишет строки ISO, а
 * старые записи (и прямой импорт) — целые миллисекунды. В SQLite любое
 * число меньше любой строки, поэтому обычное «created_at >= ?» молча теряет
 * половину данных. Сравниваем каждый тип своим значением.
 */
function since(days: number): { ms: number; iso: string } {
  const date = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  return { ms: date.getTime(), iso: date.toISOString() };
}

const FROM_CLAUSE = `(
  (typeof(created_at) = 'integer' AND created_at >= ?)
  OR (typeof(created_at) = 'text' AND created_at >= ?)
)`;

/** День записи независимо от того, чем она лежит: числом или строкой. */
const DAY_EXPR = `date(
  CASE WHEN typeof(created_at) = 'integer'
       THEN created_at / 1000
       ELSE unixepoch(created_at)
  END, 'unixepoch')`;

/**
 * Агрегаты считаются сырым SQL, а не groupBy: уникальных посетителей и
 * среднюю длительность Payload считает либо неверно, либо отдельным запросом
 * на каждую страницу. Здесь всё выходит одним проходом по индексу
 * (path, created_at).
 */
async function rows<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  try {
    return await queryPayloadRows<T>(sql, args);
  } catch (error) {
    console.error("Analytics query failed:", error);
    return [];
  }
}

/** Число из результата raw-запроса: драйверы отдают и number, и bigint. */
function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0) || 0;
}

/** Финансовые метрики считаются одним SQL-запросом без загрузки истории платежей. */
export async function getOrderStats(): Promise<OrderStats> {
  const result = await rows<Record<string, unknown>>(`
    SELECT
      (SELECT COUNT(*) FROM orders
        WHERE status IN ('pending', 'quote_requested', 'negotiating')) AS queue,
      (SELECT COALESCE(SUM(amount), 0) FROM payments
        WHERE status = 'succeeded') AS revenue,
      (SELECT COUNT(*) FROM orders AS o
        WHERE EXISTS (
          SELECT 1 FROM payments AS p
          WHERE p.order_id_id = o.id AND p.status = 'succeeded'
        )) AS paidCount
  `);
  const row = result[0];
  if (!row) return EMPTY_ORDER_STATS;
  const revenue = num(row.revenue);
  const paidCount = num(row.paidCount);
  return {
    queue: num(row.queue),
    revenue,
    paidCount,
    averageOrder: paidCount ? Math.round(revenue / paidCount) : 0,
  };
}

export async function getTrafficSummary(days = 30): Promise<TrafficSummary> {
  const from = since(days);
  const result = await rows<Record<string, unknown>>(
    `SELECT COUNT(*) views,
            COUNT(DISTINCT visitor_id) visitors,
            COUNT(DISTINCT session_id) sessions,
            AVG(duration_ms) avgMs
     FROM page_views
     WHERE ${FROM_CLAUSE}`,
    from.ms,
    from.iso,
  );
  const row = result[0];
  if (!row) return EMPTY_SUMMARY;
  return {
    views: num(row.views),
    visitors: num(row.visitors),
    sessions: num(row.sessions),
    avgSeconds: Math.round(num(row.avgMs) / 1000),
  };
}

/** Самые посещаемые страницы — главный отчёт по контенту. */
export async function getTopPages(days = 30, limit = 20): Promise<PageStat[]> {
  const from = since(days);
  const result = await rows<Record<string, unknown>>(
    `SELECT path,
            COUNT(*) views,
            COUNT(DISTINCT visitor_id) visitors,
            AVG(duration_ms) avgMs
     FROM page_views
     WHERE ${FROM_CLAUSE}
     GROUP BY path
     ORDER BY views DESC
     LIMIT ?`,
    from.ms,
    from.iso,
    limit,
  );
  return result.map((row) => ({
    path: String(row.path ?? "/"),
    views: num(row.views),
    visitors: num(row.visitors),
    avgSeconds: Math.round(num(row.avgMs) / 1000),
  }));
}

/** Откуда приходят: сначала чужие сайты, потом рекламные метки. */
export async function getTrafficSources(days = 30): Promise<SourceStat[]> {
  const from = since(days);
  const result = await rows<Record<string, unknown>>(
    `SELECT name, COUNT(*) views FROM (
       SELECT referrer name FROM page_views
         WHERE ${FROM_CLAUSE} AND referrer IS NOT NULL AND referrer <> ''
       UNION ALL
       SELECT 'utm:' || utm_source FROM page_views
         WHERE ${FROM_CLAUSE} AND utm_source IS NOT NULL AND utm_source <> ''
     )
     GROUP BY name
     ORDER BY views DESC
     LIMIT 10`,
    from.ms,
    from.iso,
    from.ms,
    from.iso,
  );
  return result.map((row) => ({ name: String(row.name ?? ""), views: num(row.views) }));
}

export async function getDeviceSplit(days = 30): Promise<DeviceStat[]> {
  const from = since(days);
  const result = await rows<Record<string, unknown>>(
    `SELECT device, COUNT(*) views
     FROM page_views
     WHERE ${FROM_CLAUSE} AND device IS NOT NULL
     GROUP BY device
     ORDER BY views DESC`,
    from.ms,
    from.iso,
  );
  return result.map((row) => ({ device: String(row.device ?? ""), views: num(row.views) }));
}

/** Ряд по дням — чтобы видеть динамику, а не только итог. */
export async function getDailySeries(days = 30): Promise<DayStat[]> {
  const from = since(days);
  const result = await rows<Record<string, unknown>>(
    `SELECT ${DAY_EXPR} date,
            COUNT(*) views,
            COUNT(DISTINCT visitor_id) visitors
     FROM page_views
     WHERE ${FROM_CLAUSE}
     GROUP BY date
     ORDER BY date ASC`,
    from.ms,
    from.iso,
  );
  return result.map((row) => ({
    date: String(row.date ?? ""),
    views: num(row.views),
    visitors: num(row.visitors),
  }));
}
