"use client";

import { useEffect, useState } from "react";

import { COVER_IMAGE_GUIDES, MAX_COVER_BYTES, MAX_COVER_INPUT_PIXELS } from "@/lib/upload-policy";

export type CoverImageKind = keyof typeof COVER_IMAGE_GUIDES;

type ImageDimensions = { width: number; height: number } | "error" | null;

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CoverImageHelp({
  kind,
  file,
  mode,
}: {
  kind: CoverImageKind;
  file: File | null;
  mode: "create" | "edit";
}) {
  const [dimensions, setDimensions] = useState<ImageDimensions>(null);
  const guide = COVER_IMAGE_GUIDES[kind];

  useEffect(() => {
    setDimensions(null);
    if (!file) return;

    let active = true;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const releaseObjectUrl = () => URL.revokeObjectURL(objectUrl);

    image.onload = () => {
      if (active) {
        setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      }
      releaseObjectUrl();
    };
    image.onerror = () => {
      if (active) setDimensions("error");
      releaseObjectUrl();
    };
    image.src = objectUrl;

    return () => {
      active = false;
      releaseObjectUrl();
    };
  }, [file]);

  return (
    <>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Up to {MAX_COVER_BYTES / (1024 * 1024)} MB and {MAX_COVER_INPUT_PIXELS / 1_000_000} megapixels. For a sharp fit, use {guide.recommended} ({guide.aspectRatio}).{" "}
        Suggested minimum: {guide.minimum}; maximum after optimization: {guide.maximumAfterProcessing}.{" "}
        Full HD (1,920 × 1,080 px) is accepted and displayed in full; a different aspect ratio may leave empty margins, but covers are never cropped.{" "}
        Saved as WebP. {mode === "edit" ? "Leave empty to keep the current cover." : "Required."}
      </p>
      {file ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          Selected: {file.name} — {dimensions && dimensions !== "error"
            ? `${dimensions.width} × ${dimensions.height} px`
            : dimensions === "error" ? "could not read image dimensions" : "reading image dimensions…"}
          {` · ${formatFileSize(file.size)}`}
        </p>
      ) : null}
    </>
  );
}
