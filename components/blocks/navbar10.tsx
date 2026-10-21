"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Building2,
  ChevronRight,
  Compass,
  Frame,
  Globe,
  Layers,
  LayoutDashboard,
  MenuIcon,
  MessageSquare,
  Paintbrush,
  Send,
  ShoppingBag,
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

import { CartButton } from "@/components/site/cart-button";
import { LanguageSwitcher } from "@/components/site/language-switcher";
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
import { STUDIO_SERVICES, type CatalogServiceItem } from "@/lib/studio-catalog";

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

export interface Navbar10Props {
  services?: CatalogServiceItem[];
}

type DesktopMenuItemProps = {
  item: MenuItem;
  index: number;
};

interface MobileNavigationMenuProps {
  open: boolean;
  navigation: MenuItem[];
  onClose: () => void;
}

type NavLinkProps = {
  link: MenuLink;
  onClick?: () => void;
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: MouseEventHandler<HTMLAnchorElement>;
};

const SERVICE_ICONS: Record<string, LucideIcon> = {
  "sign-design": Frame,
  "bag-design": ShoppingBag,
  "outdoor-glass-poster": Layers,
  "banner-design": Sparkles,
  "large-billboard": Building2,
  "large-billboard-building": Building2,
  "rooftop-advertising": Globe,
  "advertisement-on-the-fence": Layers,
  billboard: Compass,
};

function buildNavigation(services: CatalogServiceItem[]): MenuItem[] {
  const smallLinks: MenuLink[] = services
    .filter((s) => s.category !== "large")
    .map((service) => ({
      label: service.title,
      icon: SERVICE_ICONS[service.slug] ?? Sparkles,
      description: service.shortDesc,
      url: `/shop/${service.slug}`,
    }));

  const largeLinks: MenuLink[] = services
    .filter((s) => s.category === "large")
    .map((service) => ({
      label: service.title,
      icon: SERVICE_ICONS[service.slug] ?? Building2,
      description: service.shortDesc,
      url: `/shop/${service.slug}`,
    }));

  const featuredShopService = services[0] ?? STUDIO_SERVICES[0];

  return [
    {
      title: "FOR PLAY",
      id: 1,
      links: [
        {
          label: "Order a design",
          icon: Paintbrush,
          description: "Get a tailored design crafted around your brand idea",
          url: "/shop",
          image: "/assets/shop/sign-design.jpg",
        },
        {
          label: "Design services",
          icon: Layers,
          description: "Explore small and large format visual solutions",
          url: "/shop",
          image: "/assets/shop/bag-design.jpg",
        },
        {
          label: "Plus For Play",
          icon: Sparkles,
          description: "Interactive ecosystem and creative studio experiments",
          url: "/#community",
          image: "/assets/shop/outdoor-glass-poster.jpg",
        },
        {
          label: "Ozone project",
          icon: Compass,
          description: "Product thinking tested across live digital systems",
          url: "/#features",
          image: "/assets/shop/banner-design.jpg",
        },
      ],
    },
    {
      title: "SHOP",
      id: 3,
      imageLink: {
        url: `/shop/${featuredShopService.slug}`,
        image: featuredShopService.coverImage,
        label: featuredShopService.title,
      },
      groupLinks: [
        {
          title: "Small designs",
          links: smallLinks,
        },
        {
          title: "Large designs",
          links: largeLinks,
        },
      ],
    },
    {
      title: "ABOUT PIP",
      id: 3,
      imageLink: {
        url: "/blog/we-re-up-and-running",
        image: "/assets/shop/large-billboard-building.jpg",
        label: "We're Up and Running",
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
            {
              label: "We're Up and Running",
              icon: Compass,
              description: "Read the launch story behind the new website",
              url: "/blog/we-re-up-and-running",
            },
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
          background: "/assets/shop/rooftop-advertising.jpg",
          url: "https://t.me/plusinplus",
          external: true,
        },
        {
          label: "VK Community",
          icon: Globe,
          description:
            "Case studies, client stories, and community discussions",
          background: "/assets/shop/banner-design.jpg",
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
          label: "Shop Services",
          icon: ShoppingBag,
          description: "Browse all studio design services",
          url: "/shop",
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

const Navbar10 = ({ services = STUDIO_SERVICES }: Navbar10Props) => {
  const [open, setOpen] = useState<boolean>(false);
  const { data: session } = useSession();
  const navigation = useMemo(() => buildNavigation(services), [services]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) {
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
    session?.user?.role === "ADMIN"
      ? "/admin/dashboard"
      : session?.user?.role === "MANAGER"
        ? "/manager/orders"
        : null;

  return (
    <Fragment>
      <section className="pointer-events-auto fixed top-0 z-50 flex w-full items-center justify-center border-b border-border/60 bg-background/95 backdrop-blur-md">
        <NavigationMenu className="h-20 max-w-full after:absolute after:inset-0 after:z-40 after:block after:size-full after:bg-background/95 after:content-[''] [&>div:last-child>div]:mt-0 [&>div:last-child>div]:rounded-none [&>div:last-child>div]:border-0 [&>div:last-child>div]:border-b">
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
                <CartButton />
                <Button variant="outline" size="sm" asChild>
                  <Link href="/contact">Contact</Link>
                </Button>
                {session?.user ? (
                  <div className="flex items-center gap-2">
                    {dashboardHref && (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={dashboardHref}>
                          <LayoutDashboard className="size-3.5" />
                          Panel
                        </Link>
                      </Button>
                    )}
                    <Link
                      href="/orders"
                      aria-label="Account"
                      className="inline-flex items-center gap-2 rounded-full border border-border p-0.5 pr-3 text-xs font-medium text-foreground transition-colors duration-200 ease-out hover:border-foreground/25 hover:bg-white/[0.06]"
                    >
                      <UserAvatar user={session.user} size={36} />
                      <span className="max-w-24 truncate">
                        {session.user.firstName || session.user.email}
                      </span>
                    </Link>
                  </div>
                ) : (
                  <Button size="sm" asChild>
                    <Link href="/login" className="group">
                      Log in
                      <ChevronRight className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1 lg:hidden">
                <LanguageSwitcher />
                <Button
                  className="size-11"
                  variant="ghost"
                  size="icon"
                  aria-label={open ? "Close menu" : "Open menu"}
                  onClick={handleMobileMenu}
                >
                  {open ? (
                    <X className="size-5 stroke-foreground" />
                  ) : (
                    <MenuIcon className="size-5 stroke-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </NavigationMenu>
      </section>
      <MobileNavigationMenu
        open={open}
        navigation={navigation}
        onClose={() => setOpen(false)}
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
      <div className="relative !h-[16rem] w-full overflow-hidden rounded-lg bg-muted">
        {links.map((link, index) => (
          <div
            key={`default-nav-link-img-${index}`}
            ref={(el) => {
              if (el) imageRefs.current[index] = el;
            }}
            className={`absolute top-12 left-12 aspect-video w-[40rem] overflow-hidden rounded-tl-md border-t border-l transition-[transform,opacity] duration-300 ease-out will-change-[transform,opacity] ${
              index === 0
                ? "z-10 translate-y-0 opacity-100"
                : "pointer-events-none z-0 translate-y-12 opacity-0"
            }`}
          >
            <img
              src={link.image}
              alt={link.label || ""}
              className="size-full object-cover object-left-top"
            />
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
  if (!link) return null;

  return (
    <div className="hidden lg:block">
      <Link href={link.url} className="group block w-full max-w-[36.875rem]">
        <AspectRatio
          ratio={1.77245509}
          className="overflow-hidden rounded-[0.25rem] bg-muted transition-colors duration-200 group-hover:bg-accent"
        >
          <div className="size-full">
            <Badge className="absolute top-2 left-2">New</Badge>
            <div className="flex w-full flex-col items-center justify-center gap-6 pt-8">
              <div className="text-2xl font-semibold">{link.label}</div>
              <div className="w-[80%]">
                <AspectRatio
                  ratio={1.5}
                  className="overflow-hidden rounded-[0.25rem] bg-muted"
                >
                  <img
                    src={link.image}
                    alt={link.label || ""}
                    className="size-full object-cover object-left-top"
                  />
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
      className="group relative flex w-full overflow-hidden rounded-xl bg-muted px-8 py-7"
    >
      <div className="relative z-10 flex w-full items-center gap-6">
        <div className="flex size-12 shrink-0 rounded-lg border bg-background shadow-lg">
          {link.icon && (
            <link.icon className="m-auto size-5 stroke-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-lg font-semibold text-white">{link.label}</div>
          <div className="font-medium text-white/80">{link.description}</div>
        </div>
      </div>
      <img
        src={link.background}
        alt={link.label || ""}
        className="absolute top-0 left-0 size-full object-cover object-left-top opacity-75 brightness-50 transition-opacity duration-300 ease-out group-hover:opacity-95"
      />
    </a>
  );
};

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ link, onClick, onMouseEnter, onMouseLeave }, ref) => {
    const inner = (
      <>
        {link.icon && (
          <div className="flex size-6 shrink-0 rounded-md border shadow transition-colors duration-200 group-hover/navlink:border-foreground/30 group-hover/navlink:bg-accent">
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
}: MobileNavigationMenuProps) => {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-describedby={undefined}
        side="top"
        className="inset-0 z-40 h-dvh w-full overflow-y-auto bg-background pt-20 [&>button]:hidden"
      >
        <div className="container py-8">
          <div className="sr-only">
            <SheetTitle>Mobile Navigation</SheetTitle>
          </div>
          <div className="flex min-h-full flex-col gap-6">
            <Accordion type="multiple" className="w-full">
              {navigation.map((item, index) =>
                renderMobileMenuItem(item, index, onClose)
              )}
            </Accordion>

            <div className="flex flex-col gap-3">
              <Button variant="outline" asChild>
                <Link href="/contact" onClick={onClose}>
                  Contact
                </Link>
              </Button>
              <Button asChild>
                <Link href="/login" onClick={onClose}>
                  Log in
                </Link>
              </Button>
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
        <AccordionTrigger className="h-[2.5rem] items-center text-base font-normal text-foreground hover:no-underline">
          {item.title}
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-6 p-2">
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
      className="flex h-[2.5rem] items-center rounded-md text-left text-base leading-[3.75] font-normal text-foreground transition-colors"
    >
      {item.title}
    </Link>
  );
};

export { Navbar10 };
