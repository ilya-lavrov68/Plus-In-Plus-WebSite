"use client";

import { Hazeglow, type GradientConfig } from "hazeglow";
import { useEffect, useRef, useState } from "react";

import { presetConfig, type HazeglowPreset } from "@/lib/hazeglow-presets";
import { effectSizeFor, HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { cn } from "@/lib/utils";

/**
 * Общий фон страницы.
 *
 * Один слой под всем содержимым: градиент владельца не повторяется в каждой
 * секции и между секциями нет швов. Слой закреплён по вьюпорту, поэтому при
 * прокрутке свет остаётся на месте, а контент едет поверх него.
 *
 * Читаемость решается не маской поверх градиента, а поверхностями: текстовые
 * блоки живут на карточках (`bg-card`), фон виден вокруг них.
 */
export function PageGlow({
  preset,
  variant = "ascii",
  cell = HAZEGLOW_CELL.ascii,
  className,
}: {
  preset: HazeglowPreset;
  variant?: "dither" | "ascii";
  cell?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [effectSize, setEffectSize] = useState(() => effectSizeFor(900, cell));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      const minSide = Math.min(rect.width, rect.height) || 900;
      setEffectSize(effectSizeFor(minSide, cell));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [cell]);

  const colors = presetConfig(preset);
  const config: GradientConfig = {
    version: 1,
    seed: 3,
    shape: "pill",
    center: [0.5, 0.3],
    size: [0.9, 1],
    roundness: 0.45,
    softness: 0.22,
    rotation: 0,
    rampDirection: 0.55,
    angle: 90,
    warp: 0.6,
    warpScale: 1,
    palette: ["#110f10", "#2b292a", "#ff5f01"],
    background: "#110f10",
    mesh: [],
    grain: 0.02,
    motion: "drift",
    speed: 0.3,
    loop: 0,
    hover: 0,
    hoverMode: "push",
    // Тип эффекта и размер клетки остаются проектными: их задаёт не градиент.
    effect: variant === "ascii" ? "ascii" : "dither",
    effectSize,
    effectAmount: variant === "ascii" ? 0.85 : 0.6,
    ...(colors ?? {}),
  };

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-page-glow=""
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden",
        className,
      )}
    >
      <Hazeglow config={config} className="size-full" />
    </div>
  );
}
