import Link from "next/link";

import { Separator } from "@/components/ui/separator";

const columns = [
  [
    { label: "Servers", href: "/servers" },
    { label: "Socnet", href: "/socnet" },
    { label: "About PIP", href: "/about" },
  ],
  [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "User Agreement", href: "/user-agreement" },
    { label: "Offer", href: "/offer" },
  ],
  [
    { label: "Account", href: "/account" },
    { label: "Collaboration", href: "/collaboration" },
    { label: "Partners", href: "/partners" },
  ],
];

export function Footer() {
  return (
    <footer className="mt-auto bg-background">
      <Separator />
      <nav aria-label="Footer navigation" className="mx-auto grid max-w-7xl grid-cols-3 gap-4 px-4 py-12 sm:gap-8 sm:px-8">
        {columns.map((column, index) => (
          <ul key={index} className="space-y-4">
            {column.map(({ label, href }) => (
              <li key={label}>
                <Link href={href} className="rounded-sm text-sm transition-colors duration-200 ease-out hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </nav>
    </footer>
  );
}
