"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type LogoVariant = "header" | "partners" | "footer";

export interface LogoProps {
  /** Which brand lockup to render. */
  variant?: LogoVariant;
  /** Extra classes for the image element. */
  className?: string;
}

/**
 * Brand logo renderer. Uses ONLY the customer-provided brand assets from
 * /public/assets/logos (never re-drawn or generated markup):
 *
 * - plus-in-plus.svg   (230×59): standalone lockup — green plus + wordmark.
 *   Used for "header" and "footer" (note: the wordmark is dark navy #052B42,
 *   so place it on light backgrounds).
 * - pip-ts-connect.svg (683×83): combined "Plus In Plus | TS CONNECT" lockup.
 */
export function Logo({ variant = "header", className }: LogoProps) {
  const t = useTranslations("common");
  if (variant === "partners") {
    return (
      <Image
        src="/assets/logos/pip-ts-connect.svg"
        alt={t("partnersLogoAlt")}
        width={683}
        height={83}
        className={cn("h-auto w-auto max-w-full", className)}
      />
    );
  }

  return (
    <Image
      src="/assets/logos/plus-in-plus.svg"
      alt="Plus In Plus"
      width={230}
      height={59}
      className={cn("h-auto w-auto", className)}
    />
  );
}
