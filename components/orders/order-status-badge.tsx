"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Muted status badges for customer & staff order tables, harmonized with the
 * dark Hero 138 neutral palette.
 */
const STATUS_STYLES: Record<string, string> = {
  quote_requested: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  negotiating: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  awaiting_payment: "border-sky-500/35 bg-sky-500/15 text-sky-200",
  paid: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  in_progress: "border-sky-500/35 bg-sky-500/15 text-sky-200",
  completed: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  cancelled: "border-border bg-muted text-muted-foreground",
  refunded: "border-border bg-muted text-muted-foreground",
};

const FALLBACK_STYLE = "border-border bg-muted text-muted-foreground";

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
