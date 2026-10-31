import { cva, type VariantProps } from "class-variance-authority";

// До жёлтого редизайна эти действия были белыми. Общий класс сохраняет белый
// покой и запускает жёлтую заливку из координат входа указателя (Providers).

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,border-color,outline-color] duration-200 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "pip-cursor-fill bg-white text-[#0a0a0a]",
        primary: "pip-cursor-fill bg-white text-[#0a0a0a]",
        cta: "pip-cursor-fill bg-white text-[#0a0a0a]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground/25 hover:bg-white/[0.06] hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-white/[0.14] hover:text-foreground",
        ghost:
          "text-foreground hover:bg-white/[0.07] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-md px-3.5 text-xs",
        lg: "h-12 rounded-lg px-7 text-sm",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export const headerButtonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-[background-color,color,border-color,outline-color] duration-200 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground/25 hover:bg-white/[0.06] hover:text-foreground",
        primary: "pip-cursor-fill bg-white text-[#0a0a0a]",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type HeaderButtonVariantProps = VariantProps<typeof headerButtonVariants>;
