"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface PixelDirectionSpriteProps {
  variant?: "design";
  className?: string;
}

/**
 * Тематический 24-кадровый sprite, а не непрерывно движущийся фон.
 * CSS steps сохраняет пиксельную сетку; вне viewport и в скрытой вкладке
 * показывается неподвижный финальный кадр, reduced motion не запускает цикл.
 */
export function PixelDirectionSprite({ variant = "design", className }: PixelDirectionSpriteProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    let visible = false;
    const update = () => {
      element.dataset.active = visible && !document.hidden ? "true" : "false";
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.2 },
    );

    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-pixel-sprite={variant}
      data-active="false"
      data-frame-count="24"
      className={cn("pixel-direction-sprite", `pixel-direction-sprite--${variant}`, className)}
    >
      <div className="pixel-direction-sprite__sheet" />
    </div>
  );
}
