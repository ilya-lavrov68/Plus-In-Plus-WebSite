import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { Sparkline } from "@/components/admin/charts";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SectionCardMetric {
  label: string;
  value: string;
  /** Направление тренда: вверх, вниз или без изменений. */
  direction: "up" | "down" | "flat";
  /** Изменение в процентах, уже отформатированное. */
  delta: string;
  /** Пояснение к тренду: что именно изменилось. */
  hint: string;
  /** Нижняя строка карточки. */
  footer: string;
  /** Ряд для спарклайна: последние значения метрики. */
  spark?: number[];
}

const TREND_ICONS = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const;

/**
 * Верхний ряд метрик в духе `dashboard-01`: заголовок, крупное значение,
 * бейдж тренда в правом верхнем углу и подпись в футере карточки. Цвет не
 * единственный носитель смысла — направление дублируется иконкой и словом.
 */
export function SectionCards({ cards }: { cards: SectionCardMetric[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => {
        const Icon = TREND_ICONS[card.direction];
        return (
          <Card key={card.label} className="flex flex-col gap-3 bg-surface-container-low p-5">
            <div className="flex items-start justify-between gap-3">
              <CardDescription className="text-[11px] font-medium tracking-[0.14em] text-on-surface-variant uppercase">
                {card.label}
              </CardDescription>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium tabular-nums",
                  card.direction === "up" && "bg-surface-container-highest text-on-surface",
                  card.direction === "down" && "bg-surface-container-high text-on-surface-variant",
                  card.direction === "flat" && "bg-surface-container text-on-surface-variant",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {card.delta}
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <CardTitle className="truncate text-2xl leading-none font-medium tabular-nums text-on-surface">
                {card.value}
              </CardTitle>
              {card.spark ? <Sparkline values={card.spark} /> : null}
            </div>
            <div className="flex flex-col gap-1 text-xs leading-snug">
              <p className="text-on-surface-variant">{card.hint}</p>
              <p className="text-on-surface-variant/80">{card.footer}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
