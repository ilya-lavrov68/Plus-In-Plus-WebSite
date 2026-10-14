"use client";

import * as React from "react";
import Link from "next/link";

import { cva, type VariantProps } from "class-variance-authority";

import { LoadingButton } from "@/components/spectrumui/ui/loading-button";
import { cn } from "@/lib/utils";

/**
 * Header pills: the one place the brand uses fully rounded buttons. Kept
 * separate from `components/ui/button.tsx` (always rounded-xl) so the two
 * shapes can never drift into each other.
 *
 * Both variants now render through Spectrum UI's LoadingButton, which brings
 * `loading` and `asChild` to the header as well. The brand classes are merged
 * last, so Spectrum's stock palette never reaches the screen.
 */
const headerButtonVariants = cva(
  // `py-0` cancels the `py-2` in Spectrum's default size variant; the height is
  // fixed at h-9, so vertical padding is inert and would just be a stray class.
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-0 font-body text-sm font-medium transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",
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
  }
);

export interface HeaderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof headerButtonVariants> {
  /** Shows a spinner and blocks interaction. From Spectrum UI's LoadingButton. */
  loading?: boolean;
}

const HeaderButton = React.forwardRef<HTMLButtonElement, HeaderButtonProps>(
  ({ className, variant, type = "button", loading, ...props }, ref) => (
    <LoadingButton
      ref={ref}
      type={type}
      loading={loading}
      className={cn(headerButtonVariants({ variant }), className)}
      {...props}
    />
  )
);
HeaderButton.displayName = "HeaderButton";

/** Link counterpart for header controls that should retain native navigation semantics. */
export interface HeaderButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "type">,
    VariantProps<typeof headerButtonVariants> {
  href: string;
}

const HeaderButtonLink = React.forwardRef<HTMLAnchorElement, HeaderButtonLinkProps>(
  ({ className, variant, href, children, ...props }, ref) => (
    <LoadingButton
      // Render the anchor itself: `asChild` keeps real link semantics, so
      // middle-click and open-in-new-tab still work.
      asChild
      className={cn(headerButtonVariants({ variant }), className)}
    >
      <Link ref={ref} href={href} {...props}>
        {children}
      </Link>
    </LoadingButton>
  )
);
HeaderButtonLink.displayName = "HeaderButtonLink";

export { HeaderButton, HeaderButtonLink, headerButtonVariants };
