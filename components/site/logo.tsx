import Image from "next/image";

import { cn } from "@/lib/utils";

export type LogoVariant = "header" | "partners" | "footer";

export interface LogoProps {
  /** Which brand lockup to render. */
  variant?: LogoVariant;
  /** Extra classes for the root element (the image itself for "partners"). */
  className?: string;
  /** Extra classes for the green plus icon ("header" and "footer" only). */
  iconClassName?: string;
}

/**
 * Brand logo renderer. All variants are backed by real SVG assets in
 * /public/assets/logos (brand files uploaded by the customer) and served
 * through next/image.
 *
 * - header: green plus icon + "Plus In Plus" wordmark (Geist, navy).
 * - partners: the combined "Plus In Plus | TS CONNECT" lockup.
 * - footer: green plus icon + white wordmark for the dark footer.
 */
export function Logo({ variant = "header", className, iconClassName }: LogoProps) {
  if (variant === "partners") {
    return (
      <Image
        src="/assets/logos/pip-ts-connect.svg"
        alt="Plus In Plus and TS Connect"
        width={683}
        height={83}
        className={cn("h-auto w-auto max-w-full", className)}
      />
    );
  }

  const isFooter = variant === "footer";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/assets/logos/plus-icon.svg"
        alt="Plus In Plus"
        width={24}
        height={24}
        className={cn("h-6 w-6 shrink-0", iconClassName)}
      />
      <span
        className={cn(
          "whitespace-nowrap font-geist text-base font-semibold tracking-tight",
          isFooter ? "text-white" : "text-navy"
        )}
      >
        Plus In Plus
      </span>
    </span>
  );
}
