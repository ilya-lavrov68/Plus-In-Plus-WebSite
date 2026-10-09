export interface Feature {
  title: string;
  description: string;
}

export interface FeatureTableProps {
  features: readonly Feature[];
}

export function FeatureTable({ features }: FeatureTableProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ title, description }, index) => (
        <div key={`${title}-${index}`} className="border-t border-border py-6">
          <dt className="text-lg font-semibold tracking-tight">{title}</dt>
          <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
