/**
 * Class recipes for the brand buttons — deliberately kept free of `"use client"`.
 *
 * `components/ui/button.tsx` is a Client Component (it renders Spectrum's
 * LoadingButton, which needs a ref and event handlers). Server Components
 * therefore cannot *call* `buttonVariants()` imported from there — React throws
 * "Attempted to call buttonVariants() from the server". Only rendering it as a
 * component is allowed.
 *
 * Several card components are Server Components and only need the class string,
 * not the interactivity: they render a styled `<span>`/`<Link>`. Splitting the
 * recipes into this module (pure, no React, no "use client") lets both worlds
 * share one source of truth for the brand look.
 *
 * `button.tsx` re-exports these, so existing `@/components/ui/button` imports
 * keep working unchanged.
 */
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Soft squares ("squircle") in the navy brand palette, Google Sans Flex body
 * font. Never rounded-full — that shape belongs to the header only.
 */
export const buttonVariants = cva(
  // `py-0` cancels the `py-2` baked into Spectrum's default size variant. Every
  // brand size sets an explicit height, so vertical padding is inert; this keeps
  // the tailwind-merge result free of stray Spectrum classes.
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

/**
 * Header pills — the one place the brand uses fully rounded buttons. Kept
 * separate from `buttonVariants` (always rounded-xl) so the two shapes can
 * never drift into each other.
 */
export const headerButtonVariants = cva(
  // `py-0` cancels the `py-2` in Spectrum's default size variant; the height is
  // fixed at h-9, so vertical padding is inert.
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

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type HeaderButtonVariantProps = VariantProps<typeof headerButtonVariants>;
