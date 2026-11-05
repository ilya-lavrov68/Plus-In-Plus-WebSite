"use client";

import { MotionConfig } from "motion/react";

/**
 * Локальная политика анимаций: `motion` уважает `prefers-reduced-motion`.
 *
 * Раньше `MotionConfig` стоял в корневых `Providers`, поэтому чанк
 * `motion/react` (~130 КБ до сжатия) попадал в общий bundle каждой страницы —
 * включая те, где анимаций нет вовсе. Теперь провайдер оборачивает только
 * анимированные блоки, и остальные маршруты грузятся без motion.
 */
export function MotionPreference({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
