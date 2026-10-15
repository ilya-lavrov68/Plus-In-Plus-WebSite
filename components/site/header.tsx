"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import {
  ANNOUNCEMENT_BAR_HEIGHT,
  ANNOUNCEMENT_DISMISSED_KEY,
  ANNOUNCEMENT_VISIBILITY_EVENT,
} from "@/components/site/announcement-bar";
import { AccountModal } from "@/components/site/account-modal";
import { CartButton } from "@/components/site/cart-button";
import { DropdownForPlay } from "@/components/site/dropdown-forplay";
import { DropdownShop } from "@/components/site/dropdown-shop";
import { DropdownAbout } from "@/components/site/dropdown-about";
import { DropdownSocnet } from "@/components/site/dropdown-socnet";
import type { FeaturedPostData } from "@/components/site/dropdown-featured";
import {
  NAVIGATION_ITEMS,
  getNavigationSection,
  NavigationMenuEntry,
} from "@/components/site/nav-dropdown";
import { UserAvatar } from "@/components/site/user-avatar";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { Logo } from "@/components/site/logo";
import { HeaderButton, HeaderButtonLink } from "@/components/ui/header-button";
import { cn } from "@/lib/utils";

function isAnnouncementDismissed() {
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function BrandWordmark() {
  const t = useTranslations("header");
  return (
    <Link
      href="/"
      aria-label={t("home")}
      className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
    >
      <Logo variant="header" className="h-9 w-auto sm:h-[42px]" />
    </Link>
  );
}

export function Header() {
  const { data: session, status } = useSession();
  const t = useTranslations("header");
  const tc = useTranslations("common");
  const tnav = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [pageScrollY, setPageScrollY] = useState(0);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [featuredPost, setFeaturedPost] = useState<FeaturedPostData | null>(null);
  const dropdownCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDropdownCloseTimeout = () => {
    if (dropdownCloseTimeout.current !== null) {
      clearTimeout(dropdownCloseTimeout.current);
      dropdownCloseTimeout.current = null;
    }
  };

  const activateDropdown = (id: string) => {
    clearDropdownCloseTimeout();
    setActiveDropdown(id);
  };

  const scheduleDropdownClose = () => {
    clearDropdownCloseTimeout();
    dropdownCloseTimeout.current = setTimeout(() => {
      setActiveDropdown(null);
      dropdownCloseTimeout.current = null;
    }, 150);
  };

  useEffect(() => {
    fetch("/api/featured-post")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.post) setFeaturedPost(data.post);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const update = () => {
      const scrollY = window.scrollY;
      setPageScrollY(scrollY);
      setScrolled(scrollY > 50);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const syncAnnouncementVisibility = (event?: Event) => {
      const detail = (event as CustomEvent<{ visible?: boolean }> | undefined)?.detail;
      setAnnouncementVisible(
        typeof detail?.visible === "boolean" ? detail.visible : !isAnnouncementDismissed(),
      );
    };

    syncAnnouncementVisibility();
    window.addEventListener(ANNOUNCEMENT_VISIBILITY_EVENT, syncAnnouncementVisibility);
    return () => window.removeEventListener(ANNOUNCEMENT_VISIBILITY_EVENT, syncAnnouncementVisibility);
  }, []);

  useEffect(() => {
    return () => clearDropdownCloseTimeout();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktopMedia = window.matchMedia("(min-width: 768px)");
    const closeMenuOnDesktop = () => {
      if (desktopMedia.matches) {
        setMobileOpen(false);
        setMobileAccordion(null);
      }
    };
    desktopMedia.addEventListener("change", closeMenuOnDesktop);
    return () => desktopMedia.removeEventListener("change", closeMenuOnDesktop);
  }, []);

  // Keep the page behind the full-screen mobile menu from scrolling.
  useEffect(() => {
    if (!mobileOpen || typeof document === "undefined" || !document.body) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  // Open the auth modal when the admin guard redirects here with ?auth=login.
  useEffect(() => {
    if (typeof window === "undefined" || !window.location) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "login") {
      setAuthOpen(true);
      params.delete("auth");
      const query = params.toString();
      const cleaned = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
      window.history.replaceState(null, "", cleaned);
    }
  }, []);

  const openLogin = () => {
    setMobileOpen(false);
    setAuthOpen(true);
  };
  const closeMobileMenu = () => {
    setMobileOpen(false);
    setMobileAccordion(null);
  };

  const headerTop = announcementVisible
    ? Math.max(0, ANNOUNCEMENT_BAR_HEIGHT - pageScrollY)
    : 0;

  return (
    <header
      className={cn(
        "site-header fixed inset-x-0 z-40 h-16 w-full border-b transition-[top,background-color,border-color,backdrop-filter,box-shadow] duration-250 ease-out",
        scrolled ? "site-header--glass" : "border-transparent bg-transparent",
      )}
      style={{ top: `${headerTop}px` }}
    >
      <div className="relative mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 xl:px-12">
        <BrandWordmark />

        <nav
          aria-label={tc("mainNavigation")}
          className="absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0 md:flex"
          onMouseEnter={clearDropdownCloseTimeout}
          onMouseLeave={scheduleDropdownClose}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              scheduleDropdownClose();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              clearDropdownCloseTimeout();
              setActiveDropdown(null);
            }
          }}
        >
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = activeDropdown === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-haspopup="true"
                aria-expanded={isActive}
                aria-controls={`navigation-dropdown-${item.id}`}
                onMouseEnter={() => activateDropdown(item.id)}
                onFocus={() => activateDropdown(item.id)}
                className={cn(
                  "relative inline-flex items-center gap-1 rounded-lg px-1 py-2 font-body text-sm font-medium uppercase tracking-wide text-navy transition-colors duration-200 ease-out hover:bg-navy/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy lg:px-2.5 xl:px-3",
                  isActive && "bg-white/70",
                )}
              >
                {t(item.labelKey)}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={2}
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out",
                    isActive && "rotate-180",
                  )}
                />
              </button>
            );
          })}

          {activeDropdown === "forplay" || activeDropdown === "for-play" ? (
            <DropdownForPlay
              id={activeDropdown}
              onMouseEnter={clearDropdownCloseTimeout}
              onMouseLeave={scheduleDropdownClose}
              featuredPost={featuredPost}
            />
          ) : activeDropdown === "shop" ? (
            <DropdownShop
              id={activeDropdown}
              onMouseEnter={clearDropdownCloseTimeout}
              onMouseLeave={scheduleDropdownClose}
              featuredPost={featuredPost}
            />
          ) : activeDropdown === "about" || activeDropdown === "about-pip" ? (
            <DropdownAbout
              id={activeDropdown}
              onMouseEnter={clearDropdownCloseTimeout}
              onMouseLeave={scheduleDropdownClose}
              featuredPost={featuredPost}
            />
          ) : activeDropdown === "socnet" ? (
            <DropdownSocnet
              id={activeDropdown}
              onMouseEnter={clearDropdownCloseTimeout}
              onMouseLeave={scheduleDropdownClose}
              featuredPost={featuredPost}
            />
          ) : null}
        </nav>

        <div className="relative z-30 flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <HeaderButtonLink
            href="/contact"
            variant="outline"
            className="hidden px-3 md:inline-flex lg:px-5"
          >
            {t("contact")}
          </HeaderButtonLink>
          {/* Корзина живёт в шапке рядом с аватаркой — в одном ряду и по
              одной оси (items-center), а не внутри модального окна. */}
          <CartButton />
          {session?.user ? (
            <button
              id="account-trigger"
              type="button"
              onClick={openLogin}
              aria-label={t("openAccount")}
              aria-haspopup="dialog"
              className="font-medium inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            >
              <UserAvatar user={session.user} size={36} />
            </button>
          ) : (
            <HeaderButton
              id="account-trigger"
              variant="primary"
              type="button"
              onClick={openLogin}
              disabled={status === "loading"}
              aria-label={t("login")}
              aria-haspopup="dialog"
              className="min-w-[5rem] px-3 sm:px-4 lg:px-5"
            >
              {status === "loading" ? tc("loading") : t("login")}
            </HeaderButton>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? tc("closeMenu") : tc("openMenu")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="font-medium inline-flex h-10 w-10 items-center justify-center rounded-lg text-navy transition-colors duration-200 ease-out hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy md:hidden"
          >
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-navigation"
          className="fixed inset-x-0 bottom-0 z-[60] overflow-y-auto border-t border-gray-100 bg-white font-body shadow-[0_16px_36px_rgba(10,37,64,0.12)] md:hidden"
          style={{ top: `${headerTop + 64}px` }}
        >
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-8 pt-3">
            <nav aria-label={tc("mobileMainNavigation")} className="divide-y divide-gray-100">
              {NAVIGATION_ITEMS.map((item) => {
                const section = getNavigationSection(item.sectionId);
                if (!section) return null;
                const expanded = mobileAccordion === item.id;
                const contentId = `mobile-navigation-section-${item.id}`;

                return (
                  <section key={item.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={contentId}
                      onClick={() => setMobileAccordion(expanded ? null : item.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-4 text-left font-body text-sm font-semibold uppercase tracking-[0.08em] text-navy transition-colors duration-200 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
                    >
                      {t(item.labelKey)}
                      <ChevronDown
                        aria-hidden="true"
                        className={cn("h-4 w-4 shrink-0 transition-transform duration-200 ease-out", expanded && "rotate-180")}
                      />
                    </button>
                    {expanded ? (
                      <div id={contentId} className="pb-4">
                        {section.subsections ? (
                          <div className="space-y-4">
                            {section.subsections.map((sub) => (
                              <div key={sub.titleKey}>
                                <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                                  {tnav(`sections.${sub.titleKey}`)}
                                </h2>
                                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                  {sub.items.map((menuItem) => (
                                    <NavigationMenuEntry
                                      key={menuItem.label}
                                      item={menuItem}
                                      onSelect={closeMobileMenu}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                              {tnav(`sections.${section.titleKey}`)}
                            </h2>
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {section.items.map((menuItem) => (
                                <NavigationMenuEntry
                                  key={menuItem.label}
                                  item={menuItem}
                                  onSelect={closeMobileMenu}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </nav>

            <div className="mt-auto grid grid-cols-2 gap-3 border-t border-gray-100 pt-5">
              <HeaderButtonLink
                href="/contact"
                variant="outline"
                onClick={closeMobileMenu}
                className="h-10 w-full px-4"
              >
                {t("contact")}
              </HeaderButtonLink>
              <HeaderButton
                type="button"
                variant="primary"
                onClick={openLogin}
                disabled={status === "loading"}
                aria-haspopup="dialog"
                className="h-10 w-full px-4"
              >
                {session?.user ? t("yourAccount") : status === "loading" ? tc("loading") : t("login")}
              </HeaderButton>
            </div>
          </div>
        </div>
      ) : null}

      {authOpen ? <AccountModal open={authOpen} onOpenChange={setAuthOpen} /> : null}
    </header>
  );
}
