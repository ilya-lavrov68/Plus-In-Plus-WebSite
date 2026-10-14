"use client";

import * as React from "react";

import { Spinner as SpectrumSpinner } from "@/components/spectrumui/ui/spinner";
import { cn } from "@/lib/utils";

export type SpinnerSize = "small" | "medium" | "large";

export interface SpinnerProps {
  /** Render nothing when false — handy for "loading" flags. */
  show?: boolean;
  size?: SpinnerSize;
  /** Optional caption rendered under the spinner. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Brand spinner, backed by Spectrum UI's Spinner.
 *
 * `text-primary` in Spectrum's source resolves to the near-black token; the
 * brand navy is applied here so the spinner matches every other focus/active
 * surface on the site.
 */
function Spinner({ show = true, size = "medium", children, className }: SpinnerProps) {
  return (
    <SpectrumSpinner
      show={show}
      size={size}
      className={cn("text-[#052B42]", className)}
    >
      {children}
    </SpectrumSpinner>
  );
}

export { Spinner };
