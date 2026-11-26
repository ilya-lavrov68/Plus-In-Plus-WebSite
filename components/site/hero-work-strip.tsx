import Link from "next/link";

import { getRequestLocale } from "@/lib/request-locale";
import { getRequestTranslations } from "@/lib/server-i18n";
import { localizeWorkCases, WORK_CASES } from "@/lib/work-cases";

/**
 * Первый экран показывает реальные работы, а не абстрактную сцену.
 *
 * Три кадра стоят вплотную друг к другу и растворяются в фоне по краям —
 * получается кинематографичная полоса, у которой нет ни рамки, ни карточки.
 * Никаких придуманных интерфейсов: только обложки существующих кейсов.
 */
export async function HeroWorkStrip() {
  const [locale, t] = await Promise.all([
    getRequestLocale(),
    getRequestTranslations("hero"),
  ]);
  const items = localizeWorkCases(WORK_CASES, locale === "ru" ? "ru" : "en").slice(0, 3);

  return (
    <ul className="grid h-[clamp(12rem,22vw,19rem)] w-full grid-cols-1 gap-px sm:grid-cols-3">
      {items.map((item, index) => (
        <li
          key={item.slug}
          className={index === 0 ? "relative min-h-0 overflow-hidden" : "relative hidden min-h-0 overflow-hidden sm:block"}
        >
          <Link
            href={`/work/${item.slug}`}
            className="group block size-full focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <img
              src={item.cover}
              alt={item.coverAlt}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="size-full object-cover object-top opacity-80 brightness-[0.85] transition-[opacity] duration-500 ease-out group-hover:opacity-100 group-hover:brightness-100"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(to_bottom,rgba(17,15,16,0),rgba(17,15,16,0.86))]"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-xs text-foreground/85 sm:p-5">
              <span className="tracking-[0.12em] uppercase">{item.discipline}</span>
              <span className="hidden text-muted-foreground sm:inline">{item.year}</span>
            </span>
          </Link>
        </li>
      ))}
      <li className="sr-only">{t("viewWork")}</li>
    </ul>
  );
}
