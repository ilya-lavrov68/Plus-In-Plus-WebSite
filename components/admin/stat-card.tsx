import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** KPI-карточка: значение, подпись и уточнение. Тени не используются. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-brand-signal/60 bg-card" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <CardDescription className="text-[11px] uppercase tracking-[0.16em]">{label}</CardDescription>
        {icon ? (
          <span aria-hidden="true" className="text-muted-foreground">
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
