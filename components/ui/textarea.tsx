"use client";

import * as React from "react";

import { AutosizeTextarea } from "@/components/spectrumui/ui/autosize-textarea";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * The heights the shadcn textarea produced, so the autosize version starts at
 * exactly the same size. `rows={2}` and `rows={3}` both fell under the old
 * `min-h-[80px]` floor and rendered at 80px; taller `rows` values won.
 *
 *   2 →  58px → floored to 80px
 *   3 →  78px → floored to 80px
 *   4 →  98px
 *   6 → 138px
 */
const MIN_HEIGHT = 80;
const ROW_HEIGHT = 20;
const VERTICAL_PADDING = 18;

function minHeightForRows(rows: number | undefined): number {
  if (!rows || rows <= 1) return MIN_HEIGHT;
  return Math.max(MIN_HEIGHT, rows * ROW_HEIGHT + VERTICAL_PADDING);
}

/**
 * Brand textarea, now backed by Spectrum UI's AutosizeTextarea: the field grows
 * with its content instead of scrolling inside a fixed box. Same border, radius,
 * type scale and focus ring as before, and the initial height still comes from
 * `rows` so every existing form looks identical on first paint.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows, style, ...props }, ref) => {
    const minHeight = minHeightForRows(rows);
    return (
      <AutosizeTextarea
        // Spectrum exposes a composite ref ({ textArea, minHeight, maxHeight });
        // bridge it back so callers still get the real <textarea>.
        ref={(instance) => {
          const element = instance?.textArea ?? null;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        minHeight={minHeight}
        // Spectrum only applies the height in an effect, which would let the
        // field paint at the browser default first and then jump. Seeding
        // min-height inline makes the first paint correct.
        style={{ minHeight, ...style }}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-[height] duration-200 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
