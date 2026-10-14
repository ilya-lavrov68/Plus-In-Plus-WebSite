"use client";

import * as React from "react";
import Link from "next/link";

import { LoadingButton } from "@/components/spectrumui/ui/loading-button";
import {
  headerButtonVariants,
  type HeaderButtonVariantProps,
} from "@/components/ui/button-variants";
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
export interface HeaderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    HeaderButtonVariantProps {
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
    HeaderButtonVariantProps {
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
