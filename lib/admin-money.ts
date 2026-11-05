/**
 * Деньги в админке.
 *
 * В базе суммы заказов, позиций и платежей лежат в копейках — так же их читает
 * публичный сайт через `formatKopecks` (`lib/pricing.ts`). Панель показывает
 * рубли, поэтому перевод из копеек делается ровно один раз, на границе
 * «база → админка», а не в каждом компоненте: иначе цена уезжает в 100 раз.
 */

export const KOPECKS_PER_RUBLE = 100;

/** Копейки → рубли, с округлением до целого рубля. */
export function toRubles(kopecks: number): number {
  if (!Number.isFinite(kopecks)) return 0;
  return Math.round(kopecks / KOPECKS_PER_RUBLE);
}

/** Рубли → копейки: для форм, которые правят цену в рублях. */
export function toKopecks(rubles: number): number {
  if (!Number.isFinite(rubles)) return 0;
  return Math.round(rubles * KOPECKS_PER_RUBLE);
}

/** Форматтер денег админки: рубли, без копеек. */
export function adminMoney(locale: string, currency = "RUB"): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}
