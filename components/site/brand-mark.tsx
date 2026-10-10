import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

/**
 * Shared Plus In Plus wordmark used wherever the full logo is needed.
 * Backed by the real SVG brand asset through <Logo /> (no inline text
 * placeholders). Kept for backwards compatibility with older call sites.
 */
export function BrandMark({ className, iconClassName, textClassName }: BrandMarkProps) {
  return (
    <Logo
      variant="header"
      className={cn("text-[1.1rem]", textClassName, className)}
      iconClassName={cn("h-8 w-8", iconClassName)}
    />
  );
}
