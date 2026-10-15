"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Цветные метки статусов заказа.
 *
 * Палитра намеренно не брендовая: зелёный #00C56D и тёмно-синий #052B42
 * зарезервированы за кнопками, и статус в тех же тонах читался бы как
 * призыв нажать. Для меток взяты приглушённые оттенки, чтобы статус
 * считывался как информация, а не как действие.
 */
const STATUS_STYLES: Record<string, string> = {
  // Ждёт действий менеджера — самый заметный.
  quote_requested: "border-amber-300 bg-amber-50 text-amber-900",
  negotiating: "border-amber-300 bg-amber-50 text-amber-900",
  awaiting_payment: "border-sky-300 bg-sky-50 text-sky-900",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-900",
  in_progress: "border-sky-300 bg-sky-50 text-sky-900",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  cancelled: "border-neutral-300 bg-neutral-100 text-neutral-600",
  refunded: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

const FALLBACK_STYLE = "border-neutral-300 bg-neutral-100 text-neutral-600";

export interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const t = useTranslations("admin");
  // Ключ может отсутствовать, если в БД лежит статус, которого нет в каталоге.
  // Показываем сам статус, а не текст ошибки переводчика.
  let label: string;
  try {
    label = t(`status_${status}`);
  } catch {
    label = status;
  }

  return (
    <Badge
      variant="outline"
      className={cn(STATUS_STYLES[status] ?? FALLBACK_STYLE, "whitespace-nowrap", className)}
    >
      {label}
    </Badge>
  );
}
