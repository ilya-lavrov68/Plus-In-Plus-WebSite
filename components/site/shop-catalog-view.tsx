"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { AddToCartButton } from "@/components/site/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ShopProductCardData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  coverImage: string | null;
  category: string | null;
  stock: number;
}

export function ShopCatalogView({
  products,
}: {
  products: ShopProductCardData[];
}) {
  const tShop = useTranslations("shop");
  const tCart = useTranslations("cart");

  if (products.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {tShop("comingSoonTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
            {tShop("comingSoonBody")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/services">{tCart("browseServices")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">{tShop("comingSoonBack")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-24 md:py-32">
      <div className="border-b border-border/60 pb-10">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Shop
        </h1>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <Card
            key={product.id}
            className="flex h-full flex-col justify-between overflow-hidden border-border bg-card"
          >
            <div>
              {product.coverImage ? (
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted/50">
                  <img
                    src={product.coverImage}
                    alt={product.name}
                    className="size-full object-contain p-2"
                  />
                </div>
              ) : null}

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-snug">
                    {product.name}
                  </CardTitle>
                  {product.category ? (
                    <Badge variant="secondary" className="shrink-0">
                      {product.category}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
            </div>

            <CardContent className="flex flex-1 flex-col justify-between pt-0">
              {product.description ? (
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              ) : (
                <div className="mb-5" />
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="text-lg font-bold tabular-nums">
                  {product.price.toLocaleString("ru-RU")} ₽
                </div>
                <AddToCartButton
                  itemType="product"
                  itemId={product.id}
                  itemName={product.name}
                  size="sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
