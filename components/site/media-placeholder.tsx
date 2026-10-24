import { BrandMark } from "@/components/site/logo";
import { cn } from "@/lib/utils";

interface MediaPlaceholderProps {
  className?: string;
  markClassName?: string;
}

/**
 * Neutral media slot used until the studio uploads its own artwork.
 * It intentionally contains no fabricated interface, photography, or glow.
 */
export function MediaPlaceholder({
  className,
  markClassName,
}: MediaPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden bg-muted",
        className,
      )}
    >
      <BrandMark
        className={cn("h-12 w-auto opacity-30", markClassName)}
      />
    </div>
  );
}
