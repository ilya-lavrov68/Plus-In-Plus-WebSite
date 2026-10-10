"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Full-bleed PNG gradient background (e.g. /assets/gradients/hero-gradient.png).
 *
 * The PNG is the only source of the gradient look — CSS gradients are never
 * used here. Until the customer adds the file, the section's solid brand-color
 * background shows through.
 */
export interface GradientBackdropProps {
  src: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
}

export function GradientBackdrop({
  src,
  alt = "",
  sizes = "100vw",
  priority = false,
}: GradientBackdropProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="pointer-events-none object-cover"
      onError={() => setFailed(true)}
    />
  );
}
