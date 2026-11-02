import { cva, type VariantProps } from "class-variance-authority";

/**
 * Геометрия кнопок бренда Plus In Plus.
 *
 * Основные действия — строго прямоугольные (rounded-none), с сигнальной
 * periwinkle-заливкой и тёмным текстом. Светлый сигнальный круг при точном
 * hover растёт из точки входа указателя через общий .pip-cursor-fill controller.
 *
 * Вторичные действия — pill (rounded-full) с прозрачным фоном и hairline-обводкой:
 * пустая поверхность, граница и текст, без заливки в покое.
 *
 * Список данных (size) радиусы не задаёт, чтобы не перебивать форму варианта.
 */

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium tracking-[-0.01em] transition-[background-color,color,border-color,outline-color] duration-200 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "pip-cursor-fill border border-signal-strong/40 bg-primary text-primary-foreground",
        primary: "pip-cursor-fill border border-signal-strong/40 bg-primary text-primary-foreground",
        cta: "pip-cursor-fill border border-signal-strong/40 bg-primary text-primary-foreground",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        secondary:
          "rounded-full border border-foreground/20 bg-transparent text-foreground/80 hover:border-foreground/40 hover:bg-white/[0.06] hover:text-foreground",
        outline:
          "rounded-full border border-foreground/40 bg-transparent text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary",
        ghost:
          "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
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
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm font-medium tracking-[-0.01em] transition-[background-color,color,border-color,outline-color] duration-200 ease-out focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline:
          "rounded-full border border-foreground/20 bg-transparent text-foreground/80 hover:border-foreground/40 hover:bg-white/[0.06] hover:text-foreground",
        primary:
          "pip-cursor-fill rounded-none border border-signal-strong/40 bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type HeaderButtonVariantProps = VariantProps<typeof headerButtonVariants>;
