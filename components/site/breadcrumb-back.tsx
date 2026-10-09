import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface BreadcrumbBackProps {
  href: string;
  label: string;
  className?: string;
}

/** "‹ Back" breadcrumb link used at the top of detail pages. */
export function BreadcrumbBack({ href, label, className }: BreadcrumbBackProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm text-xl font-semibold transition-colors duration-200 ease-out hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      {label}
    </Link>
  );
}
