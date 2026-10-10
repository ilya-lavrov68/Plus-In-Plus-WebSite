"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeImageProps = Omit<ImageProps, "src" | "onError"> & {
  src?: string | null;
};

/** Renders an uploaded image only while its source is available. */
export function SafeImage({ src, alt, ...props }: SafeImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageSrc = src?.trim();

  if (!imageSrc || failedSource === imageSrc) return null;

  return (
    <Image
      {...props}
      src={imageSrc}
      alt={alt}
      onError={() => setFailedSource(imageSrc)}
    />
  );
}
