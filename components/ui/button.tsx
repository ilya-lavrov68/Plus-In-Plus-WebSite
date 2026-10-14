"use client";

import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { LoadingButton } from "@/components/spectrumui/ui/loading-button";
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
 * The brand variant table below replaces Spectrum's stock (grey) palette
 * wholesale. Because `cn()` runs tailwind-merge with the brand classes last,
 * every conflicting Spectrum default (bg-primary, rounded-md, h-10…) is dropped
 * rather than fighting for specificity.
 */
const buttonVariants = cva(
  // `py-0` is here only to cancel the `py-2` baked into Spectrum's default size
  // variant. Every brand size sets an explicit height, so vertical padding is
  // inert — this keeps the tailwind-merge result free of stray Spectrum classes.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl py-0 font-body text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#052B42] text-white hover:bg-[#153c5c]",
        primary: "bg-[#052B42] text-white hover:bg-[#153c5c]",
        /** Green hero/order CTA — the one place green is a button fill. */
        cta: "bg-[#00C56D] text-[#052B42] hover:bg-[#00B361]",
        outline:
          "border border-[#052B42] bg-transparent text-[#052B42] hover:bg-navy/[0.06]",
        ghost: "bg-transparent text-[#052B42] hover:bg-navy/[0.06]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-[#052B42] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 rounded-xl",
        sm: "h-9 px-4 rounded-lg",
        lg: "h-12 px-8 rounded-xl",
        icon: "h-11 w-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
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

export { Button, buttonVariants };
