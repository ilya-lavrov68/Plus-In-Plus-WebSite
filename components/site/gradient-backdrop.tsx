"use client";

import { useState } from "react";
import Image from "next/image";

/** Full-bleed background artwork from the supplied files in /public/assets. */
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

  if (failed) return null;

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
