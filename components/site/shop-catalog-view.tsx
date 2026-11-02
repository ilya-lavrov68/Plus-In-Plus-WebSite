"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { AddToCartButton } from "@/components/site/add-to-cart-button";
import block from "@/components/pw/blocks/block-wrapper.module.scss";
import card from "@/components/pw/blocks/square-card.module.scss";

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

/**
 * Каталог магазина в структуре payloadcms.com: шапка страницы в их сетке,
 * товары — их карточками SquareCard, цены и кнопка заказа внизу карточки.
 */
export function ShopCatalogView({ products }: { products: ShopProductCardData[] }) {
  const tShop = useTranslations("shop");
  const tCart = useTranslations("cart");
  const numberLocale = useLocale() === "ru" ? "ru-RU" : "en-GB";

  const header = (
    <div className={block.blockWrapper} style={{ paddingBottom: "3rem" }}>
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        <div className="cols-8 cols-m-8">
          <p className="pl-h6">Plus In Plus</p>
          <h1 className="pl-h1">{products.length === 0 ? tShop("comingSoonTitle") : tShop("pageTitle")}</h1>
          <p>{products.length === 0 ? tShop("comingSoonBody") : tShop("catalogDescription")}</p>
        </div>
      </div>
    </div>
  );

  if (products.length === 0) {
    return (
      <div>
        {header}
        <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
          <div className="cols-12 cols-m-8" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link className="pl-btn" href="/services" style={{ maxWidth: "260px" }}>
              {tCart("browseServices")}
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="pl-btn" href="/" style={{ maxWidth: "260px" }}>
              {tShop("comingSoonBack")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div
        className="grid"
        style={{
          paddingLeft: "var(--gutter-h)",
          paddingRight: "var(--gutter-h)",
          rowGap: "2rem",
          paddingBottom: "var(--block-spacing)",
        }}
      >
        {products.map((product) => (
          <article key={product.id} className={`cols-4 cols-m-4 ${card.card}`}>
            <Link className={card.titleWrapper} href={`/shop/${product.slug}`}>
              <h3 className={card.title}>{product.name}</h3>
            </Link>
            <div className={card.descriptionWrapper}>
              {product.description ? <p>{product.description}</p> : null}
              <span className="pl-h6">{product.price.toLocaleString(numberLocale)} ₽</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
              <span className={card.leader}>{product.category ?? "Plus In Plus"}</span>
              <AddToCartButton
                itemType="product"
                itemId={product.id}
                itemName={product.name}
                size="sm"
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
