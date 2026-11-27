"use client";

import { Hazeglow, type GradientConfig } from "hazeglow";
import { useEffect, useRef, useState } from "react";

import { effectSizeFor, HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { cn } from "@/lib/utils";

/**
 * Фоновый шейдер секции.
 *
 * Правила проекта (`project-design-system` §2):
 * - эффект живёт под контентом, с маской по краям, без резких границ;
 * - ячейка крупная: 16–24 CSS px, а не «пиксель монитора»;
 * - оранжевый — последняя ступень палитры, поэтому работает акцентом;
 * - на страницах софта и ИТ-продуктов эффект `ascii`, на остальном сайте —
 *   `dither`; на одной странице один эффект.
 */
type SectionGlowVariant = "dither" | "ascii";

const PALETTE = [
  "#110f10",
  "#151313",
  "#1b1819",
  "#242122",
  "#2b292a",
  "#ff5f01",
];

function buildConfig(
  variant: SectionGlowVariant,
  effectSize: number,
): GradientConfig {
  const ascii = variant === "ascii";
  return {
    version: 1,
    seed: ascii ? 61 : 47,
    shape: ascii ? "blob" : "pill",
    center: [0.74, 0.5],
    size: ascii ? [0.95, 0.95] : [0.8, 0.85],
    roundness: 0.9,
    softness: 0.7,
    rotation: 24,
    rampDirection: 0.9,
    angle: 108,
    warp: 0.04,
    warpScale: 1.3,
    palette: PALETTE,
    background: "#110f10",
    mesh: [],
    grain: 0.04,
    motion: "drift",
    speed: 0.08,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: ascii ? "ascii" : "dither",
    effectSize,
    effectAmount: ascii ? 0.55 : 0.9,
  };
}

interface SectionGlowProps {
  className?: string;
  variant?: SectionGlowVariant;
  /** Ячейка в CSS-пикселях: по умолчанию крупная печатная. */
  cell?: number;
  /** Прозрачность слоя: чем плотнее текст над ним, тем тише фон. */
  intensity?: number;
}

export function SectionGlow({
  className,
  variant = "dither",
  cell = HAZEGLOW_CELL.section,
  intensity = 0.85,
}: SectionGlowProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [effectSize, setEffectSize] = useState(() => effectSizeFor(720, cell));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const minSide = Math.min(rect.width, rect.height) || 720;
      setEffectSize(effectSizeFor(minSide, cell));
      host.style.setProperty("--pip-glow-cell", `${cell}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [cell]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      style={{ opacity: intensity }}
    >
      <div
        className="size-full"
        style={{
          maskImage:
            "radial-gradient(95% 120% at 72% 50%, #000 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.3) 70%, transparent 92%)",
          WebkitMaskImage:
            "radial-gradient(95% 120% at 72% 50%, #000 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.3) 70%, transparent 92%)",
        }}
      >
        <Hazeglow
          config={buildConfig(variant, effectSize)}
          className="size-full"
        />
      </div>
    </div>
  );
}
