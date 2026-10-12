"use client";

import Link from "next/link";
import {
  Building2,
  Flag,
  Home,
  Image as ImageIcon,
  Megaphone,
  RectangleHorizontal,
  ShoppingBag,
  Store,
} from "lucide-react";

import { useTranslations } from "next-intl";

import {
  navigationDescription,
  navigationLabel,
} from "@/components/site/nav-dropdown";
import { DropdownFeatured, type FeaturedPostData } from "@/components/site/dropdown-featured";

export interface DropdownShopProps {
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onLinkClick?: () => void;
  featuredPost?: FeaturedPostData | null;
}

const SMALL_DESIGNS_ITEMS = [
  { key: "signDesign", href: "/shop#small-designs", icon: Store },
  { key: "bagDesign", href: "/shop#small-designs", icon: ShoppingBag },
  { key: "outdoorGlassPoster", href: "/shop#small-designs", icon: ImageIcon },
  { key: "bannerDesign", href: "/shop#small-designs", icon: Flag },
];

const LARGE_DESIGNS_ITEMS = [
  { key: "largeBillboard", href: "/shop#large-designs", icon: Building2 },
  { key: "rooftopAdvertising", href: "/shop#large-designs", icon: Home },
  { key: "advertisementOnTheFence", href: "/shop#large-designs", icon: RectangleHorizontal },
  { key: "billboard", href: "/shop#large-designs", icon: Megaphone },
];

export function DropdownShop({
  id = "shop",
  onMouseEnter,
  onMouseLeave,
  onLinkClick,
  featuredPost,
}: DropdownShopProps) {
  const t = useTranslations("nav");
  const th = useTranslations("header");
  return (
    <div
      id={`navigation-dropdown-${id}`}
      role="region"
      aria-label={t("aria", { section: th("shop") })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute left-1/2 top-[calc(100%+0.75rem)] z-30 w-[min(1120px,calc(100vw-1rem))] min-w-[700px] -translate-x-1/2 animate-dropdown-in"
    >
      <div className="grid max-h-[min(78vh,720px)] grid-cols-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl md:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <section aria-labelledby="shop-section-small">
              <h2
                id="shop-section-small"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                {t("sections.smallDesigns")}
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SMALL_DESIGNS_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={navigationLabel(t, item)}
                      href={item.href}
                      onClick={onLinkClick}
                      className="group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00C56D] text-[#052B42]"
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 text-[#052B42]" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">
                          {navigationLabel(t, item)}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
                          {navigationDescription(t, item)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="shop-section-large">
              <h2
                id="shop-section-large"
                className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
              >
                {t("sections.largeDesigns")}
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {LARGE_DESIGNS_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={navigationLabel(t, item)}
                      href={item.href}
                      onClick={onLinkClick}
                      className="group flex min-w-0 items-start gap-3 rounded-xl p-3 text-left transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00C56D] text-[#052B42]"
                      >
                        <Icon aria-hidden="true" className="h-4 w-4 text-[#052B42]" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5 text-navy group-hover:text-[#0A4366]">
                          {navigationLabel(t, item)}
                        </span>
                        <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-gray-500">
                          {navigationDescription(t, item)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <DropdownFeatured featuredPost={featuredPost} onLinkClick={onLinkClick} />
      </div>
    </div>
  );
}
