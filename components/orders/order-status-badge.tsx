"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Muted status badges for customer & staff order tables, harmonized with the
 * dark Hero 138 neutral palette.
 */
const STATUS_STYLES: Record<string, string> = {
  pending: " bg-amber-500/15 text-amber-200",
  quote_requested: " bg-amber-500/15 text-amber-200",
  negotiating: " bg-amber-500/15 text-amber-200",
  priced: " bg-sky-500/15 text-sky-200",
  awaiting_payment: " bg-sky-500/15 text-sky-200",
  paid: " bg-emerald-500/15 text-emerald-200",
  in_progress: " bg-sky-500/15 text-sky-200",
  completed: " bg-emerald-500/15 text-emerald-200",
  cancelled: " bg-muted text-muted-foreground",
  refunded: " bg-muted text-muted-foreground",
};

const FALLBACK_STYLE = " bg-muted text-muted-foreground";

export interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const t = useTranslations("admin");
  let label: string;
  try {
    label = t(`status_${status}`);
  } catch {
    label = status;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        STATUS_STYLES[status] ?? FALLBACK_STYLE,
        "whitespace-nowrap",
        className
      )}
    >
      {label}
    </Badge>
  );
}
