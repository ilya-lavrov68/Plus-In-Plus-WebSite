import { readFileSync } from "node:fs";
import path from "node:path";

import type { ChangelogData } from "@/lib/changelog-format";

export * from "@/lib/changelog-format";

/**
 * История версий Line Launcher.
 *
 * Данные приходят из репозитория продукта: `npm run changelog:sync` читает
 * `CHANGELOG.md`, теги и релизы GitHub и складывает результат в
 * `content/line-launcher-changelog.json`. Ничего не дописываем вручную — если
 * запись появилась на сайте, значит она есть в репозитории.
 */

const DATA_PATH = path.join(process.cwd(), "content", "line-launcher-changelog.json");

let cached: ChangelogData | null | undefined;

/**
 * Читает файл данных один раз за процесс. `null` — файла нет или он битый:
 * страница тогда показывает честное «история ещё не синхронизирована» вместо
 * вымышленных версий.
 */
export function getChangelog(): ChangelogData | null {
  if (cached !== undefined) return cached;

  try {
    const parsed = JSON.parse(readFileSync(DATA_PATH, "utf8")) as ChangelogData;
    if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
      cached = null;
      return cached;
    }
    cached = parsed;
    return cached;
  } catch {
    cached = null;
    return cached;
  }
}
