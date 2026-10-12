"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("admin");
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
        {t("upload.limit", { size: MAX_COVER_BYTES / (1024 * 1024), megapixels: MAX_COVER_INPUT_PIXELS / 1_000_000 })}{" "}
        {t("upload.recommended", { recommended: guide.recommended, aspectRatio: guide.aspectRatio })}{" "}
        {t("upload.minimum", { minimum: guide.minimum, maximum: guide.maximumAfterProcessing })}{" "}
        {t("upload.fullHd")}{" "}
        {t("upload.savedAsWebp")} {mode === "edit" ? t("upload.keepCurrent") : t("upload.required")}
      </p>
      {file ? (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {t("upload.selected", {
            name: file.name,
            dimensions:
              dimensions && dimensions !== "error"
                ? `${dimensions.width} × ${dimensions.height} px`
                : dimensions === "error"
                  ? t("upload.unreadableDimensions")
                  : t("upload.readingDimensions"),
          })}
          {` · ${formatFileSize(file.size)}`}
        </p>
      ) : null}
    </>
  );
}
