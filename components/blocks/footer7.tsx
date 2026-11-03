import Link from "next/link";
import { Globe, Mail, Phone, Send, Video } from "lucide-react";

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
  labels?: Record<string, string>;
  socialLinks?: {
    vk?: string;
    telegram?: string;
    youtube?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
}

const DEFAULT_LABELS: Record<string, string> = {
  "ai": "AI", "largeDesigns": "Large designs", "services": "Services", "about": "About", "resources": "Resources", "legal": "Legal", "company": "Company",
  "aboutLinks.howWeWork": "How we work", "aboutLinks.ourPartners": "Our partners", "aboutLinks.studioNews": "Studio news", "aboutLinks.blog": "Blog",
  "companyLinks.account": "Account", "companyLinks.contactUs": "Contact us", "legalLinks.privacyPolicy": "Privacy Policy", "legalLinks.termsOfUse": "Terms of use",
  "orderDesign": "Order a design", "description": "A next-generation design studio packaging ideas into clear, memorable design—from website mockups to signage and outdoor collateral.", "privacyPolicy": "Privacy Policy",
  "servicesLinks.signDesign": "Sign Design", "servicesLinks.bagDesign": "Bag Design", "servicesLinks.websiteDesign": "Website design", "servicesLinks.badgeDesign": "Badge design", "servicesLinks.posterDesign": "Poster design", "servicesLinks.bannerMockupDesign": "Banner mockup design", "servicesLinks.largeBillboard": "Large Billboard", "servicesLinks.rooftopAdvertising": "Rooftop advertising", "auth.register": "Register",
};

const Footer7 = ({
  services = STUDIO_SERVICES,
  labels = {},
  socialLinks = {},
  contactEmail,
  contactPhone,
}: Footer7Props) => {
  const t = (key: string) => labels[key] ?? DEFAULT_LABELS[key] ?? key;
  const serviceNames: Record<string, string> = {
    "sign-design": t("servicesLinks.signDesign"),
    "bag-design": t("servicesLinks.bagDesign"),
    "website-design": t("servicesLinks.websiteDesign"),
    "badge-design": t("servicesLinks.badgeDesign"),
    "poster-design": t("servicesLinks.posterDesign"),
    "outdoor-glass-poster": t("servicesLinks.posterDesign"),
    "banner-design": t("servicesLinks.bannerMockupDesign"),
    "large-billboard": t("servicesLinks.largeBillboard"),
    "large-billboard-building": t("servicesLinks.largeBillboard"),
    "rooftop-advertising": t("servicesLinks.rooftopAdvertising"),
  };
  const serviceLinks = [
    ...services.slice(0, 4).map((service) => ({
      name: serviceNames[service.slug] ?? service.title,
      href: `/shop/${service.slug}`,
    })),
    { name: t("largeDesigns"), href: "/services" },
  ];

  const socialItems = [
    { label: "VK", href: socialLinks.vk ?? "https://vk.com/plusinplus", icon: Globe },
    { label: "Telegram", href: socialLinks.telegram ?? "https://t.me/plusinplus", icon: Send },
    { label: "YouTube", href: socialLinks.youtube ?? "https://www.youtube.com/@plusinplus", icon: Video },
  ];

  const footerSections: FooterSection[] = [
    {
      title: t("services"),
      links: serviceLinks,
    },
    {
      title: t("about"),
      links: [
        { name: t("aboutLinks.howWeWork"), href: "/#features" },
        { name: t("aboutLinks.ourPartners"), href: "/#community" },
        { name: t("aboutLinks.studioNews"), href: "/#news" },
        { name: t("services"), href: "/services" },
      ],
    },
    {
      title: t("resources"),
      links: [
        { name: t("ai"), href: "/ai" },
        { name: t("aboutLinks.blog"), href: "/blog" },
        { name: t("aboutLinks.studioNews"), href: "/blog" },
        { name: t("companyLinks.account"), href: "/login" },
        { name: t("auth.register"), href: "/signup" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { name: t("legalLinks.privacyPolicy"), href: "/privacy" },
        { name: t("legalLinks.termsOfUse"), href: "/terms" },
      ],
    },
    {
      title: t("company"),
      links: [
        { name: t("companyLinks.contactUs"), href: "/contact" },
        { name: t("orderDesign"), href: "/contact" },
        { name: t("companyLinks.account"), href: "/cart" },
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
              className="inline-flex w-fit items-center transition-opacity duration-200 hover:opacity-80 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <WordmarkLogo className="h-7" />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("description")}
            </p>
            {contactEmail || contactPhone ? (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {contactEmail ? (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="inline-flex items-center gap-2 transition-colors duration-200 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{contactEmail}</span>
                  </a>
                ) : null}
                {contactPhone ? (
                  <a
                    href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}
                    className="inline-flex items-center gap-2 transition-colors duration-200 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{contactPhone}</span>
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              {socialItems.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-200 hover:border-foreground/25 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </a>
              ))}
            </div>
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
                        className="transition-colors duration-200 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
              className="transition-colors duration-200 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("privacyPolicy")}
            </Link>
            <Link
              href="/contact"
              className="transition-colors duration-200 hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("companyLinks.contactUs")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export { Footer7 };
