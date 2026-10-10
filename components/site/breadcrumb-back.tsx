import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
        buttonVariants({ variant: "default" }),
        "shrink-0",
        className
      )}
    >
      <ChevronLeft aria-hidden="true" className="h-5 w-5" />
      {label}
    </Link>
  );
}
