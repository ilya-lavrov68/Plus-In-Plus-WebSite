import Link from "next/link";

import { WordmarkLogo } from "@/components/site/logo";
import { STUDIO_SERVICES, type CatalogServiceItem } from "@/lib/studio-catalog";

export interface FooterSection {
  title: string;
  links: Array<{
    name: string;
    href: string;
  }>;
}

export interface Footer7Props {
  services?: CatalogServiceItem[];
}

const Footer7 = ({ services = STUDIO_SERVICES }: Footer7Props) => {
  const serviceLinks = [
    ...services.slice(0, 4).map((service) => ({
      name: service.title,
      href: `/shop/${service.slug}`,
    })),
    { name: "Large designs", href: "/shop#large-designs" },
  ];

  const footerSections: FooterSection[] = [
    {
      title: "Services",
      links: serviceLinks,
    },
    {
      title: "About",
      links: [
        { name: "Advantages", href: "/#features" },
        { name: "Partners", href: "/#community" },
        { name: "News", href: "/#news" },
        { name: "All services", href: "/shop" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Blog", href: "/blog" },
        { name: "We're Up and Running", href: "/blog/we-re-up-and-running" },
        { name: "Log in", href: "/login" },
        { name: "Register", href: "/signup" },
      ],
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Confidentiality", href: "/#features" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "Contact us", href: "/contact" },
        { name: "Order a design", href: "/shop" },
        { name: "Client account", href: "/orders" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background py-20">
      <div className="container">
        <div className="flex flex-col justify-between gap-12 lg:flex-row lg:items-start">
          <div className="flex max-w-xs flex-col gap-5">
            <Link
              href="/"
              className="inline-flex w-fit items-center transition-opacity duration-200 hover:opacity-80"
            >
              <WordmarkLogo className="h-7" />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A next-generation design studio packaging ideas into clear,
              memorable design—from website mockups to signage and outdoor
              collateral.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5 lg:gap-12">
            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="mb-4 text-sm font-semibold text-foreground">
                  {section.title}
                </h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="transition-colors duration-200 hover:text-foreground"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground md:flex-row md:items-center">
          <p>© 2026 Plus In Plus</p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="transition-colors duration-200 hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="/contact"
              className="transition-colors duration-200 hover:text-foreground"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export { Footer7 };
