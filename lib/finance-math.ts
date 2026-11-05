/**
 * Финансовая математика графиков админки.
 *
 * Здесь только чистые функции: вход — строки из базы, выход — точки для SVG.
 * Благодаря этому OHLC-свечи, просадку портфеля и корзины гистограммы можно
 * проверить тестами без базы данных, а слой запросов (`lib/admin-finance.ts`)
 * остаётся тонким.
 */

/** Одна свеча: OHLC дневной выручки внутри отрезка периода. */
export interface Candle {
  /** ISO-день начала отрезка, он же ключ точки. */
  key: string;
  /** Подпись оси: `05.11`. */
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Сумма выручки отрезка — объёмная панель под свечами. */
  volume: number;
  /** Сколько дней внутри отрезка имели выручку. */
  activeDays: number;
}

export interface DailyPoint {
  key: string;
  label: string;
  /** Выручка за день. */
  value: number;
}

export interface PortfolioPoint extends DailyPoint {
  /** Выручка за скользящее окно — «стоимость» портфеля. */
  smoothed: number;
  /** Базовая линия: средний темп с начала периода. */
  basis: number;
  /** Бегущий пик «стоимости». */
  peak: number;
  /** Просадка от пика в рублях: `peak − smoothed`. */
  drawdown: number;
  /** Просадка в процентах: 0 на пике, отрицательная ниже пика. */
  drawdownPct: number;
}

export interface PortfolioSeries {
  points: PortfolioPoint[];
  /** Ширина скользящего окна в днях. */
  window: number;
  /** Сумма выручки за период. */
  total: number;
  /** Последняя «стоимость» портфеля. */
  current: number;
  /** Последняя базовая линия. */
  basis: number;
  /** Отклонение стоимости от базы в процентах. */
  deltaPct: number;
  /** Текущая просадка в процентах. */
  drawdownPct: number;
  /** Худшая просадка периода в процентах. */
  maxDrawdownPct: number;
}

export interface CheckBin {
  from: number;
  to: number;
  /** Готовая подпись диапазона: `10–25 тыс.` или `≥ 100 тыс.`. */
  label: string;
  count: number;
}

export interface CheckHistogram {
  bins: CheckBin[];
  samples: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

export interface CategorySeries {
  dates: string[];
  labels: string[];
  series: { key: string; label: string; total: number; values: number[] }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO-день из строки базы (`2026-11-05T10:20:30Z` или `2026-11-05 10:20:30`). */
export function dayKey(value: string): string {
  return value.slice(0, 10);
}

/** Подпись дня `05.11` без зависимости от локальной зоны процесса. */
export function dayLabel(key: string): string {
  const [, month, day] = key.split("-");
  return month && day ? `${day}.${month}` : key;
}

/**
 * Свечи по выручке: свеча — отрезок периода, тело — открытие и закрытие, тени —
 * минимум и максимум дневной выручки внутри отрезка.
 *
 * Длина отрезка зависит от диапазона (день, неделя, две недели, месяц): на
 * длинном периоде дневные свечи сливались бы в частокол. Пустые дни в расчёт
 * OHLC не идут — иначе каждая свеча растягивалась бы до нуля, — но в объём
 * отрезка входит вся выручка.
 */
export function buildRevenueCandles(daily: DailyPoint[], bucketDays: number): Candle[] {
  const width = Math.max(1, Math.round(bucketDays));
  const candles: Candle[] = [];

  for (let start = 0; start < daily.length; start += width) {
    const bucket = daily.slice(start, start + width);
    const active = bucket.filter((point) => point.value > 0);
    const first = bucket[0];
    if (!first || active.length === 0) continue;

    const values = active.map((point) => point.value);
    candles.push({
      key: first.key,
      label: first.label,
      open: values[0] ?? 0,
      close: values[values.length - 1] ?? 0,
      high: Math.max(...values),
      low: Math.min(...values),
      volume: bucket.reduce((sum, point) => sum + point.value, 0),
      activeDays: active.length,
    });
  }

  return candles;
}

/** Среднее арифметическое; пустой список — ноль. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Квантиль по уже отсортированному списку: линейная интерполяция (type 7). */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return Math.round(low + (high - low) * (position - lower));
}

/**
 * Портфель: «стоимость» против базовой линии, с просадкой от бегущего пика.
 *
 * Стоимость — выручка за скользящее окно (по умолчанию неделя): одиночный день
 * без продаж не должен выглядеть как обвал на 100%. База — средний темп с
 * начала периода, пик — лучшая точка периода. Просадка считается от пика и
 * именно она закрашивается под линией.
 */
export function buildPortfolio(daily: DailyPoint[], window = 7): PortfolioSeries {
  const width = Math.max(1, Math.round(window));
  const points: PortfolioPoint[] = [];
  let runningPeak = 0;
  let runningSum = 0;
  let maxDrawdownPct = 0;

  daily.forEach((point, index) => {
    runningSum += point.value;
    if (index >= width) runningSum -= daily[index - width]?.value ?? 0;
    const smoothed = Math.round(runningSum);
    const basis = Math.round(mean(daily.slice(0, index + 1).map((item) => item.value)) * width);
    runningPeak = Math.max(runningPeak, smoothed);
    const drawdown = Math.max(0, runningPeak - smoothed);
    const drawdownPct = runningPeak > 0 && drawdown > 0 ? -Math.round((drawdown / runningPeak) * 1000) / 10 : 0;
    maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);
    points.push({
      ...point,
      smoothed,
      basis,
      peak: runningPeak,
      drawdown,
      drawdownPct,
    });
  });

  const last = points[points.length - 1];
  const current = last?.smoothed ?? 0;
  const basis = last?.basis ?? 0;
  return {
    points,
    window: width,
    total: Math.round(daily.reduce((sum, point) => sum + point.value, 0)),
    current,
    basis,
    deltaPct: basis > 0 ? Math.round(((current - basis) / basis) * 1000) / 10 : 0,
    drawdownPct: last?.drawdownPct ?? 0,
    maxDrawdownPct: Math.round(maxDrawdownPct * 10) / 10 + 0,
  };
}

/** «Красивый» шаг оси: 1, 2 или 5 на порядок. */
export function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Гистограмма сумм заказов: корзины на «красивых» границах, среднее и
 * квантили. Последняя корзина открытая — в неё попадает длинный хвост.
 */
export function buildHistogram(values: number[], binCount = 8): CheckHistogram {
  const samples = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (samples.length === 0) {
    return { bins: [], samples: 0, mean: 0, p50: 0, p95: 0, max: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1] ?? 0;
  const step = niceStep(Math.max(1, max) / Math.max(1, binCount - 1));
  const count = Math.max(1, Math.ceil((max + 1) / step));
  const bins: CheckBin[] = Array.from({ length: count }, (_, index) => ({
    from: index * step,
    to: (index + 1) * step,
    label: "",
    count: 0,
  }));

  for (const value of sorted) {
    const index = Math.min(count - 1, Math.floor(value / step));
    const bin = bins[index];
    if (bin) bin.count += 1;
  }

  for (const [index, bin] of bins.entries()) {
    bin.label = index === bins.length - 1 && bin.count > 0 ? `${bin.from}+` : `${bin.from}–${bin.to}`;
  }

  return { bins, samples: sorted.length, mean: Math.round(mean(sorted)), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), max };
}

/**
 * Структура выручки по категориям: топ-N категорий плюс «Другое».
 * Возвращает выровненные по дням ряды — их рисует stacked area.
 */
export function buildCategorySeries(
  rows: { date: string; bucket: string; amount: number }[],
  limit = 4,
): CategorySeries {
  const dates = [...new Set(rows.map((row) => dayKey(row.date)))].sort((a, b) => a.localeCompare(b));
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.bucket, (totals.get(row.bucket) ?? 0) + row.amount);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const head = ranked.slice(0, limit).map(([key]) => key);
  const hasRest = ranked.length > limit;

  const keys = hasRest ? [...head, "__other"] : head;
  const series = keys.map((key) => ({
    key,
    label: key,
    total: Math.round(key === "__other" ? ranked.slice(limit).reduce((sum, [, value]) => sum + value, 0) : (totals.get(key) ?? 0)),
    values: dates.map(() => 0),
  }));

  const index = new Map(dates.map((date, position) => [date, position]));
  for (const row of rows) {
    const key = head.includes(row.bucket) ? row.bucket : "__other";
    const target = series.find((item) => item.key === key);
    const position = index.get(dayKey(row.date));
    if (target && position !== undefined) target.values[position] = (target.values[position] ?? 0) + row.amount;
  }

  return {
    dates,
    labels: dates.map(dayLabel),
    series: series.map((item) => ({ ...item, values: item.values.map((value) => Math.round(value)) })),
  };
}

/** Плотный ряд по дням периода: пропущенные дни дополняются нулём. */
export function fillDailySeries(
  rows: { date: string; value: number }[],
  days: number,
  now = Date.now(),
): DailyPoint[] {
  const span = Math.max(1, Math.round(days));
  const byDay = new Map(rows.map((row) => [dayKey(row.date), row.value]));
  const points: DailyPoint[] = [];
  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const key = new Date(now - offset * DAY_MS).toISOString().slice(0, 10);
    points.push({ key, label: dayLabel(key), value: Math.round(byDay.get(key) ?? 0) });
  }
  return points;
}
