import * as React from "react";
import Link from "next/link";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const headerButtonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 font-body text-sm font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline: "border border-navy bg-transparent text-navy hover:bg-navy/[0.05]",
        primary: "bg-navy text-white hover:bg-navy/90",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface HeaderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof headerButtonVariants> {}

const HeaderButton = React.forwardRef<HTMLButtonElement, HeaderButtonProps>(
  ({ className, variant, type = "button", ...props }, ref) => (
    <button
      className={cn(headerButtonVariants({ variant }), className)}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);
HeaderButton.displayName = "HeaderButton";

/** Link counterpart for header controls that should retain native navigation semantics. */
export interface HeaderButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof headerButtonVariants> {
  href: string;
}

const HeaderButtonLink = React.forwardRef<HTMLAnchorElement, HeaderButtonLinkProps>(
  ({ className, variant, href, ...props }, ref) => (
    <Link
      href={href}
      className={cn(headerButtonVariants({ variant }), className)}
      ref={ref}
      {...props}
    />
  ),
);
HeaderButtonLink.displayName = "HeaderButtonLink";

export { HeaderButton, HeaderButtonLink, headerButtonVariants };
