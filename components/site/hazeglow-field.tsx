"use client";

import { useState } from "react";
import { Hazeglow, type GradientConfig } from "hazeglow";

/**
 * Фоновая графика Hazeglow для продуктового блока.
 *
 * Палитра ограничена утверждёнными значениями бренда: тёмная основа и
 * серый дают тональную структуру, оранжевый остаётся маленьким сигналом.
 * Композиция собрана так, чтобы слева под текстом была тихая зона, а
 * визуальная масса жила справа.
 *
 * Компонент заботятся о доступности сам: рисует `aria-hidden` canvas,
 * останавливается вне вьюпорта, показывает статичный кадр при
 * `prefers-reduced-motion` и сообщает через `onUnsupported`, если WebGL
 * недоступен. Здесь мы подменяем поле на спокойную подложку.
 */
const CONFIGS: Record<HazeglowVariant, GradientConfig> = {
  /**
   * Продуктовый блок: ASCII-текстура, масса справа, оранжевый — маленький сигнал.
   */
  product: {
    version: 1,
    seed: 47,
    shape: "blob",
    center: [0.68, 0.46],
    size: [0.92, 0.78],
    roundness: 0.88,
    softness: 0.58,
    rotation: 18,
    rampDirection: 0.86,
    angle: 118,
    warp: 0.12,
    warpScale: 1.4,
    palette: ["#110f10", "#2b292a", "#eeeeee", "#ff5f01"],
    background: "#110f10",
    mesh: [],
    grain: 0.22,
    motion: "drift",
    speed: 0.35,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: "ascii",
    effectSize: 10,
    effectAmount: 0.55,
  },
  /**
   * Сцена первого экрана: широкое dither-поле. Основная масса справа, слева
   * широкая тихая зона — над графикой никогда не лежит текст.
   */
  hero: {
    version: 1,
    seed: 19,
    shape: "band",
    center: [0.72, 0.5],
    size: [1.05, 0.82],
    roundness: 0.72,
    softness: 0.62,
    rotation: 8,
    rampDirection: 0.78,
    angle: 102,
    warp: 0.1,
    warpScale: 1.2,
    palette: ["#110f10", "#2b292a", "#eeeeee", "#ff5f01"],
    background: "#110f10",
    mesh: [],
    grain: 0.16,
    motion: "drift",
    speed: 0.22,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: "dither",
    effectSize: 6,
    effectAmount: 0.42,
  },
};

export type HazeglowVariant = "hero" | "product";

interface HazeglowFieldProps {
  className?: string;
  variant?: HazeglowVariant;
}

export function HazeglowField({ className, variant = "product" }: HazeglowFieldProps) {
  const [unsupported, setUnsupported] = useState(false);

  return (
    <div className={className} aria-hidden="true" data-hazeglow={variant}>
      {unsupported ? (
        <div className="size-full bg-card" />
      ) : (
        <Hazeglow
          config={CONFIGS[variant]}
          className="size-full"
          onUnsupported={() => setUnsupported(true)}
        />
      )}
    </div>
  );
}
