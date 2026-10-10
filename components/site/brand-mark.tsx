import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

/**
 * Shared Plus In Plus wordmark used wherever the full logo is needed.
 * Renders the customer-provided SVG lockup through <Logo /> — no re-drawn
 * markup. Kept for backwards compatibility with older call sites.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return <Logo variant="header" className={cn("h-8 w-auto", className)} />;
}
