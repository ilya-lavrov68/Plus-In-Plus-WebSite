import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ServiceCardProps {
  title: string;
  href: string;
  imageSrc: string;
}

export function ServiceCard({ title, href, imageSrc }: ServiceCardProps) {
  return (
    <Link href={href} className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="h-full overflow-hidden">
        <CardContent className="p-0">
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-[filter,opacity] duration-200 ease-out group-hover:grayscale group-hover:opacity-70 group-focus-visible:grayscale group-focus-visible:opacity-70"
            />
          </div>
        </CardContent>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>{title}</CardTitle>
          <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform duration-200 ease-out group-hover:rotate-90 group-focus-visible:rotate-90" />
        </CardHeader>
      </Card>
    </Link>
  );
}
