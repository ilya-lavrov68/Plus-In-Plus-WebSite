"use client";

import { Hazeglow, type GradientConfig } from "hazeglow";
import { useEffect, useRef, useState } from "react";

import { presetConfig, type HazeglowPreset } from "@/lib/hazeglow-presets";
import { effectSizeFor, HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { cn } from "@/lib/utils";

/**
 * Фоновый шейдер секции.
 *
 * Правила проекта (`project-design-system` §2):
 * - эффект живёт под контентом, с маской по краям, без резких границ;
 * - ячейка крупная: 20–24 CSS px, а не «пиксель монитора»;
 * - оранжевый — последняя ступень палитры, поэтому работает акцентом;
 * - на страницах софта и ИТ-продуктов эффект `ascii`, на остальном сайте —
 *   `dither`; на одной странице один эффект.
 */
type SectionGlowVariant = "dither" | "ascii";

/**
 * Ряд из семи ступеней по одной оранжевой оси.
 *
 * Скачок оттенка между ступенями (серый → оранжевый) при крупной ячейке давал
 * фиолетово-бирюзовые точки: каналы квантовались независимо. Один тон, семь
 * шагов по светлоте — и растр остаётся тёплым при любом размере клетки.
 */
const PALETTE = [
  "#110f10",
  "#1a1210",
  "#241610",
  "#3a1d0e",
  "#5a250b",
  "#8f3407",
  "#ff5f01",
];

function buildConfig(
  variant: SectionGlowVariant,
  effectSize: number,
  preset: HazeglowPreset,
  canvasFromPreset: boolean,
): GradientConfig {
  const ascii = variant === "ascii";
  // Краски берутся из присланного градиента, правила проекта — поверх него.
  const colors = presetConfig(preset);
  const builtIn: GradientConfig = {
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
    grain: 0.02,
    // Фон живёт: медленный поток, а не статичная картинка.
    motion: "flow",
    speed: 0.3,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: ascii ? "ascii" : "dither",
    effectSize,
    effectAmount: ascii ? 0.9 : 1,
  };
  if (!colors) return builtIn;
  // Авторский градиент задаёт всё, кроме типа эффекта и размера ячейки:
  // владелец собирает свет, плотность и движение в редакторе, а проект
  // отвечает за то, что это dither/ascii и что клетка измерена в CSS-пикселях.
  return {
    ...builtIn,
    ...colors,
    effect: builtIn.effect,
    // Число ступеней и зерно — правила проекта: из ссылки берутся краски,
    // свет и движение, а не плотность растра. Малое число ступеней превращает
    // плавный градиент в сплошную серую сетку из точек.
    effectAmount: builtIn.effectAmount,
    grain: builtIn.grain,
    effectSize,
    // База холста — цвет страницы: иначе чёрный прямоугольник шейдера виден
    // на фоне #110F10 как отдельная плашка.
    background: builtIn.background,
  };
}

interface SectionGlowProps {
  className?: string;
  variant?: SectionGlowVariant;
  /**
   * Чей это фон. У каждой секции свой градиент владельца; пока ссылки нет —
   * берётся фон сайта, а не придуманный агентом.
   */
  preset?: HazeglowPreset;
  /** Маска по краям. В hero выключается: градиент владельца не обрезается. */
  mask?: boolean;
  /** База холста из присланного градиента, а не из палитры проекта. */
  canvasFromPreset?: boolean;
  /** Ячейка в CSS-пикселях: по умолчанию крупная печатная. */
  cell?: number;
  /** Прозрачность слоя: чем плотнее текст над ним, тем тише фон. */
  intensity?: number;
}

export function SectionGlow({
  className,
  variant = "dither",
  preset = "site",
  mask = true,
  canvasFromPreset = false,
  cell = HAZEGLOW_CELL.section,
  intensity = 0.55,
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
        style={
          mask
            ? {
                maskImage:
                  "radial-gradient(125% 130% at 54% 36%, #000 0%, #000 40%, rgba(0,0,0,0.72) 66%, rgba(0,0,0,0.22) 86%, transparent 97%)",
                WebkitMaskImage:
                  "radial-gradient(125% 130% at 54% 36%, #000 0%, #000 40%, rgba(0,0,0,0.72) 66%, rgba(0,0,0,0.22) 86%, transparent 97%)",
              }
            : undefined
        }
      >
        <Hazeglow
          config={buildConfig(variant, effectSize, preset, canvasFromPreset)}
          className="size-full"
        />
      </div>
    </div>
  );
}
