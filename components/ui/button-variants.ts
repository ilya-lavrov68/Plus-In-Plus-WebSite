import { cva, type VariantProps } from "class-variance-authority";

/**
 * Формы кнопок повторяют структуру payloadcms.com: мягкие pill-кнопки,
 * hairline-обводка и жёлтая заливка только у главного действия.
 *
 * Основное действие — жёлтый pill с тёмным текстом и короткой сменой тона
 * на hover. Вторичное — прозрачный pill с обводкой, без заливки в покое.
 * Тени не используются: границу и фон задаёт тема.
 */

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-[-0.01em] transition-[background-color,color,border-color,outline-color] duration-150 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
        primary:
          "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
        cta: "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        secondary:
          "border border-border bg-transparent text-foreground hover:border-foreground/35 hover:bg-white/[0.05]",
        outline:
          "border border-foreground/35 bg-transparent text-foreground hover:border-foreground/60 hover:bg-white/[0.06]",
        ghost:
          "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-7 text-sm",
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
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium tracking-[-0.01em] transition-[background-color,color,border-color,outline-color] duration-150 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground/35 hover:bg-white/[0.05]",
        primary:
          "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type HeaderButtonVariantProps = VariantProps<typeof headerButtonVariants>;
