/**
 * Пересчёт размера ячейки Hazeglow в CSS-пиксели.
 *
 * Библиотека рисует в backing-store с учётом `devicePixelRatio`, поэтому ячейка
 * в экранных пикселях остаётся той же: `cell_css = effectSize × min(css-сторона) / 1080`.
 * Считаем `effectSize` от измеренной стороны, чтобы ячейка была одинаковой по
 * восприятию и не превращалась в «пиксель монитора» на больших секциях.
 */
export const HAZEGLOW_CELL = {
  /**
   * Фон секции. 4 px — масштаб авторского градиента владельца: его палитра
   * рассчитана на мелкую сетку, где однобитный dither усредняется в свет.
   */
  section: 4,
  /** Первый экран: тот же масштаб, что и у остальных секций. */
  hero: 4,
  /** Знак ASCII на страницах софта: глиф должен читаться как глиф. */
  ascii: 44,
  /** Статичный кадр при наведении: та же сетка, что и в фоне. */
  hover: 4,
} as const;

/** Вернуть `effectSize` для целевой ячейки в CSS-пикселях. */
export function effectSizeFor(minSideCss: number, targetCss: number): number {
  const side = Math.max(160, Math.min(2048, minSideCss));
  const raw = Math.round((targetCss * 1080) / side);
  return Math.min(64, Math.max(2, raw));
}
