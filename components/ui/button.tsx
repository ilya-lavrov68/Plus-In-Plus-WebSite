import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Brand buttons: soft squares ("squircle" — rounded-lg/rounded-xl, never
 * rounded-full) in the navy brand palette, set in the Google Sans Flex
 * body font.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-body text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-white hover:bg-[#153c5c]",
        primary: "bg-navy text-white hover:bg-[#153c5c]",
        outline:
          "border border-navy bg-transparent text-navy hover:bg-navy/[0.06]",
        ghost: "bg-transparent text-navy hover:bg-navy/[0.06]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-navy underline-offset-4 hover:underline",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
