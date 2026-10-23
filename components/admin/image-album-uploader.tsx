"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import Image from "next/image";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";

import { IMAGE_ACCEPT } from "@/lib/upload-policy";
import { cn } from "@/lib/utils";

export interface ImageAlbumUploaderProps {
  initialImages?: string[];
  onChange?: (images: string[]) => void;
}

export function ImageAlbumUploader({
  initialImages = [],
  onChange,
}: ImageAlbumUploaderProps) {
  const t = useTranslations("admin");
  const [images, setImages] = useState<string[]>(initialImages);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.size > 0);
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/admin/upload-album", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || t("upload.uploadFailed"));
      }

      const updated = [...images, ...(data.urls as string[])];
      setImages(updated);
      onChange?.(updated);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t("upload.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFiles(event.target.files);
    }
  };

  const removeImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    setImages(updated);
    onChange?.(updated);
  };

  return (
    <div className="space-y-4">
      {/* Hidden input to ensure images JSON array is submitted with the form */}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      {/* Drag & Drop Area */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-200 ease-out",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          name="album"
          multiple
          accept={IMAGE_ACCEPT}
          onChange={onFileChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{t("upload.uploading")}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                <span className="text-primary hover:underline">{t("upload.clickToUpload")}</span> {t("upload.dragAndDrop")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("upload.formats")}
              </p>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Counter and Previews */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("upload.albumCounter", { count: images.length })}
          </span>
          {images.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("upload.albumUploaded", { count: images.length })}
            </span>
          ) : null}
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted"
              >
                <Image
                  src={url}
                  alt={t("upload.albumImage", { index: index + 1 })}
                  fill
                  sizes="160px"
                  className="object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  aria-label={t("upload.albumRemove", { index: index + 1 })}
                  className="font-medium absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  #{index + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            {t("upload.albumEmpty")}
          </div>
        )}
      </div>
    </div>
  );
}
