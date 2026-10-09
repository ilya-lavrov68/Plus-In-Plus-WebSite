import Image from "next/image";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CategoryCardProps = { title: string } & (
  | { icon: LucideIcon; imageSrc?: never }
  | { imageSrc: string; icon?: never }
);

/** Static presentation only, for the landing page's navy category section. */
export function CategoryCard({ title, icon: Icon, imageSrc }: CategoryCardProps) {
  return (
    <Card className="h-full rounded-none border-white/20 bg-transparent text-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {Icon ? (
          <Icon className="h-16 w-16" strokeWidth={1.25} aria-hidden="true" />
        ) : imageSrc ? (
          <div className="relative aspect-[4/3]">
            <Image src={imageSrc} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-contain" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
