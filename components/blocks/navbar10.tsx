"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Globe,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Paintbrush,
  Send,
  Sparkles,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  Fragment,
  type MouseEventHandler,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LazyAccountModal,
  preloadAccountModal,
} from "@/components/site/lazy-account-modal";
import { CartIcon, useCartCount } from "@/components/site/cart-icon";
import { MediaPlaceholder } from "@/components/site/media-placeholder";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { MobileBottomNav } from "@/components/site/mobile-bottom-nav";
import { HeaderWordmarkLogo } from "@/components/site/logo";
import { UserAvatar } from "@/components/site/user-avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export interface MenuLink {
  label?: string;
  description?: string;
  url: string;
  external?: boolean;
  icon?: LucideIcon;
  image?: string;
  background?: string;
}

export interface MenuGroup {
  title: string;
  links: MenuLink[];
}

export interface MenuItem {
  id?: number;
  title: string;
  url?: string;
  links?: MenuLink[];
  featuredLinks?: MenuLink[];
  imageLink?: MenuLink;
  groupLinks?: MenuGroup[];
}

// Раздел SHOP скрыт из навигации, поэтому услуги (services) шапке больше не
// нужны: пропс оставлен исторически и игнорируется.
export interface Navbar10Props {
  services?: unknown[];
  featuredPost?: { title: string; slug: string; coverImage: string } | null;
}

type DesktopMenuItemProps = {
  item: MenuItem;
  index: number;
};

interface MobileNavigationMenuProps {
  open: boolean;
  navigation: MenuItem[];
  onClose: () => void;
  contactLabel: string;
  loginLabel: string;
  profileLabel: string;
  accountLabel: string;
  onOpenAccount: () => void;
  cartLabel: string;
  adminLabel: string;
  dashboardHref: string | null;
  signedIn: boolean;
  menuLabel: string;
  closeLabel: string;
}

type NavLinkProps = {
  link: MenuLink;
  onClick?: () => void;
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: MouseEventHandler<HTMLAnchorElement>;
};

export function buildNavigation(featuredPost?: Navbar10Props["featuredPost"]): MenuItem[] {
  // Раздел SHOP временно скрыт из навигации до появления мерча. Прямые ссылки
  // на страницы услуг (/shop/[slug]) продолжают работать — заявки создаются
  // через них, а /shop показывает заглушку «Shop is coming soon».
  const featuredPostUrl = featuredPost?.slug
    ? `/blog/${encodeURIComponent(featuredPost.slug)}`
    : "/blog";

  return [
    {
      title: "AI",
      id: 4,
      url: "/ai",
    },
    {
      title: "FOR PLAY",
      id: 1,
      links: [
        {
          label: "Order a design",
          icon: Paintbrush,
          description: "Get a tailored design crafted around your brand idea",
          url: "/contact",
        },
        {
          label: "Design services",
          icon: Layers,
          description: "Explore small and large format visual solutions",
          url: "/services",
        },
        {
          label: "Plus For Play",
          icon: Sparkles,
          description: "Interactive ecosystem and creative studio experiments",
          url: "/#community",
        },
        {
          label: "Ozone project",
          icon: Compass,
          description: "Product thinking tested across live digital systems",
          url: "/#features",
        },
      ],
    },
    {
      title: "ABOUT PIP",
      id: 3,
      imageLink: {
        url: featuredPostUrl,
        ...(featuredPost?.coverImage
          ? { image: featuredPost.coverImage }
          : {}),
        label: featuredPost?.title || "Blog",
      },
      groupLinks: [
        {
          title: "Studio",
          links: [
            {
              label: "How we work",
              icon: Sparkles,
              description: "Confidential, individualized studio process",
              url: "/#features",
            },
            {
              label: "Our partners",
              icon: Users,
              description: "Collaboration with TS Connect in Tambov",
              url: "/#community",
            },
            {
              label: "Studio news",
              icon: BookOpen,
              description: "Latest updates from Plus In Plus",
              url: "/#news",
            },
          ],
        },
        {
          title: "Journal",
          links: [
            {
              label: "Blog",
              icon: BookOpen,
              description: "Articles, studio notes, and visual design stories",
              url: "/blog",
            },
            ...(featuredPost
              ? [
                  {
                    label: featuredPost.title,
                    icon: Compass,
                    description: "Latest updates from Plus In Plus",
                    url: featuredPostUrl,
                  },
                ]
              : []),
            {
              label: "Contact us",
              icon: MessageSquare,
              description: "Discuss your project with the Plus In Plus team",
              url: "/contact",
            },
          ],
        },
      ],
    },
    {
      title: "SOCNET",
      id: 2,
      featuredLinks: [
        {
          label: "Telegram Channel",
          icon: Send,
          description:
            "Studio releases, mockups, and behind-the-scenes updates",
          url: "https://t.me/plusinplus",
          external: true,
        },
        {
          label: "VK Community",
          icon: Globe,
          description:
            "Case studies, client stories, and community discussions",
          url: "https://vk.com/plusinplus",
          external: true,
        },
      ],
      links: [
        {
          label: "YouTube",
          icon: Video,
          description: "Watch design breakdowns and studio reels",
          url: "https://www.youtube.com/@plusinplus",
          external: true,
        },
        {
          label: "Blog",
          icon: BookOpen,
          description: "Long-form studio essays and announcements",
          url: "/blog",
        },
        {
          label: "Contact Studio",
          icon: MessageSquare,
          description: "Send a message directly to our team",
          url: "/contact",
        },
      ],
    },
  ];
}

const MOBILE_BREAKPOINT = 1024;

const Navbar10 = ({ featuredPost }: Navbar10Props = {}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [accountReturnFocusId, setAccountReturnFocusId] = useState("account-trigger");
  const { data: session } = useSession();
  const cartCount = useCartCount();
  const t = useTranslations("header");
  const tc = useTranslations("common");
  const tn = useTranslations("navigation");
  const navigation = useMemo(() => {
    const labels: Record<string, string> = {
      "Order a design": "orderDesign", "Design services": "designServices", "Plus For Play": "plusForPlay", "Ozone project": "ozoneProject",
      "Studio": "studio", "Journal": "journal", "How we work": "howWeWork", "Our partners": "ourPartners", "Studio news": "studioNews",
      "Blog": "blog", "We're Up and Running": "launchStory", "Contact us": "contactUs", "Telegram Channel": "telegramChannel",
      "VK Community": "vkCommunity", "YouTube": "youtube", "Contact Studio": "contactStudio",
    };
    const descriptions: Record<string, string> = {
      "Get a tailored design crafted around your brand idea": "orderDesignDescription",
      "Explore small and large format visual solutions": "designServicesDescription",
      "Interactive ecosystem and creative studio experiments": "plusForPlayDescription",
      "Product thinking tested across live digital systems": "ozoneProjectDescription",
      "Confidential, individualized studio process": "howWeWorkDescription",
      "Collaboration with TS Connect in Tambov": "ourPartnersDescription",
      "Latest updates from Plus In Plus": "studioNewsDescription",
      "Read the launch story behind the new website": "launchStoryDescription",
      "Discuss your project with the Plus In Plus team": "contactUsDescription",
      "Studio releases, mockups, and behind-the-scenes updates": "telegramDescription",
      "Case studies, client stories, and community discussions": "vkDescription",
      "Watch design breakdowns and studio reels": "youtubeDescription",
      "Long-form studio essays and announcements": "blogDescription",
      "Send a message directly to our team": "contactStudioDescription",
    };
    const localizeLink = (link: MenuLink): MenuLink => ({
      ...link,
      label: link.label && labels[link.label] ? tn(labels[link.label]) : link.label,
      description: link.description && descriptions[link.description] ? tn(descriptions[link.description]) : link.description,
    });
    return buildNavigation(featuredPost).map((item) => ({
      ...item,
      title: item.id === 4 ? tn("ai") : item.id === 1 ? t("forPlay") : item.id === 3 ? t("about") : t("socnet"),
      links: item.links?.map(localizeLink),
      featuredLinks: item.featuredLinks?.map(localizeLink),
      imageLink: item.imageLink ? localizeLink(item.imageLink) : undefined,
      groupLinks: item.groupLinks?.map((group) => ({
        ...group,
        title: labels[group.title] ? tn(labels[group.title]) : group.title,
        links: group.links.map(localizeLink),
      })),
    }));
  }, [t, tn, featuredPost]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setOpen(false);
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !document.body) return;
    document.body.style.overflow = open ? "hidden" : "auto";
    return () => {
      if (document.body) document.body.style.overflow = "auto";
    };
  }, [open]);

  const handleMobileMenu = () => {
    setOpen((prev) => !prev);
  };

  const dashboardHref =
    session?.user?.role === "FOUNDER" || session?.user?.role === "ADMIN"
      ? "/admin/dashboard"
      : session?.user?.role === "MANAGER"
        ? "/manager/orders"
        : null;

  return (
    <Fragment>
      <section className="pointer-events-auto fixed top-0 z-50 flex w-full items-center justify-center border-b-0 bg-background/65 backdrop-blur-2xl">
        <NavigationMenu className="h-20 max-w-full after:absolute after:inset-0 after:z-40 after:block after:size-full after:bg-transparent after:content-[''] [&>div:last-child>div]:mt-0 [&>div:last-child>div]:rounded-none [&>div:last-child>div]:border-0 [&>div:last-child>div]:border-b-0">
          <div className="container relative z-50 grid w-full grid-cols-2 items-center justify-between gap-4 lg:grid-cols-3 lg:gap-8">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="inline-flex max-h-9 w-fit items-center transition-opacity duration-200 hover:opacity-85"
            >
              <HeaderWordmarkLogo />
            </Link>

            <div className="hidden justify-self-center lg:flex">
              <NavigationMenuList>
                {navigation.map((item, index) => (
                  <DesktopMenuItem
                    key={`desktop-link-${index}`}
                    item={item}
                    index={index}
                  />
                ))}
              </NavigationMenuList>
            </div>

            <div className="justify-self-end">
              <div className="hidden items-center gap-2.5 lg:flex">
                <LanguageSwitcher />
                {session?.user ? <CartIcon count={cartCount} /> : null}
                <Button variant="outline" size="sm" asChild>
                  <Link href="/contact">{t("contact")}</Link>
                </Button>
                {session?.user ? (
                  <div className="flex items-center gap-2">
                    {dashboardHref && (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={dashboardHref}>
                          <LayoutDashboard className="size-3.5" />
                          {t("admin")}
                        </Link>
                      </Button>
                    )}
                    <button
                      id="account-trigger"
                      type="button"
                      aria-label={t("openAccount")}
                      aria-haspopup="dialog"
                      aria-expanded={accountOpen}
                      onPointerEnter={preloadAccountModal}
                      onFocus={preloadAccountModal}
                      onClick={() => {
                        setAccountReturnFocusId("account-trigger");
                        setAccountOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-border p-0.5 pr-3 text-xs font-medium text-foreground transition-colors duration-200 ease-out hover:border-foreground/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <UserAvatar user={session.user} size={36} />
                      <span className="max-w-24 truncate">
                        {session.user.firstName || session.user.email}
                      </span>
                    </button>
                  </div>
                ) : (
                  <Button size="sm" asChild>
                    <Link href="/login" className="group">
                      {t("login")}
                      <ChevronRight className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center lg:hidden">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </NavigationMenu>
      </section>
      <MobileBottomNav
        cartCount={cartCount}
        menuOpen={open}
        onMenuToggle={handleMobileMenu}
        onNavigate={() => setOpen(false)}
      />
      <MobileNavigationMenu
        open={open}
        navigation={navigation}
        onClose={() => setOpen(false)}
        contactLabel={t("contact")}
        loginLabel={t("login")}
        profileLabel={t("profile")}
        accountLabel={t("account")}
        onOpenAccount={() => {
          setOpen(false);
          setAccountReturnFocusId("mobile-menu-trigger");
          setAccountOpen(true);
        }}
        cartLabel={t("cart")}
        adminLabel={t("admin")}
        dashboardHref={dashboardHref}
        signedIn={Boolean(session?.user)}
        menuLabel={tc("mobileMainNavigation")}
        closeLabel={tc("closeMenu")}
      />
      <LazyAccountModal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        returnFocusId={accountReturnFocusId}
      />
    </Fragment>
  );
};

const DesktopMenuItem = ({ item, index }: DesktopMenuItemProps) => {
  if (item.links || item.featuredLinks || item.groupLinks) {
    return (
      <NavigationMenuItem key={`desktop-menu-item-${index}`} value={`${index}`}>
        <NavigationMenuTrigger className="h-fit bg-transparent font-normal text-foreground/70 hover:text-foreground">
          {item.title}
        </NavigationMenuTrigger>
        <NavigationMenuContent className="hidden !rounded-xl !border-0 !p-0 lg:block">
          <div className="w-dvw animate-[fade-in-slide-down_0.24s_cubic-bezier(0.22,1,0.36,1)_forwards] px-8 pt-6 pb-12">
            <div className="container">
              {item.id === 1 && <DropdownMenu1 links={item.links} />}
              {item.id === 2 && (
                <DropdownMenu2
                  featuredLinks={item.featuredLinks}
                  links={item.links}
                />
              )}
              {item.id === 3 && (
                <DropdownMenu3
                  groupLinks={item.groupLinks}
                  imageLink={item.imageLink}
                />
              )}
            </div>
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem key={`desktop-menu-item-${index}`} value={`${index}`}>
      <NavigationMenuLink
        href={item.url}
        className={`${navigationMenuTriggerStyle()} h-fit bg-transparent font-normal text-foreground/70`}
      >
        {item.title}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const DropdownMenu1 = ({ links }: { links?: MenuLink[] }) => {
  const linksRef = useRef<HTMLAnchorElement[]>([]);
  const imageRefs = useRef<HTMLDivElement[]>([]);

  const updateImageClasses = (activeIndex: number) => {
    imageRefs.current.forEach((img, i) => {
      if (!img) return;
      const isActive = i === activeIndex;

      img.classList.toggle("opacity-100", isActive);
      img.classList.toggle("translate-y-0", isActive);
      img.classList.toggle("opacity-0", !isActive);
      img.classList.toggle("translate-y-12", !isActive);
      img.classList.toggle("z-10", isActive);
    });
  };

  const handleMouseEnter =
    (index: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      linksRef.current.forEach((link) => {
        if (link && link !== event.currentTarget) {
          link.classList.add("opacity-50");
        }
      });

      updateImageClasses(index);
    };

  const handleMouseLeave = () => {
    linksRef.current.forEach((link) => {
      link?.classList.remove("opacity-50");
    });

    updateImageClasses(0);
  };

  if (!links) return null;

  return (
    <div className="grid grid-cols-2 gap-8">
      <ul className="grid grid-cols-2 gap-8">
        {links.map((link, index) => (
          <li key={`default-nav-link-${index}`}>
            <NavLink
              link={link}
              onMouseEnter={handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
              ref={(el) => {
                if (el) linksRef.current[index] = el;
              }}
            />
          </li>
        ))}
      </ul>
      <div className="glass-surface shadow-none relative !h-[16rem] w-full overflow-hidden rounded-2xl bg-white/[0.05]">
        {links.map((link, index) => (
          <div
            key={`default-nav-link-img-${index}`}
            ref={(el) => {
              if (el) imageRefs.current[index] = el;
            }}
            className={`absolute top-12 left-12 aspect-video w-[40rem] overflow-hidden rounded-[1.25rem] transition-[transform,opacity] duration-300 ease-out will-change-[transform,opacity] ${
              index === 0
                ? "z-10 translate-y-0 opacity-100"
                : "pointer-events-none z-0 translate-y-12 opacity-0"
            }`}
          >
            {link.image ? (
              <img
                src={link.image}
                alt={link.label || ""}
                className="size-full object-cover object-left-top"
              />
            ) : (
              <MediaPlaceholder className="size-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const DropdownMenu2 = ({
  links,
  featuredLinks,
}: {
  links?: MenuLink[];
  featuredLinks?: MenuLink[];
}) => {
  return (
    <div>
      <div className="flex gap-8 pb-8">
        {featuredLinks &&
          featuredLinks.map((link, index) => (
            <FeaturedLink key={`desktop-featured-link-${index}`} link={link} />
          ))}
      </div>
      <Separator />
      <div className="grid grid-cols-4 pt-8">
        {links &&
          links.map((link, index) => (
            <NavLink key={`default-nav-link-${index}`} link={link} />
          ))}
      </div>
    </div>
  );
};

const DropdownMenu3 = ({
  groupLinks,
  imageLink,
}: {
  groupLinks?: MenuGroup[];
  imageLink?: MenuLink;
}) => {
  return (
    <div className="grid grid-cols-2 gap-8">
      <GroupLinks groupLinks={groupLinks} />
      <FeaturedImageLink link={imageLink} />
    </div>
  );
};

const GroupLinks = ({ groupLinks }: { groupLinks?: MenuGroup[] }) => {
  const linksRef = useRef<HTMLAnchorElement[]>([]);

  const handleMouseEnter =
    () => (event: React.MouseEvent<HTMLAnchorElement>) => {
      linksRef.current.forEach((link) => {
        if (link && link !== event.currentTarget) {
          link.classList.add("opacity-50");
        }
      });
    };

  const handleMouseLeave = () => {
    linksRef.current.forEach((link) => {
      link?.classList.remove("opacity-50");
    });
  };

  if (!groupLinks) return null;

  let linkIndex = 0;
  return (
    <div className="grid grid-cols-2 gap-8">
      {groupLinks.map((group, index1) => (
        <div key={`group-link-${index1}`}>
          <div className="mb-4 text-xs text-muted-foreground">
            {group.title}
          </div>
          <ul className="flex flex-col gap-6">
            {group.links.map((link, index2) => {
              const index = linkIndex++;
              return (
                <li key={`group-link-${index1}-${index2}`}>
                  <NavLink
                    link={link}
                    onMouseEnter={handleMouseEnter()}
                    onMouseLeave={handleMouseLeave}
                    ref={(el) => {
                      if (el) linksRef.current[index] = el;
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

const FeaturedImageLink = ({ link }: { link?: MenuLink }) => {
  const tAdmin = useTranslations("admin");
  if (!link) return null;

  return (
    <div className="hidden lg:block">
      <Link href={link.url} className="group block w-full max-w-[36.875rem]">
        <AspectRatio
          ratio={1.77245509}
          className="glass-surface shadow-none overflow-hidden rounded-2xl bg-white/[0.05]"
        >
          <div className="size-full">
            <Badge className="absolute top-2 left-2">{tAdmin("new")}</Badge>
            <div className="flex w-full flex-col items-center justify-center gap-6 pt-8">
              <div className="text-2xl font-semibold">{link.label}</div>
              <div className="w-[80%]">
                <AspectRatio
                  ratio={1.5}
                  className="overflow-hidden rounded-xl bg-slate-950/25"
                >
                  {link.image ? (
                    <img
                      src={link.image}
                      alt={link.label || ""}
                      className="size-full object-contain"
                    />
                  ) : (
                    <MediaPlaceholder className="size-full" />
                  )}
                </AspectRatio>
              </div>
            </div>
          </div>
        </AspectRatio>
      </Link>
    </div>
  );
};

const FeaturedLink = ({ link }: { link: MenuLink }) => {
  return (
    <a
      href={link.url}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noopener noreferrer" : undefined}
      className="glass-surface shadow-none group relative flex w-full overflow-hidden rounded-2xl bg-white/[0.055] px-8 py-7"
    >
      <div className="relative z-10 flex w-full items-center gap-6">
        <div className="flex size-12 shrink-0 rounded-lg bg-background">
          {link.icon && (
            <link.icon className="m-auto size-5 stroke-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-lg font-semibold text-white">{link.label}</div>
          <div className="font-medium text-white/80">{link.description}</div>
        </div>
      </div>
      {link.background && (
        <img
          src={link.background}
          alt={link.label || ""}
          className="absolute top-0 left-0 size-full object-cover object-left-top opacity-75 brightness-50 transition-opacity duration-300 ease-out group-hover:opacity-95"
        />
      )}
    </a>
  );
};

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ link, onClick, onMouseEnter, onMouseLeave }, ref) => {
    const inner = (
      <>
        {link.icon && (
          <div className="flex size-6 shrink-0 rounded-md transition-colors duration-200 group-hover/navlink:bg-accent">
            <link.icon className="m-auto size-3.5" />
          </div>
        )}
        <div className="flex flex-col items-start gap-2">
          {link.label && (
            <div className="text-base leading-normal">{link.label}</div>
          )}
          <div className="text-sm leading-normal text-muted-foreground">
            {link.description}
          </div>
        </div>
      </>
    );

    if (link.external) {
      return (
        <a
          ref={ref}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="group/navlink flex w-full gap-2 transition-opacity duration-200"
        >
          {inner}
        </a>
      );
    }

    return (
      <Link
        ref={ref}
        href={link.url}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="group/navlink flex w-full gap-2 transition-opacity duration-200"
      >
        {inner}
      </Link>
    );
  }
);
NavLink.displayName = "NavLink";

const MobileNavigationMenu = ({
  open,
  navigation,
  onClose,
  contactLabel,
  loginLabel,
  profileLabel,
  accountLabel,
  onOpenAccount,
  cartLabel,
  adminLabel,
  dashboardHref,
  signedIn,
  menuLabel,
  closeLabel,
}: MobileNavigationMenuProps) => {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        id="mobile-navigation-dialog"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("mobile-menu-trigger")?.focus({ preventScroll: true });
        }}
        side="top"
        className="inset-0 z-[70] h-dvh w-full overflow-y-auto bg-background p-0 shadow-none [&>button]:hidden"
      >
        <div className="container flex min-h-full flex-col pt-[calc(1rem+env(safe-area-inset-top))] pb-[var(--mobile-bottom-nav-clearance)]">
          <div className="flex h-16 shrink-0 items-center justify-between gap-4">
            <SheetTitle className="text-base font-medium">
              {menuLabel}
            </SheetTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-6 pb-8">
            <Accordion type="multiple" className="w-full">
              {navigation.map((item, index) =>
                renderMobileMenuItem(item, index, onClose)
              )}
            </Accordion>

            <div className="flex flex-col gap-3 [&_a]:min-h-12 [&_button]:min-h-12">
              <Button variant="outline" asChild>
                <Link href="/contact" onClick={onClose}>
                  {contactLabel}
                </Link>
              </Button>
              {signedIn ? (
                <>
                  <Button
                    variant="outline"
                    aria-haspopup="dialog"
                    onClick={onOpenAccount}
                  >
                    {accountLabel}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/profile" onClick={onClose}>
                      {profileLabel}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/cart" onClick={onClose}>
                      {cartLabel}
                    </Link>
                  </Button>
                  {dashboardHref ? (
                    <Button variant="secondary" asChild>
                      <Link href={dashboardHref} onClick={onClose}>
                        {adminLabel}
                      </Link>
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button asChild>
                  <Link href="/login" onClick={onClose}>
                    {loginLabel}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const renderMobileMenuItem = (
  item: MenuItem,
  index: number,
  onClose: () => void
) => {
  if (item.links || item.featuredLinks || item.groupLinks) {
    return (
      <AccordionItem
        key={item.title}
        value={`nav-${index}`}
        className="border-b-0"
      >
        <AccordionTrigger className="min-h-12 items-center text-base font-normal text-foreground hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-6 p-2 [&_a]:min-h-12 [&_a]:rounded-xl [&_a]:p-3 [&_a]:transition-colors [&_a]:active:bg-accent">
          {item.featuredLinks && (
            <div className="flex flex-col gap-2 p-2">
              {item.featuredLinks.map((link, idx) => (
                <NavLink
                  key={`default-nav-link-${idx}`}
                  link={link}
                  onClick={onClose}
                />
              ))}
            </div>
          )}

          {item.links && (
            <div className="flex flex-col gap-2 p-2">
              {item.links.map((link, idx) => (
                <NavLink
                  key={`default-nav-link-${idx}`}
                  link={link}
                  onClick={onClose}
                />
              ))}
            </div>
          )}

          {item.groupLinks && (
            <div className="flex flex-col gap-2 p-2">
              {item.groupLinks.map((group, index1) => (
                <div className="mb-8 last:mb-0" key={`group-link-${index1}`}>
                  <div className="mb-4 text-xs text-muted-foreground">
                    {group.title}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {group.links.map((link, index2) => (
                      <li key={`group-link-${index1}-${index2}`}>
                        <NavLink link={link} onClick={onClose} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <Link
      key={item.title}
      href={item.url || "/"}
      onClick={onClose}
      className="flex min-h-12 items-center rounded-xl px-3 text-left text-base leading-normal font-normal text-foreground transition-colors active:bg-accent"
    >
      {item.title}
    </Link>
  );
};

export { Navbar10 };
