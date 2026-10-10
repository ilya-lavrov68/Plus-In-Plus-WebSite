import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

/** Shared Plus In Plus wordmark used wherever the full logo is needed. */
export function BrandMark({ className, iconClassName, textClassName }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 36 36"
        className={cn("h-8 w-8 shrink-0 text-[#64cb70]", iconClassName)}
        fill="currentColor"
      >
        <path d="M13 2h10v11h11v10H23v11H13V23H2V13h11V2Z" />
      </svg>
      <span className={cn("whitespace-nowrap text-[1.1rem] font-semibold tracking-[-0.045em] text-[#0a2540]", textClassName)}>
        Plus In Plus
      </span>
    </span>
  );
}
