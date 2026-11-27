"use client";

import { Hazeglow, type GradientConfig } from "hazeglow";
import { useEffect, useState } from "react";

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
  const [effectSize, setEffectSize] = useState(() => effectSizeFor(900, cell));
  // `?glow=full` — режим съёмки: слой разворачивается на всю высоту страницы,
  // чтобы полный кадр показал фон целиком, а не только в первом экране.
  const [pageHeight, setPageHeight] = useState<number | null>(null);

  useEffect(() => {
    const fullPage =
      new URLSearchParams(window.location.search).get("glow") === "full";
    const measure = () => {
      const height = fullPage
        ? document.documentElement.scrollHeight
        : window.innerHeight;
      setEffectSize(effectSizeFor(Math.min(window.innerWidth, height), cell));
      setPageHeight(fullPage ? height : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cell]);

  const colors = presetConfig(preset);
  // Присланный градиент применяется как есть: масштаб растра, движение и база
  // холста — из ссылки. Пересчёт клетки под размер блока делал рисунок крупнее,
  // чем в редакторе, и он читался как сетка пикселей.
  const config: GradientConfig = colors ?? {
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
    effect: variant === "ascii" ? "ascii" : "dither",
    effectSize,
    effectAmount: variant === "ascii" ? 0.85 : 1,
  };

  return (
    <div
      aria-hidden="true"
      data-page-glow=""
      style={
        pageHeight ? { position: "absolute", height: pageHeight } : undefined
      }
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <Hazeglow config={config} className="size-full" />
    </div>
  );
}
