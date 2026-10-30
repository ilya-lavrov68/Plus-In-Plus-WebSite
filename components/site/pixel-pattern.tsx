import { cn } from "@/lib/utils";

interface PixelPatternProps {
  variant?: "ai" | "design";
  className?: string;
}

const SIGNALS = {
  ai: new Set([7, 8, 15, 22, 29, 30, 36, 37, 38, 43, 50, 57, 58, 65, 66, 73, 74]),
  design: new Set([8, 16, 24, 25, 26, 32, 34, 40, 41, 42, 48, 50, 56, 58, 66, 74]),
} as const;

/**
 * Детерминированный пиксельный мотив бренда без случайных значений,
 * внешних изображений и непрерывной декоративной анимации.
 */
export function PixelPattern({ variant = "ai", className }: PixelPatternProps) {
  const signal = SIGNALS[variant];
  const cells = Array.from({ length: 96 }, (_, index) => index);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 192 144"
      preserveAspectRatio="xMidYMid slice"
      className={cn("text-primary", className)}
    >
      {cells.map((index) => {
        const column = index % 12;
        const row = Math.floor(index / 12);
        const active = signal.has(index);
        return (
          <rect
            key={index}
            x={column * 16 + 5}
            y={row * 16 + 5}
            width={active ? 7 : 3}
            height={active ? 7 : 3}
            fill="currentColor"
            opacity={active ? 0.9 : 0.13}
          />
        );
      })}
    </svg>
  );
}
