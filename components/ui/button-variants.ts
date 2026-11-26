import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,border-color,outline-color] duration-200 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /*
         * Главное действие — оранжевая заливка с тёмным текстом (решение
         * владельца: CTA #FF5F01, текст #0E1015, контраст 6.24:1). При
         * наведении заливка темнеет до #E65400 — оттенок не меняется, поэтому
         * реакция читается как отклик на курсор, а не как смена режима.
         */
        default:
          "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
        primary:
          "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
        cta:
          "bg-primary text-primary-foreground hover:bg-brand-signal-strong",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline:
          "bg-transparent text-foreground hover:bg-white/[0.08] hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-white/[0.14] hover:text-foreground",
        /*
         * Вторичное действие — светлая плашка #EEEEEE с тёмным текстом
         * (решение владельца). Наведение только темнит поверхность: оттенок и
         * роль кнопки не меняются.
         */
        neutral:
          "bg-[var(--pip-accent-neutral)] text-[var(--pip-ink-light)] hover:bg-[var(--pip-accent-neutral-strong)]",
        ghost:
          "text-foreground hover:bg-white/[0.07] hover:text-foreground",
        link: "text-signal underline-offset-4 hover:underline",
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
          "bg-transparent text-foreground hover:bg-white/[0.08] hover:text-foreground",
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
