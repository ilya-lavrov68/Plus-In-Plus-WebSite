import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { HoverGlow } from "@/components/site/hover-glow";
import { getRequestTranslations } from "@/lib/server-i18n";

interface DirectionRowProps {
  href: string;
  index: string;
  title: string;
  status: string;
  description: string;
  meta: string;
  linkLabel: string;
  accent?: boolean;
}

/**
 * Строка направления: номер, название, одна фраза и что входит.
 *
 * Раньше это были две одинаковые карточки с медиа-полосой и текстурой
 * hazeglow — самый заметный признак шаблонного лендинга. Теперь это список:
 * типографика держит иерархию, а свечение появляется только под курсором.
 */
function DirectionRow({
  href,
  index,
  title,
  status,
  description,
  meta,
  linkLabel,
  accent = false,
}: DirectionRowProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 overflow-hidden py-8 transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-baseline sm:gap-10 sm:py-10"
    >
      <HoverGlow pattern={`direction:${href}`} intensity={0.5} />

      <div className="flex items-baseline gap-4 sm:w-56 sm:shrink-0 sm:flex-col sm:gap-2">
        <span className="font-mono text-xs text-muted-foreground">{index}</span>
        <span className="text-sm text-muted-foreground">{status}</span>
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <h3 className="text-2xl font-medium tracking-tight md:text-3xl">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-[1.75] text-muted-foreground md:text-base">
          {description}
        </p>
        <p className="mt-4 text-xs tracking-[0.04em] text-foreground/60">{meta}</p>
      </div>

      <span
        className={
          accent
            ? "relative z-10 inline-flex items-center gap-2 self-start text-sm font-medium text-signal sm:self-center"
            : "relative z-10 inline-flex items-center gap-2 self-start text-sm font-medium text-foreground sm:self-center"
        }
      >
        {linkLabel}
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </span>
    </Link>
  );
}

/**
 * Два направления бренда: дизайн-практика и собственный продукт.
 *
 * Секция сознательно без карточек: две строки с разделителем и общим
 * заголовком читаются как редакционный разворот, а не как прайс-лист.
 */
export async function BrandDirections() {
  const t = await getRequestTranslations("directions");

  return (
    <section id="directions" className="bg-background section-y">
      <div className="container">
        <div data-reveal="" className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
          <div>
            <h2 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl md:text-5xl">
              {t("heading")}
            </h2>
          </div>
          <p className="max-w-xl text-base leading-[1.8] text-muted-foreground lg:pt-2">
            {t("description")}
          </p>
        </div>

        <div data-reveal="" data-reveal-delay={80} className="mt-12 divide-y divide-white/[0.08]">
          <DirectionRow
            href="/services"
            index={t("design.index")}
            title={t("design.title")}
            status={t("design.status")}
            description={t("design.description")}
            meta={t("design.meta")}
            linkLabel={t("design.link")}
          />
          <DirectionRow
            href="/line-launcher"
            index={t("product.index")}
            title={t("product.title")}
            status={t("product.status")}
            description={t("product.description")}
            meta={t("product.meta")}
            linkLabel={t("product.link")}
            accent
          />
        </div>
      </div>
    </section>
  );
}
