import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { STUDIO_SERVICES, type CatalogServiceItem } from "@/lib/studio-catalog";

export interface ProductDetail1Props {
  service?: CatalogServiceItem;
  configuratorSlot?: ReactNode;
}

const ProductDetail1 = ({
  service = STUDIO_SERVICES[0],
  configuratorSlot,
}: ProductDetail1Props) => {
  const gallery =
    service.gallery && service.gallery.length > 0
      ? service.gallery
      : [service.coverImage];
  const [primaryImage, ...secondaryImages] = gallery;
  const categoryLabel =
    service.category === "large" ? "Large designs" : "Small designs";

  return (
    <section className="py-24 md:py-32">
      <div className="container">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="space-y-4 lg:col-span-6">
            {primaryImage && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <AspectRatio ratio={4 / 3}>
                  <img
                    src={primaryImage}
                    alt={service.title}
                    className="size-full object-contain"
                  />
                </AspectRatio>
              </div>
            )}

            {secondaryImages.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {secondaryImages.map((imageSrc, idx) => (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-border bg-card"
                  >
                    <AspectRatio ratio={4 / 3}>
                      <img
                        src={imageSrc}
                        alt={`${service.title} showcase ${idx + 2}`}
                        className="size-full object-contain"
                      />
                    </AspectRatio>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col lg:col-span-6">
            <Badge variant="outline" className="w-fit rounded-full px-3.5 py-1">
              {categoryLabel}
            </Badge>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
              {service.title}
            </h1>

            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {service.fullDesc}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="sm:px-10" asChild>
                <Link href={`/contact?service=${service.slug}`}>Order</Link>
              </Button>
            </div>

            {configuratorSlot && <div className="mt-8">{configuratorSlot}</div>}

            <Separator className="my-10" />

            <dl className="space-y-10">
              <div>
                <dt className="text-xl font-semibold text-foreground">
                  Our service includes
                </dt>
                <dd className="mt-4">
                  <ul className="space-y-3">
                    {service.includes.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                          <Check className="size-3.5" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>

              <Separator />

              <div>
                <dt className="text-xl font-semibold text-foreground">
                  Any shape, any idea
                </dt>
                <dd className="mt-3 space-y-4">
                  {service.shapesIntroduction && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {service.shapesIntroduction}
                    </p>
                  )}
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {service.shapes.map((shape, idx) => (
                      <li
                        key={idx}
                        className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground"
                      >
                        {shape}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>

              <Separator />

              <div className="rounded-xl border border-border bg-card p-6">
                <dt className="text-xl font-semibold text-foreground">
                  The result
                </dt>
                <dd className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {service.resultText}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
};

export { ProductDetail1 };
