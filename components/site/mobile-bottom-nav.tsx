"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  cartCount: number;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onNavigate: () => void;
}

type MobileNavigationIcon = "home" | "services" | "cart";

interface MobileNavigationItem {
  href: string;
  label: MobileNavigationIcon;
}

/**
 * Корзина и заказы объединены на /cart, поэтому отдельной вкладки «Заказы»
 * в мобильной навигации нет: все отправленные заявки видны под корзиной.
 */
const ITEMS: MobileNavigationItem[] = [
  { href: "/", label: "home" },
  { href: "/services", label: "services" },
  { href: "/cart", label: "cart" },
];

function normalizePathname(pathname: string) {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  const withoutLocale = pathOnly.replace(/^\/(?:en|ru)(?=\/|$)/, "");
  const withoutTrailingSlash = withoutLocale.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

export function isMobileNavigationActive(pathname: string, href: string) {
  const current = normalizePathname(pathname);

  if (href === "/services") {
    return current === "/services" || current.startsWith("/services/");
  }

  if (href === "/") return current === "/";
  return current === href || current.startsWith(`${href}/`);
}

function MobileNavIcon({
  name,
  active,
}: {
  name: MobileNavigationIcon;
  active: boolean;
}) {
  const paths = {
    home: (
      <>
        <path
          pathLength={1}
          className="mobile-nav-animate-stroke"
          d="m3 11 9-8 9 8"
        />
        <path d="M5 10v10h14V10" />
        <path
          className="mobile-nav-animate-bottom mobile-nav-delay-1"
          d="M9 20v-6h6v6"
        />
      </>
    ),
    services: (
      <>
        <rect className="mobile-nav-animate-bottom"x="3"y="3"width="7"height="7"rx="1" />
        <rect className="mobile-nav-animate-bottom mobile-nav-delay-1"x="14"y="3"width="7"height="7"rx="1" />
        <rect className="mobile-nav-animate-bottom mobile-nav-delay-2"x="14"y="14"width="7"height="7"rx="1" />
        <rect className="mobile-nav-animate-bottom mobile-nav-delay-3"x="3"y="14"width="7"height="7"rx="1" />
      </>
    ),
    cart: (
      <>
        <path
          pathLength={1}
          className="mobile-nav-animate-stroke"
          d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L21 7H5.12"
        />
        <circle className="mobile-nav-animate-bottom mobile-nav-delay-2"cx="8"cy="21"r="1" />
        <circle className="mobile-nav-animate-bottom mobile-nav-delay-3"cx="19"cy="21"r="1" />
      </>
    ),
  }[name];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-icon={name}
      className={cn("mobile-nav-icon size-5", active && "is-active")}
    >
      {paths}
    </svg>
  );
}

function MobileMenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      data-icon="menu"
      className={cn(
        "mobile-nav-icon mobile-nav-menu-icon size-5",
        open && "is-open"
      )}
    >
      <path className="mobile-nav-menu-line mobile-nav-menu-top"d="M4 6h16" />
      <path className="mobile-nav-menu-line mobile-nav-menu-middle"d="M4 12h16" />
      <path className="mobile-nav-menu-line mobile-nav-menu-bottom"d="M4 18h16" />
    </svg>
  );
}

const itemClassName =
  "group flex h-full min-h-14 min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] leading-none font-medium transition-colors duration-200 ease-out active:bg-accent/70 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

export function MobileBottomNav({
  cartCount,
  menuOpen,
  onMenuToggle,
  onNavigate,
}: MobileBottomNavProps) {
  const pathname = usePathname() || "/";
  const t = useTranslations("mobileNav");
  const tCart = useTranslations("cart");
  const tc = useTranslations("common");

  return (
    <nav
      aria-label={t("label")}
      data-testid="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-50 bg-background/90 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-2xl lg:hidden"
    >
      <div className="mx-auto grid h-[var(--mobile-bottom-nav-height)] max-w-xl grid-cols-4 items-stretch gap-1 px-2">
        {ITEMS.map((item) => {
          const active = isMobileNavigationActive(pathname, item.href);
          const count = item.href === "/cart" ? cartCount : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={count > 0 ? tCart("openWithCount", { count }) : undefined}
              onClick={onNavigate}
              className={cn(
                itemClassName,
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ease-out motion-reduce:transition-none",
                  active
                    ? "text-signal"
                    : "group-hover:bg-accent group-hover:text-foreground"
                )}
              >
                <MobileNavIcon name={item.label} active={active} />
                {count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] leading-none font-semibold text-destructive-foreground tabular-nums"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{t(item.label)}</span>
            </Link>
          );
        })}

        <button
          id="mobile-menu-trigger"
          type="button"
          aria-label={menuOpen ? tc("closeMenu") : tc("openMenu")}
          aria-controls="mobile-navigation-dialog"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={onMenuToggle}
          className={cn(
            itemClassName,
            menuOpen
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ease-out motion-reduce:transition-none",
              menuOpen
                ? "text-signal"
                : "group-hover:bg-accent group-hover:text-foreground"
            )}
          >
            <MobileMenuIcon open={menuOpen} />
          </span>
          <span className="max-w-full truncate">{t("menu")}</span>
        </button>
      </div>
    </nav>
  );
}
