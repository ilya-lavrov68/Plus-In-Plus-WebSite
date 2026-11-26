"use client";

import { useState, type CSSProperties } from "react";
import { Hazeglow, type GradientConfig } from "hazeglow";

import { cn } from "@/lib/utils";

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
    palette: ["#110f10", "#2b292a", "#6b6364", "#eeeeee", "#ff5f01"],
    background: "#110f10",
    mesh: [],
    grain: 0.3,
    motion: "drift",
    speed: 0.35,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: "ascii",
    effectSize: 9,
    effectAmount: 0.7,
  },
  /**
   * Сцена первого экрана: графитовый световой свип. Поле тёмное, поэтому
   * панель читается как поверхность с подсветкой, а не как «закат»: масса
   * справа, левый верхний угол остаётся почти чёрным. Тонкая стеклянная
   * штриховка даёт тактильность, зерно снимает бандинг на градиенте.
   */
  hero: {
    version: 1,
    seed: 19,
    shape: "band",
    center: [0.72, 0.62],
    size: [0.8, 0.8],
    roundness: 0.8,
    softness: 0.62,
    rotation: 26,
    rampDirection: 0.75,
    angle: 95,
    warp: 0.1,
    warpScale: 1.2,
    // Только тональные ступени палитры владельца: тёмная основа, графит и
    // серый. Оранжевый и белый в самом поле не участвуют — они появляются
    // маленьким сигналом в акценте поверх сцены.
    palette: ["#110f10", "#242122", "#4a4546", "#6b6364"],
    background: "#110f10",
    mesh: [],
    grain: 0.2,
    motion: "drift",
    speed: 0.16,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: "dither",
    effectSize: 3,
    effectAmount: 0.22,
  },
  /**
   * Карточка направления «Дизайн»: тот же dither, но композиция узкая и
   * горизонтальная — под медиа-полосу карточки. Оранжевый остаётся последней
   * ступенью палитры и появляется небольшим тёплым краем.
   */
  design: {
    version: 1,
    seed: 71,
    shape: "blob",
    center: [0.7, 0.5],
    size: [0.95, 0.85],
    roundness: 0.9,
    softness: 0.7,
    rotation: 0,
    rampDirection: 0.82,
    angle: 100,
    warp: 0.12,
    warpScale: 1.3,
    palette: ["#110f10", "#242122", "#4a4546", "#6b6364"],
    background: "#110f10",
    mesh: [],
    grain: 0.18,
    motion: "drift",
    speed: 0.2,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: "dither",
    effectSize: 3,
    effectAmount: 0.24,
  },
};

export type HazeglowVariant = "hero" | "design" | "product";

interface HazeglowFieldProps {
  className?: string;
  variant?: HazeglowVariant;
}

/**
 * Свет поверх сцены: виньетка собирает кадр к центру, тёплое пятно даёт
 * единственный оранжевый сигнал. Оба слоя — градиенты, а не тени: панель не
 * должна светиться по краю.
 */
const OVERLAYS: Record<HazeglowVariant, CSSProperties> = {
  hero: {
    background: [
      "radial-gradient(38% 46% at 84% 74%, rgba(255,95,1,0.16), rgba(255,95,1,0) 72%)",
      "radial-gradient(120% 100% at 50% 42%, rgba(17,15,16,0) 52%, rgba(17,15,16,0.5) 100%)",
    ].join(", "),
  },
  design: {
    background: [
      "radial-gradient(46% 60% at 72% 62%, rgba(255,95,1,0.16), rgba(255,95,1,0) 74%)",
      "radial-gradient(120% 100% at 50% 40%, rgba(17,15,16,0) 50%, rgba(17,15,16,0.55) 100%)",
    ].join(", "),
  },
  product: {
    background: [
      "radial-gradient(42% 52% at 78% 78%, rgba(255,95,1,0.14), rgba(255,95,1,0) 74%)",
      "radial-gradient(125% 100% at 46% 40%, rgba(17,15,16,0) 54%, rgba(17,15,16,0.45) 100%)",
    ].join(", "),
  },
};

/**
 * Резервная сцена без WebGL: тот же световой свип, собранный из градиентов.
 * Пустая панель выглядела бы поломкой, а плоская заливка — заглушкой, поэтому
 * повторяем направление, штриховку и тёплый сигнал оригинала.
 */
const FALLBACK_BACKGROUND: Record<HazeglowVariant, string> = {
  hero: [
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0 1px, rgba(255,255,255,0) 1px 3px)",
    "linear-gradient(26deg, #110f10 0%, #161414 30%, #2b292a 46%, #4a4546 52%, #6b6364 57%, #2f2c2c 63%, #110f10 80%)",
  ].join(", "),
  design: [
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(255,255,255,0) 1px 3px)",
    "radial-gradient(80% 120% at 70% 50%, #6b6364 0%, #4a4546 34%, #242122 62%, #110f10 88%)",
  ].join(", "),
  product: [
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(255,255,255,0) 1px 3px)",
    "radial-gradient(70% 90% at 68% 46%, #3a3637 0%, #2b292a 42%, #110f10 78%)",
  ].join(", "),
};

export function HazeglowField({ className, variant = "product" }: HazeglowFieldProps) {
  const [unsupported, setUnsupported] = useState(false);

  return (
    <div className={cn("bg-[#110f10]", className)} aria-hidden="true" data-hazeglow={variant}>
      <div className="relative size-full">
        {unsupported ? (
          <div className="size-full" style={{ background: FALLBACK_BACKGROUND[variant] }} />
        ) : (
          <Hazeglow
            config={CONFIGS[variant]}
            className="size-full"
            onUnsupported={() => setUnsupported(true)}
          />
        )}
        <div className="pointer-events-none absolute inset-0" style={OVERLAYS[variant]} />
      </div>
    </div>
  );
}
