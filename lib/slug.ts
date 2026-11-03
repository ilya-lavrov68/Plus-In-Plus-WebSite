/**
 * URL slugs for content rows.
 *
 * Slugs are stored in the database (Service.slug / Post.slug) and used in public
 * URLs, so they must be stable, ASCII-only and free of characters that need
 * escaping. Russian titles are transliterated to make that possible.
 */

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

export const MAX_SLUG_LENGTH = 120;

export function slugify(value: string, fallback = "item"): string {
  const prepared = value
    .toLowerCase()
    .replace(/[№#]/g, "") // "№" otherwise decomposes into "no" during NFKD
    .replace(/[«»"'"'`]/g, "")
    .replace(/[\u2013\u2014\u2212]/g, " ");

  const transliterated = Array.from(prepared)
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("");

  const slug = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || fallback;
}

/** `base`, `base-2`, `base-3`… — first candidate the caller reports as free. */
export function withNumericSuffix(base: string, index: number): string {
  if (index <= 1) return base.slice(0, MAX_SLUG_LENGTH);
  const suffix = `-${index}`;
  return `${base.slice(0, MAX_SLUG_LENGTH - suffix.length)}${suffix}`;
}

/**
 * Первый свободный слаг: `base`, `base-2`, `base-3`…
 * `isTaken` — проверка занятости в конкретной таблице.
 */
export async function uniqueSlug(
  value: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallbackPrefix: string,
  id: string,
): Promise<string> {
  const root = slugify(value, `${fallbackPrefix}-${id.slice(0, 8)}`);
  for (let index = 1; index <= 50; index += 1) {
    const candidate = withNumericSuffix(root, index);
    if (!(await isTaken(candidate))) return candidate;
  }
  // Пятьдесят одинаковых названий — уже не «поправить слаг»: подмешиваем id,
  // чтобы цикл заведомо закончился.
  return withNumericSuffix(`${root}-${id.slice(0, 8)}`, 1);
}
