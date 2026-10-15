"use client";

import * as React from "react";

import { LoadingButton } from "@/components/spectrumui/ui/loading-button";
import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Brand buttons: soft squares ("squircle" — rounded-lg/rounded-xl, never
 * rounded-full) in the navy brand palette, set in the Google Sans Flex
 * body font.
 *
 * Built on Spectrum UI's LoadingButton, which contributes two things the old
 * shadcn button did not have:
 *
 *   - `loading`  — renders a spinner, blocks the click and disables the button
 *   - `asChild`  — renders as the child element (e.g. a Link) via Radix Slot
 *
 * The brand variant table lives in `button-variants.ts` (no "use client") so
 * that Server Components can call `buttonVariants()` too. It replaces
 * Spectrum's stock (grey) palette wholesale. Because `cn()` runs tailwind-merge
 * with the brand classes last, every conflicting Spectrum default
 * (bg-primary, rounded-md, h-10…) is dropped rather than fighting for
 * specificity.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  /** Shows a spinner and blocks interaction. From Spectrum UI's LoadingButton. */
  loading?: boolean;
  /** Render as the single child element instead of a <button>. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      type = "button",
      loading,
      asChild,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <LoadingButton
        ref={ref}
        // Brand classes go through `cn` last, so they overwrite Spectrum's
        // stock cva output instead of merging with it.
        className={cn(buttonVariants({ variant, size, className }))}
        type={type}
        loading={loading}
        asChild={asChild}
        {...props}
      >
        {children}
      </LoadingButton>
    );
  }
);
Button.displayName = "Button";

// Re-exported so existing `@/components/ui/button` imports keep working.
export { Button, buttonVariants };
export type { ButtonVariantProps };
