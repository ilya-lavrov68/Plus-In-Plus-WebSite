/**
 * Пересчёт размера ячейки Hazeglow в CSS-пиксели.
 *
 * Библиотека рисует в backing-store с учётом `devicePixelRatio`, поэтому ячейка
 * в экранных пикселях остаётся той же: `cell_css = effectSize × min(css-сторона) / 1080`.
 * Считаем `effectSize` от измеренной стороны, чтобы ячейка была одинаковой по
 * восприятию и не превращалась в «пиксель монитора» на больших секциях.
 */
export const HAZEGLOW_CELL = {
  /** Фон секции: крупная «печатная» ячейка. */
  section: 20,
  /** Первый экран: самый крупный шаг, растр читается как образ, а не как шум. */
  hero: 24,
  /** Знак ASCII на страницах софта: глиф должен читаться как глиф. */
  ascii: 44,
  /** Статичный кадр при наведении: крупная фактура, не мешающая тексту. */
  hover: 12,
} as const;

/** Вернуть `effectSize` для целевой ячейки в CSS-пикселях. */
export function effectSizeFor(minSideCss: number, targetCss: number): number {
  const side = Math.max(160, Math.min(2048, minSideCss));
  const raw = Math.round((targetCss * 1080) / side);
  return Math.min(64, Math.max(2, raw));
}
