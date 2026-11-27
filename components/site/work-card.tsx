import Link from "next/link";

import { HoverGlow } from "@/components/site/hover-glow";
import { ArrowUpRight } from "lucide-react";

import type { LocalizedWorkCase } from "@/lib/work-cases";
import { cn } from "@/lib/utils";

interface WorkCardProps {
  item: LocalizedWorkCase;
  openLabel: string;
  featured?: boolean;
  className?: string;
}

/**
 * Карточка работы. Кликабельна целиком и не использует масштабирование при
 * наведении: движение только в стрелке и подложке.
 */
export function WorkCard({ item, openLabel, featured = false, className }: WorkCardProps) {
  return (
    <Link
      href={`/work/${item.slug}`}
      data-reveal=""
      className={cn(
        "group flex h-full flex-col gap-5",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-white/[0.055] p-1.5",
          featured && "p-2",
        )}
      >
        <img
          src={item.cover}
          alt={item.coverAlt}
          loading="lazy"
          decoding="async"
          className={cn(
            "aspect-[16/10] w-full object-cover object-top",
          )}
        />
      </div>

      {/* Подсветка живёт на поверхности карточки: кадр её не получает. */}
      <div className="relative flex flex-1 flex-col gap-3 overflow-hidden px-1 py-1">
        <HoverGlow pattern={`work:${item.slug}`} />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
          <span>{item.discipline}</span>
          <span className="tracking-normal normal-case">{item.year}</span>
        </p>
        <h3
          className={cn(
            "font-medium tracking-tight text-balance",
            featured ? "text-3xl md:text-4xl" : "text-xl md:text-2xl",
          )}
        >
          {item.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {item.summary}
        </p>
        <span className="mt-auto inline-flex items-center gap-2 pt-1 text-sm font-medium text-foreground">
          {openLabel}
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </span>
      </div>
    </Link>
  );
}
