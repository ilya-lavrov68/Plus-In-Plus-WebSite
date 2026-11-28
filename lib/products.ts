/**
 * Реестр продуктов студии.
 *
 * Один продукт — одна запись. Пункт «Продукты» в шапке собирается из этого
 * списка, поэтому новый продукт появляется в навигации добавлением записи, а
 * не правкой шапки. Разметка та же, что у каталога продуктов JetBrains: имя,
 * версия и одна строка о назначении.
 */
export interface ProductEntry {
  /** Адрес страницы продукта. */
  href: string;
  /** Имя, одинаковое во всех локалях. */
  name: string;
  /** Версия или статус рядом с именем. */
  badge?: string;
  /** Одна строка о назначении продукта. */
  tagline: Record<"ru" | "en", string>;
}

export const PRODUCTS: ProductEntry[] = [
  {
    href: "/line-launcher",
    name: "Line Launcher",
    badge: "0.15.4",
    tagline: {
      ru: "Игрок входит по одному провайдеру и не настраивает серверы вручную.",
      en: "One provider, one launcher — no manual server setup.",
    },
  },
];

export function productTagline(entry: ProductEntry, locale: string): string {
  return entry.tagline[locale === "en" ? "en" : "ru"];
}
