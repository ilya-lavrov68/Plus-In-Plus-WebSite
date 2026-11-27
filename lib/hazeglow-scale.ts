/**
 * Пересчёт размера ячейки Hazeglow в CSS-пиксели.
 *
 * Библиотека считает ячейку как `effectSize * min(сторона) / 1080` — то есть
 * `effectSize` зависит от размера элемента, а не задаёт пиксели напрямую.
 * Чтобы паттерн был крупным и одинаковым по восприятию на любой секции,
 * считаем `effectSize` от измеренной стороны и целевого размера ячейки.
 */
export const HAZEGLOW_CELL = {
  /** Фон секции: крупная «печатная» ячейка. */
  section: 6,
  /** Первый экран: ещё крупнее, чтобы растр читался как фактура. */
  hero: 6,
  /** Знак ASCII на страницах софта. */
  ascii: 18,
  /** Статичный кадр при наведении на карточку. */
  hover: 5,
} as const;

/** Вернуть `effectSize` для целевой ячейки в CSS-пикселях. */
export function effectSizeFor(minSideCss: number, targetCss: number): number {
  const side = Math.max(160, Math.min(2048, minSideCss));
  const raw = Math.round((targetCss * 1080) / side);
  return Math.min(64, Math.max(2, raw));
}
