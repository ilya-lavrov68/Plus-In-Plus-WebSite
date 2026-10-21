"use client";

import { cn } from "@/lib/utils";

export type LogoVariant = "header" | "partners" | "footer" | "mark";

export interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

/**
 * Знаковый логотип (lnpip.svg, 54×42) — строго сам фирменный знак без каких-либо
 * видимых текстовых приписок.
 */
export function BrandMark({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center justify-center">
      <img
        src="/assets/logos/lnpip.svg"
        alt={label ?? "Plus In Plus"}
        width={54}
        height={42}
        className={cn(
          "block h-7 w-auto shrink-0 select-none object-contain",
          className
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/**
 * Знако-письменный логотип (npip.svg, 189×42) — знак + надпись отрисованы
 * внутри самого SVG-файла (без обычного текста рядом).
 */
export function WordmarkLogo({ className }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <img
        src="/assets/logos/npip.svg"
        alt="Plus In Plus"
        width={189}
        height={42}
        className={cn(
          "block h-7 w-auto shrink-0 select-none object-contain",
          className
        )}
      />
      <span className="sr-only">Plus In Plus</span>
    </span>
  );
}

export const HeaderWordmarkLogo = WordmarkLogo;

/**
 * Официальный векторный логотип партнёра TS Connect (ts-connect.svg, 495×84)
 * без обычного текста рядом.
 */
export function TsConnectLogo({
  src = "/assets/logos/ts-connect.svg",
  className,
}: {
  src?: string;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center justify-center">
      <img
        src={src}
        alt="TS Connect"
        width={495}
        height={84}
        className={cn(
          "block h-8 w-auto shrink-0 select-none object-contain",
          className
        )}
      />
      <span className="sr-only">TS Connect</span>
    </span>
  );
}

export function Logo({ variant = "header", className }: LogoProps) {
  if (variant === "mark") {
    return <BrandMark className={className} />;
  }

  if (variant === "partners") {
    return (
      <div className={cn("inline-flex flex-wrap items-center gap-6", className)}>
        <BrandMark className="h-9" label="Plus In Plus" />
        <TsConnectLogo className="h-8" />
      </div>
    );
  }

  return <WordmarkLogo className={className} />;
}
