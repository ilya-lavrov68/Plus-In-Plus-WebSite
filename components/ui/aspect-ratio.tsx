import * as React from "react";

import { cn } from "@/lib/utils";

export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width-to-height ratio, e.g. `16 / 9` or `4 / 3`. Defaults to a square. */
  ratio?: number;
}

/**
 * Drop-in replacement for `@radix-ui/react-aspect-ratio`.
 *
 * The primitive is two divs (a ratio-enforcing box plus an absolutely positioned
 * layer for the content), so it is reproduced with plain CSS `aspect-ratio` here.
 * Keeping it local means one less package to install — a stale `node_modules`
 * can no longer take the whole site down with "Module not found".
 */
const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ children, className, ratio = 1, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative w-full", className)}
      style={{ aspectRatio: ratio, ...style }}
      {...props}
    >
      {/* Content lives outside the flow so it can never stretch the ratio box. */}
      <div className="absolute inset-0">{children}</div>
    </div>
  )
);
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
