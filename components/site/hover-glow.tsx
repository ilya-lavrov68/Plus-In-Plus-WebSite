"use client";

import { Hazeglow } from "hazeglow";
import { useEffect, useRef, useState } from "react";

import { hoverPatternFor } from "@/lib/hover-patterns";
import { cn } from "@/lib/utils";

/**
 * Статичный Hazeglow-кадр для наведения на карточку или строку.
 *
 * Правило проекта: в покое поверхность чистая, при наведении появляется
 * **неподвижный** крупный растр — он читается как фактура и не отвлекает от
 * текста. Анимации нет вовсе (`motion: "none"`, `speed: 0`): шейдер рисует
 * один кадр и останавливается.
 */
interface HoverGlowProps {
  className?: string;
  /** Ключ карточки: по нему выбирается свой паттерн, а не общий на всех. */
  pattern: string;
  /** Прозрачность кадра в наведённом состоянии. */
  intensity?: number;
}

export function HoverGlow({ className, pattern, intensity = 0.4 }: HoverGlowProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const [allowed, setAllowed] = useState(false);
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

  const config = hoverPatternFor(pattern);
  // Паттернов ещё нет — подсветка не рисуется: выдуманный паттерн хуже, чем
  // чистая поверхность.
  if (!config) return null;

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
