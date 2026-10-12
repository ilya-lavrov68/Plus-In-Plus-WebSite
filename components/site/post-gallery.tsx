"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useTranslations } from "next-intl";

import { SafeImage } from "@/components/site/safe-image";

export interface PostGalleryProps {
  images: string[] | string | null | undefined;
}

export function PostGallery({ images }: PostGalleryProps) {
  const t = useTranslations("gallery");
  let imageList: string[] = [];
  if (Array.isArray(images)) {
    imageList = images;
  } else if (typeof images === "string" && images.trim()) {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) imageList = parsed.map(String);
      else imageList = [images];
    } catch {
      imageList = [images];
    }
  }

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const closeModal = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const showNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % imageList.length);
  }, [selectedIndex, imageList.length]);

  const showPrev = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + imageList.length) % imageList.length);
  }, [selectedIndex, imageList.length]);

  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
      else if (event.key === "ArrowRight") showNext();
      else if (event.key === "ArrowLeft") showPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, closeModal, showNext, showPrev]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedIndex === null || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedIndex]);

  if (imageList.length === 0) return null;

  return (
    <div className="mt-10 border-t border-[#052B42]/10 pt-8 sm:mt-12 sm:pt-10">
      <div className="flex items-center justify-between pb-4">
        <h3 className="font-geist text-xl font-semibold tracking-[-0.02em] text-[#052B42] sm:text-2xl">
          {t("title")}
        </h3>
        <span className="rounded-full bg-[#052B42]/10 px-3 py-1 font-body text-xs font-semibold text-[#052B42]">
          {t("photoCount", { count: imageList.length })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {imageList.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            onClick={() => setSelectedIndex(index)}
            aria-label={t("openPhoto", { index: index + 1, total: imageList.length })}
            className="font-medium group relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-[#F0F0F0] text-left transition-shadow duration-200 ease-out hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            <SafeImage
              src={src}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-opacity duration-200 ease-out group-hover:opacity-90"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-navy shadow-sm">
                <ZoomIn className="h-5 w-5" />
              </span>
            </div>
            <span className="absolute bottom-2 left-2 z-10 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              #{index + 1}
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedIndex !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("lightbox")}
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-6"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeModal}
            aria-label={t("close")}
            className="font-medium absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors duration-200 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Previous button */}
          {imageList.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showPrev();
              }}
              aria-label={t("previous")}
              className="font-medium absolute left-4 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition-colors duration-200 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          {/* Next button */}
          {imageList.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showNext();
              }}
              aria-label={t("next")}
              className="absolute right-4 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 font-medium text-white transition-colors duration-200 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}

          {/* Current photo */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[85vh] max-w-[90vw] flex-col items-center"
          >
            <div className="relative aspect-video max-h-[80vh] w-[min(1200px,85vw)] overflow-hidden rounded-xl bg-black/40">
              <Image
                src={imageList[selectedIndex]}
                alt={t("photoAlt", { index: selectedIndex + 1 })}
                fill
                sizes="90vw"
                className="object-contain"
                priority
              />
            </div>
            <p className="mt-3 text-center text-sm font-medium text-white/80">
              {selectedIndex + 1} / {imageList.length}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
