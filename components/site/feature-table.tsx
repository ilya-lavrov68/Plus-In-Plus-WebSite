import type { LucideIcon } from "lucide-react";

export interface Feature {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export interface FeatureTableProps {
  features: readonly Feature[];
}

export function FeatureTable({ features }: FeatureTableProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ title, description, icon: Icon }, index) => (
        <div key={`${title}-${index}`} className="border-t border-border py-6">
          <div className="flex items-center gap-3">
            {Icon && <Icon aria-hidden="true" className="h-7 w-7 shrink-0" strokeWidth={1.5} />}
            <dt className="text-lg font-semibold tracking-tight">{title}</dt>
          </div>
          <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
