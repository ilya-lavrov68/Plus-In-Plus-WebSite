import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center px-6 py-16 text-center">
      <Icon
        aria-hidden="true"
        className="mb-4 h-8 w-8 text-muted-foreground"
        strokeWidth={1.5}
      />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
