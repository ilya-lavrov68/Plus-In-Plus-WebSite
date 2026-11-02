"use client";

import { useEffect } from "react";

const CURSOR_FILL_SELECTOR = ".pip-cursor-fill";

/** Запоминает точную точку входа, не реагируя на переходы между дочерними SVG. */
export function CursorFillController() {
  useEffect(() => {
    const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    const handlePointerOver = (event: PointerEvent) => {
      if (!precisePointer.matches || !(event.target instanceof Element)) return;

      const control = event.target.closest(CURSOR_FILL_SELECTOR);
      if (!(control instanceof HTMLElement)) return;
      if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) {
        return;
      }

      const bounds = control.getBoundingClientRect();
      control.style.setProperty("--cursor-fill-x", `${event.clientX - bounds.left}px`);
      control.style.setProperty("--cursor-fill-y", `${event.clientY - bounds.top}px`);
    };

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    return () => document.removeEventListener("pointerover", handlePointerOver);
  }, []);

  return null;
}
