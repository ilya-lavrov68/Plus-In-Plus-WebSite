"use client";

import { Hazeglow, type GradientConfig } from "hazeglow";
import { useEffect, useRef, useState } from "react";

import { presetConfig } from "@/lib/hazeglow-presets";
import { effectSizeFor, HAZEGLOW_CELL } from "@/lib/hazeglow-scale";
import { cn } from "@/lib/utils";

/**
 * Статичный Hazeglow-кадр для наведения на карточку или строку.
 *
 * Правило проекта: в покое поверхность чистая, при наведении появляется
 * **неподвижный** крупный растр — он читается как фактура и не отвлекает от
 * текста. Анимации нет вовсе (`motion: "none"`, `speed: 0`): шейдер рисует
 * один кадр и останавливается.
 */
const PALETTE = [
  "#110f10",
  "#241610",
  "#3a1d0e",
  "#5a250b",
  "#8f3407",
  "#ff5f01",
];

interface HoverGlowProps {
  className?: string;
  /** Прозрачность кадра в наведённом состоянии. */
  intensity?: number;
}

export function HoverGlow({ className, intensity = 0.4 }: HoverGlowProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [effectSize, setEffectSize] = useState(() =>
    effectSizeFor(320, HAZEGLOW_CELL.hover),
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
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

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const minSide = Math.min(rect.width, rect.height) || 320;
      setEffectSize(effectSizeFor(minSide, HAZEGLOW_CELL.hover));
    };

    const enter = () => {
      measure();
      setActive(true);
    };
    const leave = () => setActive(false);

    measure();
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

  const preset = presetConfig("site");
  const config: GradientConfig = {
    ...(preset ?? {}),
    version: 1,
    seed: 23,
    shape: "pill",
    center: [0.68, 0.34],
    size: [1.15, 1.05],
    roundness: 0.95,
    softness: 0.7,
    rotation: 0,
    rampDirection: 0.8,
    angle: 118,
    warp: 0.05,
    warpScale: 1.2,
    palette: preset?.palette ?? PALETTE,
    background: preset?.background ?? "#110f10",
    mesh: [],
    // Статичный кадр: ни движения, ни перерисовки — даже если градиент
    // прислан с анимацией.
    motion: "none",
    speed: 0,
    loop: 0,
    hover: 0,
    hoverMode: "pull",
    effect: preset?.effect ?? "dither",
    effectSize: preset?.effectSize ?? effectSize,
    effectAmount: preset?.effectAmount ?? 0.9,
    grain: preset?.grain ?? 0.04,
  };

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-0 transition-opacity duration-200 ease-out",
        active && "opacity-100",
        className,
      )}
      style={{
        opacity: active ? intensity : 0,
        maskImage:
          "radial-gradient(115% 100% at 64% 30%, #000 0%, rgba(0,0,0,0.7) 46%, transparent 82%)",
        WebkitMaskImage:
          "radial-gradient(115% 100% at 64% 30%, #000 0%, rgba(0,0,0,0.7) 46%, transparent 82%)",
      }}
    >
      {active ? <Hazeglow config={config} className="size-full" /> : null}
    </span>
  );
}
