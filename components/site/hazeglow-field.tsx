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
const CONFIG: GradientConfig = {
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
};

interface HazeglowFieldProps {
  className?: string;
}

export function HazeglowField({ className }: HazeglowFieldProps) {
  const [unsupported, setUnsupported] = useState(false);

  return (
    <div className={className} aria-hidden="true" data-hazeglow="line-launcher">
      {unsupported ? (
        <div className="size-full bg-card" />
      ) : (
        <Hazeglow
          config={CONFIG}
          className="size-full"
          onUnsupported={() => setUnsupported(true)}
        />
      )}
    </div>
  );
}
