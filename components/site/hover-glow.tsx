"use client";

import { Hazeglow, type GradientConfig } from "hazeglow";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Деликатное свечение Hazeglow для интерактивных поверхностей.
 *
 * Правило проекта (`project-design-system`): в покое поверхность чистая, шум
 * допустим только как реакция на наведение. Поэтому canvas живёт лишь пока
 * указатель (или фокус) внутри родителя: вне hover в DOM нет ни одного WebGL
 * контекста, а значит нет ни шума, ни расхода GPU.
 *
 * Свечение мягкое: палитра из тональных ступеней бренда без оранжевого,
 * эффект выключен, зерно минимальное, края гасятся маской — у подсветки нет
 * прямоугольной границы.
 */

const SOFT_GLOW: GradientConfig = {
  version: 1,
  seed: 23,
  shape: "blob",
  center: [0.68, 0.34],
  size: [1.15, 1.05],
  roundness: 0.95,
  softness: 0.95,
  rotation: 0,
  rampDirection: 0.8,
  angle: 118,
  warp: 0.06,
  warpScale: 1.2,
  // Только тональные ступени: свечение не спорит с оранжевым действием.
  palette: ["#171515", "#242122", "#2b292a", "#3a3637"],
  background: "#110f10",
  mesh: [],
  grain: 0.08,
  motion: "drift",
  speed: 0.14,
  loop: 0,
  hover: 0.3,
  hoverMode: "pull",
  effect: "none",
  effectSize: 8,
  effectAmount: 0,
};

interface HoverGlowProps {
  className?: string;
  /** Прозрачность свечения в наведённом состоянии (0–1). */
  intensity?: number;
}

export function HoverGlow({ className, intensity = 0.55 }: HoverGlowProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const hoverable = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAllowed(hoverable.matches && !reduced.matches);
    sync();
    hoverable.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      hoverable.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const host = hostRef.current?.parentElement;
    if (!host) return;

    const enter = () => setActive(true);
    const leave = () => setActive(false);
    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointerleave", leave);
    host.addEventListener("focusin", enter);
    host.addEventListener("focusout", leave);
    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("focusin", enter);
      host.removeEventListener("focusout", leave);
    };
  }, [allowed]);

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-0 transition-opacity duration-500 ease-out",
        active && "opacity-100",
        className,
      )}
      style={{
        opacity: active ? intensity : 0,
        // Края свечения растворяются в фоне: у подсветки нет резкой рамки.
        maskImage:
          "radial-gradient(120% 100% at 62% 28%, #000 0%, rgba(0,0,0,0.85) 38%, transparent 78%)",
        WebkitMaskImage:
          "radial-gradient(120% 100% at 62% 28%, #000 0%, rgba(0,0,0,0.85) 38%, transparent 78%)",
      }}
    >
      {active ? <Hazeglow config={SOFT_GLOW} className="size-full" /> : null}
    </span>
  );
}
